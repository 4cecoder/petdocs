import Foundation

// Lightweight session for the iOS app. Mirrors the Android SessionStore
// shape: the owner email (display plus upload attribution), the Convex
// owners id (required arg for every query), and an optional Convex URL
// override. Stored in the "petdocs" UserDefaults suite.
final class SessionStore: ObservableObject {
    @Published var ownerEmail: String?
    @Published var ownerId: String?
    @Published var convexUrl: String?

    private let defaults: UserDefaults
    private enum Keys {
        static let email = "petdocs_owner_email"
        static let ownerId = "petdocs_owner_id"
        static let convexUrl = "petdocs_convex_url"
    }

    init(defaults: UserDefaults = UserDefaults(suiteName: "petdocs") ?? .standard) {
        self.defaults = defaults
        ownerEmail = defaults.string(forKey: Keys.email)
        ownerId = defaults.string(forKey: Keys.ownerId)
        convexUrl = defaults.string(forKey: Keys.convexUrl)
    }

    var isSignedIn: Bool {
        !(ownerId ?? "").isEmpty
    }

    // Backend URL: per-device override wins, otherwise the build default.
    func resolvedConvexUrl(fallback: String) -> String {
        let override = (convexUrl ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return override.isEmpty ? fallback : override
    }

    func save(email: String?, ownerId: String?) {
        set(Keys.email, email)
        set(Keys.ownerId, ownerId)
        ownerEmail = email
        self.ownerId = ownerId
    }

    func setConvexUrl(_ url: String?) {
        let trimmed = url?.trimmingCharacters(in: .whitespacesAndNewlines)
        set(Keys.convexUrl, (trimmed ?? "").isEmpty ? nil : trimmed)
        convexUrl = (trimmed ?? "").isEmpty ? nil : trimmed
    }

    func clear() {
        defaults.removeObject(forKey: Keys.email)
        defaults.removeObject(forKey: Keys.ownerId)
        defaults.removeObject(forKey: Keys.convexUrl)
        ownerEmail = nil
        ownerId = nil
        convexUrl = nil
    }

    private func set(_ key: String, _ value: String?) {
        if let value, !value.isEmpty {
            defaults.set(value, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }
}
