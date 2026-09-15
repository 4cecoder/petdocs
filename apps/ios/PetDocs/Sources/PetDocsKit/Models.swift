import Foundation

// Wire models for the petdocs mobile auth HTTP contract.
//
// The contract itself is owned by the Android agent (mobile auth HTTP
// endpoints). iOS designs against the agreed shape:
//   POST /api/auth/request  { email }              → { ok, error? }
//   POST /api/auth/verify   { email, token }       → { ok, token, user, error? }
//   GET  /api/me            Bearer <session token> → { user } | 401
// Field names finalize with the Android client; decoding here is tolerant
// (see APIClient.decode* for the single parsing paths) so small shape
// adjustments never become app-wide changes.

/// The signed-in petdocs owner. `id` is the Convex owners id, needed as the
/// scope argument for every future pets/docs query.
public struct User: Equatable, Codable, Sendable {
    public let id: String
    public let email: String
    public let name: String?

    public init(id: String, email: String, name: String? = nil) {
        self.id = id
        self.email = email
        self.name = name
    }
}

/// A pet as displayed on the read-only Pets / PetDetail screens. Mirrors the
/// `pets` Convex table (docs/04-data-model.md); write-path fields (status,
/// owner) are intentionally absent — the mobile app is read-only in M1–M2.
public struct Pet: Equatable, Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let species: String
    public let breed: String?
    public let sex: String?
    public let birthdate: Double?
    public let weightKg: Double?
    public let microchipId: String?
    public let color: String?
    public let avatarStorageId: String?

    public init(
        id: String,
        name: String,
        species: String,
        breed: String? = nil,
        sex: String? = nil,
        birthdate: Double? = nil,
        weightKg: Double? = nil,
        microchipId: String? = nil,
        color: String? = nil,
        avatarStorageId: String? = nil
    ) {
        self.id = id
        self.name = name
        self.species = species
        self.breed = breed
        self.sex = sex
        self.birthdate = birthdate
        self.weightKg = weightKg
        self.microchipId = microchipId
        self.color = color
        self.avatarStorageId = avatarStorageId
    }
}

// MARK: - Outcomes (non-throwing auth results with user-facing copy)

/// Result of POST /api/auth/request. Server/transport failures surface as
/// `ok: false` + ready-to-display copy; callers never unwrap throws.
public struct RequestLinkOutcome: Equatable, Sendable {
    public let ok: Bool
    public let error: String?

    public init(ok: Bool, error: String? = nil) {
        self.ok = ok
        self.error = error
    }
}

/// Result of POST /api/auth/verify. On success carries the session bearer
/// token + the user, ready to persist via `SessionStore`.
public struct VerifyOutcome: Equatable, Sendable {
    public let ok: Bool
    public let token: String?
    public let user: User?
    public let error: String?

    public init(ok: Bool, token: String? = nil, user: User? = nil, error: String? = nil) {
        self.ok = ok
        self.token = token
        self.user = user
        self.error = error
    }
}

/// Result of GET /api/me. `unauthorized` distinguishes a stale/revoked
/// session (401 → client should sign out) from transport/server failure
/// (retry-able; keep the session).
public struct MeOutcome: Equatable, Sendable {
    public let user: User?
    public let unauthorized: Bool
    public let error: String?

    public init(user: User? = nil, unauthorized: Bool = false, error: String? = nil) {
        self.user = user
        self.unauthorized = unauthorized
        self.error = error
    }
}

/// Friendly transport message: offline codes → offline text, anything else
/// → generic reachability text. Shared by every call site so the app never
/// shows raw URLError descriptions. Mirrors the portal's
/// `ConvexClient.friendlyTransportMessage`.
public enum TransportCopy {
    public static func friendly(for error: Error) -> String {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .timedOut:
                return "You're offline. Check your connection and try again."
            default:
                break
            }
        }
        return "Couldn't reach the server. Check your connection and try again."
    }
}
