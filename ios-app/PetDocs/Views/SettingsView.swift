import SwiftUI

// Account, notifications, export, and sign out.
// Parent clears the session in onSignOut.

struct SettingsView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil
    var ownerEmail: String? = nil
    var onSignOut: () -> Void = {}

    @State private var showConfirm = false

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Text("Settings").font(.title2.bold())
                    .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Account").font(.headline)
                    Text(accountLine()).font(.body).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16).background(.white).cornerRadius(16)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Notifications").font(.headline)
                    Text("Booster and medication reminders arrive here. Background checks run every 15 minutes.")
                        .font(.body).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16).background(.white).cornerRadius(16)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Export").font(.headline)
                    Text("Your vault stays yours. Ask support for a full export and it arrives by email.")
                        .font(.body).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16).background(.white).cornerRadius(16)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Trash").font(.headline)
                    Text("Deleted documents can be restored or permanently emptied from the web vault.")
                        .font(.body).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16).background(.white).cornerRadius(16)

                Button("Sign out") { showConfirm = true }
                    .buttonStyle(.bordered)
                    .tint(Color.brandTeal)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .confirmationDialog("Sign out?", isPresented: $showConfirm, titleVisibility: .visible) {
                        Button("Sign out", role: .destructive, action: onSignOut)
                        Button("Cancel", role: .cancel) {}
                    }
            }
            .padding(16)
        }
        .background(Color.cream.opacity(0.4))
        .navigationTitle("Settings")
    }

    private func accountLine() -> String {
        if let email = ownerEmail, !email.isEmpty {
            return "Signed in as \(email)."
        }
        if let ownerId, !ownerId.isEmpty {
            return "Signed in. Vault is syncing."
        }
        return "Sign in status syncs after login."
    }
}
