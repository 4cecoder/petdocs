import PetDocsKit
import SwiftUI

@main
struct PetDocsApp: App {
    @StateObject private var sessions: SessionStore
    @StateObject private var auth: AuthController

    init() {
        let storage = KeychainSessionStore()
        // E2E-only hook (mirrors the portal's `-e2eResetDefaults`): UI tests
        // launch with this argument so every run starts signed out. Clearly
        // marked test-only — never set in production.
        if CommandLine.arguments.contains("-e2eResetSession") {
            storage.clear()
        }
        let store = SessionStore(storage: storage)
        _sessions = StateObject(wrappedValue: store)
        _auth = StateObject(wrappedValue: AuthController(
            api: APIClient(),
            sessions: store
        ))
    }

    var body: some Scene {
        WindowGroup {
            RootView(sessions: sessions, auth: auth)
                // App-link entry, normalized through AppLink.parse (ONE code
                // path for both transports): the custom scheme
                // petdocs://signin?token=… (works on personal teams today)
                // and universal links https://petdocs.seridian.dev/signin?token=…
                // (paid-team entitlement + AASA — milestone M3).
                .onOpenURL { url in
                    route(AppLink.parse(url: url))
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    route(AppLink.parse(url: activity.webpageURL))
                }
        }
    }

    /// Hands a parsed sign-in token to whichever screen is up via
    /// `.signinTokenReceived` (the portal's notification pattern) — the app
    /// entry stays the single router and owns no auth logic.
    private func route(_ link: AppLink?) {
        guard case let .signInToken(token) = link else { return }
        NotificationCenter.default.post(
            name: .signinTokenReceived,
            object: nil,
            userInfo: ["token": token]
        )
    }
}
