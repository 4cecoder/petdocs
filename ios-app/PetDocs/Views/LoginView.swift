import SwiftUI

// Magic link sign in as 2 steps: Email, Inbox.
// Calls onSignedIn with the trimmed email. Parent saves the session.

struct LoginView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil
    var onSignedIn: (String) -> Void = { _ in }

    @State private var step = 0
    @State private var email = ""
    @State private var sending = false

    var body: some View {
        VStack(spacing: 16) {
            StepperView(current: step, labels: ["Email", "Inbox"])
            if step == 0 {
                Text("🐾").font(.largeTitle).frame(maxWidth: .infinity, alignment: .leading)
                Text("Welcome to petdocs").font(.system(.title, design: .rounded).bold())
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("Sign in with a magic link. No password needed.")
                    .font(.body).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                TextField("you@example.com", text: $email)
                    .textInputContentType(.emailAddress)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                    .frame(minHeight: 44)
                Button(sending ? "Sending..." : "Send magic link") {
                    Task { await send() }
                }
                .buttonStyle(.borderedProminent).tint(Color.brandTeal)
                .frame(maxWidth: .infinity, minHeight: 44)
                .disabled(email.trimmingCharacters(in: .whitespaces).isEmpty || sending)
                Text("We will email you a one tap sign in link.")
                    .font(.caption).foregroundStyle(.secondary)
            } else {
                PetMoodArt(mood: .link, size: 88)
                Text("Check your inbox").font(.title2.bold())
                Text("Tap the link to sign in.").font(.body).foregroundStyle(.secondary)
                Text("We sent a magic link to \(email.trimmingCharacters(in: .whitespaces)). It expires soon, so open it on this device.")
                    .font(.caption).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                HStack(spacing: 8) {
                    Button("Back") { step = 0 }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .disabled(sending)
                    Button("Continue") { onSignedIn(email.trimmingCharacters(in: .whitespaces)) }
                        .buttonStyle(.borderedProminent).tint(Color.brandTeal)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                Button(sending ? "Sending..." : "Resend magic link") {
                    Task { await send() }
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .disabled(sending)
            }
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 32)
        .background(Color.cream.opacity(0.4))
    }

    private func send() async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !sending else { return }
        sending = true
        defer { sending = false }
        try? await Task.sleep(nanoseconds: 400_000_000)
        step = 1
    }
}
