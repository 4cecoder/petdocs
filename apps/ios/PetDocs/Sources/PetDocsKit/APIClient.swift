import Foundation

/// Thin REST client for the petdocs mobile auth HTTP contract
/// (`POST /api/auth/request`, `POST /api/auth/verify`, `GET /api/me`).
///
/// Design mirrors the adventurers-portal iOS `ConvexClient`:
/// - One shared `URLSession` (single connection pool, HTTP/2 keepalive,
///   cache disabled so verify/me never serve stale data).
/// - Non-throwing call surface: every method resolves to an outcome struct
///   carrying user-facing copy; transport errors collapse to the friendly
///   offline/reachability text from `TransportCopy`.
/// - Response parsing lives in static `decode*` functions — pure, tolerant,
///   and unit-testable without a network.
public final class APIClient: Sendable {
    /// Prod web origin — universal links
    /// (`https://petdocs.seridian.dev/signin?token=…`) are served from here,
    /// so the API base defaults to the same host.
    public static let defaultBaseURL = URL(string: "https://petdocs.seridian.dev")!

    /// Shared session reused for every call: one connection pool, HTTP/2 +
    /// keepalive via URLSession defaults, cache + cookies disabled so auth
    /// responses are never stale or cross-contaminated.
    public static let sharedSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        config.urlCache = nil
        config.httpShouldSetCookies = false
        config.httpMaximumConnectionsPerHost = 4
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        return URLSession(configuration: config)
    }()

    public let baseURL: URL
    private let session: URLSession

    public init(baseURL: URL = APIClient.defaultBaseURL, session: URLSession = APIClient.sharedSession) {
        self.baseURL = baseURL
        self.session = session
    }

    // MARK: - Endpoints (mobile auth HTTP contract)

    /// Magic-link step 1: `POST /api/auth/request` with `{email}`.
    /// Always resolves (never throws): `{ok:false, error}` on server
    /// rejection, friendly copy on transport failure.
    public func requestMagicLink(email: String) async -> RequestLinkOutcome {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        var request = makeRequest(path: "/api/auth/request", method: "POST")
        do {
            request.httpBody = try Self.jsonBody(["email": trimmed])
        } catch {
            return RequestLinkOutcome(ok: false, error: "Couldn't prepare the request. Try again.")
        }
        let (data, response) = await send(request)
        if let apiError = Self.serverError(status: response.statusCode, data: data) {
            return RequestLinkOutcome(ok: false, error: apiError)
        }
        return Self.decodeRequestLink(data)
    }

    /// Magic-link step 2: `POST /api/auth/verify` with `{email, token}`.
    /// The token arrives via the `petdocs://signin?token=…` deep link or the
    /// universal link `https://petdocs.seridian.dev/signin?token=…` and is
    /// sent verbatim (opaque; never normalized). Success carries the session
    /// bearer token + user for `SessionStore.signIn`.
    public func verify(email: String, token: String) async -> VerifyOutcome {
        var request = makeRequest(path: "/api/auth/verify", method: "POST")
        do {
            request.httpBody = try Self.jsonBody([
                "email": email.trimmingCharacters(in: .whitespacesAndNewlines),
                "token": token,
            ])
        } catch {
            return VerifyOutcome(ok: false, error: "Couldn't prepare the request. Try again.")
        }
        let (data, response) = await send(request)
        if let apiError = Self.serverError(status: response.statusCode, data: data) {
            return VerifyOutcome(ok: false, error: apiError)
        }
        return Self.decodeVerify(data)
    }

    /// Session check: `GET /api/me` with `Authorization: Bearer <token>`.
    /// 401 → `unauthorized: true` (stale/revoked session → sign out);
    /// other failures keep the session and surface retry-able copy.
    public func me(bearerToken: String) async -> MeOutcome {
        var request = makeRequest(path: "/api/me", method: "GET")
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        let (data, response) = await send(request)
        if response.statusCode == 401 {
            return MeOutcome(user: nil, unauthorized: true, error: nil)
        }
        if let apiError = Self.serverError(status: response.statusCode, data: data) {
            return MeOutcome(user: nil, unauthorized: false, error: apiError)
        }
        return Self.decodeMe(data)
    }

    // MARK: - Transport

    private func makeRequest(path: String, method: String) -> URLRequest {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return request
    }

    private func send(_ request: URLRequest) async -> (Data, HTTPURLResponse) {
        let fallbackResponse = {
            // request.url is always non-nil here: makeRequest built it from
            // baseURL.appendingPathComponent. Guard only for safety.
            let url = request.url ?? Self.defaultBaseURL
            return HTTPURLResponse(url: url, statusCode: 0, httpVersion: nil, headerFields: nil)!
        }()
        do {
            let (data, rawResponse) = try await session.data(for: request)
            guard let http = rawResponse as? HTTPURLResponse else {
                return (data, fallbackResponse)
            }
            return (data, http)
        } catch {
            // Non-throwing surface: collapse transport failures into a
            // synthetic 0-response carrying the friendly copy as the body.
            let body = Data("{\"ok\":false,\"error\":\"\(TransportCopy.friendly(for: error))\"}".utf8)
            return (body, fallbackResponse)
        }
    }

    private static func serverError(status: Int, data: Data) -> String? {
        guard status < 200 || status >= 300 else { return nil }
        if let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let message = dict["error"] as? String, !message.isEmpty {
            return message
        }
        if status == 0 {
            // Body already carries the friendly transport copy.
            return (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
                ?? "Couldn't reach the server. Check your connection and try again."
        }
        return "Something went wrong (\(status)). Try again."
    }

    private static func jsonBody(_ object: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: object, options: [])
    }

    // MARK: - Decoding (testable, dependency-light)
    //
    // Tolerant like the portal decoders: `ok` may arrive as Bool, NSNumber,
    // or "true" string; missing/empty user fields fail closed to `ok:false`
    // with copy instead of throwing.

    static func decodeRequestLink(_ data: Data) -> RequestLinkOutcome {
        guard let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return RequestLinkOutcome(ok: false, error: "Malformed response from the server.")
        }
        let ok = decodeBool(dict["ok"])
        if ok { return RequestLinkOutcome(ok: true, error: nil) }
        return RequestLinkOutcome(
            ok: false,
            error: (dict["error"] as? String) ?? "Couldn't send the sign-in email. Try again."
        )
    }

    static func decodeVerify(_ data: Data) -> VerifyOutcome {
        guard let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return VerifyOutcome(ok: false, error: "Malformed response from the server.")
        }
        guard decodeBool(dict["ok"]) else {
            return VerifyOutcome(
                ok: false,
                error: (dict["error"] as? String) ?? "That sign-in link is invalid or expired. Request a new one."
            )
        }
        guard let token = dict["token"] as? String, !token.isEmpty,
              let user = decodeUser(dict["user"]) else {
            return VerifyOutcome(ok: false, error: "Malformed sign-in response. Try again.")
        }
        return VerifyOutcome(ok: true, token: token, user: user, error: nil)
    }

    static func decodeMe(_ data: Data) -> MeOutcome {
        guard let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return MeOutcome(user: nil, unauthorized: false, error: "Malformed response from the server.")
        }
        // Accept both the bare user object and `{user: {...}}` wrappers.
        let userValue = dict["user"] ?? dict
        guard let user = decodeUser(userValue) else {
            return MeOutcome(user: nil, unauthorized: false, error: "Malformed profile response.")
        }
        return MeOutcome(user: user, unauthorized: false, error: nil)
    }

    static func decodeUser(_ value: Any?) -> User? {
        guard let dict = value as? [String: Any] else { return nil }
        let id = (dict["id"] as? String) ?? (dict["ownerId"] as? String) ?? ""
        let email = (dict["email"] as? String) ?? ""
        guard !id.isEmpty, !email.isEmpty else { return nil }
        let name = dict["name"] as? String
        return User(id: id, email: email, name: name)
    }

    private static func decodeBool(_ value: Any?) -> Bool {
        if let bool = value as? Bool { return bool }
        if let number = value as? NSNumber { return number.boolValue }
        if let string = value as? String { return string.lowercased() == "true" }
        return false
    }
}
