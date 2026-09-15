import XCTest
@testable import PetDocsKit

/// URLProtocol stub so APIClient tests run fully offline: each request is
/// matched against a registered handler (thrown URLError = simulated
/// transport failure). The handler lives behind a lock because URLSession
/// invokes the protocol from its own queue.
final class StubURLProtocol: URLProtocol {
    typealias Handler = (URLRequest) throws -> (Int, [String: String], Data)

    private static let lock = NSLock()
    private static var _handler: Handler?

    static func setHandler(_ handler: Handler?) {
        lock.withLock { _handler = handler }
    }

    private var handler: Handler? {
        Self.lock.withLock { Self._handler }
    }

    static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: config)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        do {
            let (status, headers, body) = try handler(request)
            let response = HTTPURLResponse(
                url: request.url!, statusCode: status, httpVersion: nil, headerFields: headers
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

/// URLRequest.httpBody is consumed as a stream inside URLProtocol; this
/// recovers the bytes for assertions.
private func bodyData(of request: URLRequest) -> Data {
    if let body = request.httpBody { return body }
    guard let stream = request.httpBodyStream else { return Data() }
    stream.open()
    defer { stream.close() }
    var data = Data()
    let bufferSize = 4096
    let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
    defer { buffer.deallocate() }
    while stream.hasBytesAvailable {
        let read = stream.read(buffer, maxLength: bufferSize)
        guard read > 0 else { break }
        data.append(buffer, count: read)
    }
    return data
}

final class APIClientTests: XCTestCase {
    private var client: APIClient!

    override func setUp() {
        super.setUp()
        StubURLProtocol.setHandler(nil)
        client = APIClient(
            baseURL: URL(string: "https://api.test.local")!,
            session: StubURLProtocol.makeSession()
        )
    }

    override func tearDown() {
        StubURLProtocol.setHandler(nil)
        super.tearDown()
    }

    private func respond(_ status: Int = 200, _ json: String) {
        StubURLProtocol.setHandler { _ in
            (status, ["Content-Type": "application/json"], Data(json.utf8))
        }
    }

    // MARK: POST /api/auth/request

    func testRequestMagicLinkPostsEmailToAuthRequest() async {
        var captured: URLRequest?
        StubURLProtocol.setHandler { request in
            captured = request
            return (200, [:], Data(#"{"ok":true}"#.utf8))
        }
        let outcome = await client.requestMagicLink(email: "  dee@example.com  ")
        XCTAssertTrue(outcome.ok)
        XCTAssertNil(outcome.error)
        let request = try! XCTUnwrap(captured)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/auth/request")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
        let body = try! XCTUnwrap(JSONSerialization.jsonObject(with: bodyData(of: request)) as? [String: Any])
        // Email is trimmed before transport, never mutated otherwise.
        XCTAssertEqual(body["email"] as? String, "dee@example.com")
    }

    func testRequestMagicLinkSurfacesServerErrorCopy() async {
        respond(400, #"{"ok":false,"error":"Unknown email"}"#)
        let outcome = await client.requestMagicLink(email: "dee@example.com")
        XCTAssertFalse(outcome.ok)
        XCTAssertEqual(outcome.error, "Unknown email")
    }

    func testRequestMagicLinkOfflineGetsFriendlyCopy() async {
        StubURLProtocol.setHandler { _ in throw URLError(.notConnectedToInternet) }
        let outcome = await client.requestMagicLink(email: "dee@example.com")
        XCTAssertFalse(outcome.ok)
        XCTAssertEqual(outcome.error, "You're offline. Check your connection and try again.")
    }

    func testRequestMagicLinkOtherTransportGetsGenericCopy() async {
        StubURLProtocol.setHandler { _ in throw URLError(.badURL) }
        let outcome = await client.requestMagicLink(email: "dee@example.com")
        XCTAssertFalse(outcome.ok)
        XCTAssertEqual(
            outcome.error,
            "Couldn't reach the server. Check your connection and try again."
        )
    }

    // MARK: POST /api/auth/verify

    func testVerifySendsEmailAndTokenAndDecodesSession() async {
        var captured: URLRequest?
        StubURLProtocol.setHandler { request in
            captured = request
            return (
                200, [:],
                Data(#"{"ok":true,"token":"sess-abc","user":{"id":"owner_1","email":"dee@example.com","name":"Dee"}}"#.utf8)
            )
        }
        let outcome = await client.verify(email: "dee@example.com", token: "link-token-123")
        XCTAssertTrue(outcome.ok)
        XCTAssertEqual(outcome.token, "sess-abc")
        XCTAssertEqual(outcome.user?.id, "owner_1")
        XCTAssertEqual(outcome.user?.email, "dee@example.com")
        let request = try! XCTUnwrap(captured)
        XCTAssertEqual(request.url?.path, "/api/auth/verify")
        let body = try! XCTUnwrap(JSONSerialization.jsonObject(with: bodyData(of: request)) as? [String: Any])
        XCTAssertEqual(body["email"] as? String, "dee@example.com")
        // Token is opaque — sent verbatim, never normalized.
        XCTAssertEqual(body["token"] as? String, "link-token-123")
    }

    func testVerifyBadCodeSurfacesServerCopy() async {
        respond(200, #"{"ok":false,"error":"Link expired"}"#)
        let outcome = await client.verify(email: "dee@example.com", token: "stale")
        XCTAssertFalse(outcome.ok)
        XCTAssertNil(outcome.token)
        XCTAssertEqual(outcome.error, "Link expired")
    }

    func testVerifyMalformedSuccessFailsClosed() async {
        // ok=true but missing token/user must not produce a half-session.
        respond(200, #"{"ok":true}"#)
        let outcome = await client.verify(email: "dee@example.com", token: "t")
        XCTAssertFalse(outcome.ok)
        XCTAssertNil(outcome.token)
        XCTAssertNotNil(outcome.error)
    }

    // MARK: GET /api/me

    func testMeSendsBearerHeaderAndDecodesUser() async {
        var captured: URLRequest?
        StubURLProtocol.setHandler { request in
            captured = request
            return (200, [:], Data(#"{"user":{"id":"owner_1","email":"dee@example.com"}}"#.utf8))
        }
        let outcome = await client.me(bearerToken: "sess-abc")
        XCTAssertFalse(outcome.unauthorized)
        XCTAssertEqual(outcome.user?.id, "owner_1")
        let request = try! XCTUnwrap(captured)
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.url?.path, "/api/me")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer sess-abc")
    }

    func testMeUnauthorizedMarksStaleSession() async {
        respond(401, #"{"error":"unauthorized"}"#)
        let outcome = await client.me(bearerToken: "revoked")
        XCTAssertTrue(outcome.unauthorized)
        XCTAssertNil(outcome.user)
    }

    func testMeServerErrorIsRetryable() async {
        respond(500, #"{"error":"boom"}"#)
        let outcome = await client.me(bearerToken: "sess-abc")
        XCTAssertFalse(outcome.unauthorized, "Server errors must not sign the user out")
        XCTAssertEqual(outcome.error, "boom")
    }

    // MARK: Tolerant decoding

    func testDecodeToleratesStringAndNumberOk() {
        XCTAssertTrue(APIClient.decodeRequestLink(Data(#"{"ok":"true"}"#.utf8)).ok)
        XCTAssertTrue(APIClient.decodeVerify(Data(#"{"ok":1,"token":"t","user":{"id":"o","email":"e"}}"#.utf8)).ok)
    }

    func testDecodeUserAcceptsOwnerIdAlias() {
        let user = APIClient.decodeUser(#"{"ownerId":"owner_9","email":"e@x.dev"}"# as NSString?)
        XCTAssertNil(user, "Non-dictionary input fails closed")
        let dictUser = APIClient.decodeUser([
            "ownerId": "owner_9", "email": "e@x.dev",
        ] as Any)
        XCTAssertEqual(dictUser?.id, "owner_9")
    }
}
