import PetDocsKit
import SwiftUI

/// Auth orchestration: turns the non-throwing APIClient outcomes into either
/// a persisted session or user-facing copy. Mirrors the portal's `AuthState`
/// (request → verify tail), minus the role fetch — petdocs has no portal
/// roles. Session STATE lives in `SessionStore`; this object only publishes
/// transient busy flags and owns no persisted state.
@MainActor
final class AuthController: ObservableObject {
    private let api: APIClient
    private let sessions: SessionStore

    /// True while a deep-link token is being verified — the sign-in flow
    /// shows a spinner instead of buttons ("Opening your link…").
    @Published var isVerifyingLink = false

    init(api: APIClient, sessions: SessionStore) {
        self.api = api
        self.sessions = sessions
    }

    /// Magic-link step 1. Throws `AuthUIError.requestFailed` with display
    /// copy; the client transport never throws so no other failure exists.
    func requestLink(email: String) async throws {
        let outcome = await api.requestMagicLink(email: email)
        guard outcome.ok else {
            throw AuthUIError.requestFailed(outcome.error ?? "Couldn't send the sign-in email. Try again.")
        }
    }

    /// Magic-link step 2 (deep-link path): verify the token from
    /// `petdocs://signin` / the universal link and persist the session.
    /// Throws `AuthUIError.verifyFailed` with display copy.
    func verifyToken(_ token: String) async throws {
        guard let email = sessions.session?.user.email ?? pendingEmail else {
            throw AuthUIError.verifyFailed(
                "Open the link from the email we sent you — request a new one if it's expired."
            )
        }
        isVerifyingLink = true
        defer { isVerifyingLink = false }
        let outcome = await api.verify(email: email, token: token)
        guard outcome.ok, let token = outcome.token, let user = outcome.user else {
            throw AuthUIError.verifyFailed(outcome.error ?? "That sign-in link is invalid or expired. Request a new one.")
        }
        sessions.signIn(Session(bearerToken: token, user: user))
    }

    /// Email captured on the SignIn screen; kept so a deep link that lands
    /// on a fresh install (no persisted session) still has the address that
    /// requested the link. Set by the sign-in flow, cleared on sign-out.
    var pendingEmail: String?

    func setPendingEmail(_ email: String) {
        pendingEmail = email
    }

    func signOut() {
        pendingEmail = nil
        sessions.signOut()
    }
}

/// User-facing auth errors — every case carries ready-to-display copy.
enum AuthUIError: Error, Equatable {
    case requestFailed(String)
    case verifyFailed(String)

    var message: String {
        switch self {
        case let .requestFailed(message), let .verifyFailed(message):
            return message
        }
    }
}
