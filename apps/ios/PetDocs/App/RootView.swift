import PetDocsKit
import SwiftUI

/// Top-level switch: signed in → read-only pet list; signed out → the
/// two-step magic-link flow (SignIn → CheckEmail).
struct RootView: View {
    @ObservedObject var sessions: SessionStore
    @ObservedObject var auth: AuthController

    var body: some View {
        if sessions.isSignedIn {
            PetsView(sessions: sessions, auth: auth)
        } else {
            SignInFlowView(auth: auth)
        }
    }
}

/// Hosts the sign-in steps and owns the ONE deep-link listener: an incoming
/// `petdocs://signin?token=…` (or universal link) verifies right here,
/// wherever the user is in the flow. Mirrors the portal's LoginView
/// `.onReceive(.magicTokenReceived)` pattern.
struct SignInFlowView: View {
    @ObservedObject var auth: AuthController

    @State private var step: Step = .email
    @State private var email = ""
    @State private var errorMessage: String?
    @State private var isBusy = false

    enum Step {
        case email
        case checkInbox
    }

    private var trimmedEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        VStack(spacing: 0) {
            switch step {
            case .email:
                SignInView(
                    email: $email,
                    isBusy: isBusy,
                    errorMessage: errorMessage,
                    onRequest: { Task { await requestCode() } }
                )
            case .checkInbox:
                CheckEmailView(
                    email: trimmedEmail,
                    isBusy: isBusy,
                    errorMessage: errorMessage,
                    onBack: {
                        guard !isBusy else { return }
                        step = .email
                        errorMessage = nil
                    },
                    onResend: { Task { await requestCode() } }
                )
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .signinTokenReceived)) { note in
            guard let token = note.userInfo?["token"] as? String, !token.isEmpty else { return }
            Task { await verifyToken(token) }
        }
    }

    private func requestCode() async {
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }
        do {
            try await auth.requestLink(email: trimmedEmail)
            auth.setPendingEmail(trimmedEmail)
            step = .checkInbox
        } catch let error as AuthUIError {
            errorMessage = error.message
        } catch {
            errorMessage = "Couldn't send the sign-in email. Try again."
        }
    }

    private func verifyToken(_ token: String) async {
        errorMessage = nil
        isBusy = true
        do {
            try await auth.verifyToken(token)
        } catch let error as AuthUIError {
            errorMessage = error.message
        } catch {
            errorMessage = "That sign-in link is invalid or expired. Request a new one."
        }
        isBusy = false
    }
}

// MARK: - Step 1: SignIn

/// Email entry screen. Accessibility identifiers match the UI-test plan in
/// docs/ios-macos-plan.md (portal convention: dotted, stable, never shown).
struct SignInView: View {
    @Binding var email: String
    let isBusy: Bool
    let errorMessage: String?
    let onRequest: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Spacer()
            Text("🐾")
                .font(.largeTitle)
            Text("Welcome to petdocs")
                .font(.system(.title, design: .rounded).bold())
            Text("Sign in with a magic link. No password needed.")
                .font(.body)
                .foregroundStyle(.secondary)

            TextField("you@example.com", text: $email)
                .accessibilityIdentifier("signin.emailField")
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
                .frame(minHeight: 44)
                .onSubmit(onRequest)

            if let errorMessage {
                Text(errorMessage)
                    .accessibilityIdentifier("signin.errorLabel")
                    .foregroundStyle(.red)
                    .font(.footnote)
            }

            if isBusy {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 44)
            } else {
                Button("Send magic link") {
                    onRequest()
                }
                .accessibilityIdentifier("signin.sendButton")
                .buttonStyle(.borderedProminent)
                .tint(Brand.teal)
                .frame(maxWidth: .infinity, minHeight: 44)
                .disabled(email.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            Text("We'll email you a one-tap sign-in link.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 32)
    }
}

// MARK: - Step 2: CheckEmail

/// "Check your inbox" screen — the email is on its way; the actual sign-in
/// completes automatically when the link opens the app (deep link) or is
/// tapped on this device.
struct CheckEmailView: View {
    let email: String
    let isBusy: Bool
    let errorMessage: String?
    let onBack: () -> Void
    let onResend: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("📬")
                .font(.system(size: 72))
            Text("Check your inbox")
                .font(.title2.bold())
            Text("We sent a magic link to \(email). Open it on this device to sign in — it expires soon.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if isBusy {
                ProgressView()
                Text("Opening your link…")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if let errorMessage {
                Text(errorMessage)
                    .accessibilityIdentifier("signin.errorLabel")
                    .foregroundStyle(.red)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 8) {
                Button("Back", action: onBack)
                    .accessibilityIdentifier("signin.backButton")
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity, minHeight: 44)
                Button(isBusy ? "Sending…" : "Resend magic link", action: onResend)
                    .accessibilityIdentifier("signin.resendButton")
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .disabled(isBusy)
            }
            .padding(.top, 8)
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 32)
    }
}

// MARK: - Brand

enum Brand {
    /// petdocs teal — matches the web + Android brand token.
    static let teal = Color(red: 0.13, green: 0.72, blue: 0.63)
}
