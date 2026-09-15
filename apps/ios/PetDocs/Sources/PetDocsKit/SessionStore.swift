import Foundation
import Security

/// The persisted sign-in state: the session bearer token for
/// `Authorization: Bearer` + the user it belongs to.
public struct Session: Equatable, Codable, Sendable {
    public let bearerToken: String
    public let user: User

    public init(bearerToken: String, user: User) {
        self.bearerToken = bearerToken
        self.user = user
    }
}

// MARK: - Storage abstraction

/// Persistence boundary for `Session`. Abstracted so unit tests run against
/// `InMemorySessionStore` and only the (device-only) Keychain path remains
/// for simulator/device verification.
public protocol SessionStoring: Sendable {
    func load() -> Session?
    func save(_ session: Session)
    func clear()
}

/// Thread-safe in-memory store for tests and previews.
public final class InMemorySessionStore: SessionStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var stored: Session?

    public init() {}

    public func load() -> Session? {
        lock.withLock { stored }
    }

    public func save(_ session: Session) {
        lock.withLock { stored = session }
    }

    public func clear() {
        lock.withLock { stored = nil }
    }
}

/// Keychain-backed store. One generic-password item holds the JSON-encoded
/// session. Accessibility is `ThisDeviceOnly`: the session token never
/// leaves the device via backups — a fresh device simply signs in again
/// (magic link, no password to migrate).
public final class KeychainSessionStore: SessionStoring, Sendable {
    private let service: String

    public init(service: String = "dev.seridian.petdocs.session") {
        self.service = service
    }

    private static let account = "session"

    public func load() -> Session? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else {
            // errSecItemNotFound is the normal signed-out state.
            return nil
        }
        // A corrupted payload is treated as signed-out and removed, never
        // surfaced as a crash.
        guard let session = try? JSONDecoder().decode(Session.self, from: data) else {
            clear()
            return nil
        }
        return session
    }

    public func save(_ session: Session) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        // Upsert: update when present, add when missing (errSecItemNotFound
        // on a fresh install is the expected "add" trigger).
        let update: [String: Any] = [kSecValueData as String: data]
        let updateStatus = SecItemUpdate(baseQuery() as CFDictionary, update as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var add = baseQuery()
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            _ = SecItemAdd(add as CFDictionary, nil)
        }
    }

    public func clear() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: Self.account,
        ]
    }
}

// MARK: - Observable facade

/// Single source of truth for signed-in state, mirroring the portal's
/// `AuthState.session` but backed by the Keychain instead of UserDefaults.
/// `@MainActor` because SwiftUI reads it from the main thread; the storage
/// boundary itself is `Sendable`.
@MainActor
public final class SessionStore: ObservableObject {
    @Published public private(set) var session: Session?

    private let storage: SessionStoring

    public init(storage: SessionStoring = KeychainSessionStore()) {
        self.storage = storage
        session = storage.load()
    }

    public var isSignedIn: Bool {
        session != nil
    }

    public func signIn(_ session: Session) {
        storage.save(session)
        self.session = session
    }

    public func signOut() {
        storage.clear()
        self.session = nil
    }
}
