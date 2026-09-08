import SwiftUI

// View only staff hub built from owner scoped queries.
// Without an email it shows the internal only gate.

struct AdminView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil
    var ownerEmail: String? = nil

    @State private var petCount = 0
    @State private var docCount = 0
    @State private var reminderCount = 0
    @State private var linkCount = 0
    @State private var loading = false
    @State private var error: String? = nil

    var body: some View {
        ScrollView {
            if (ownerEmail ?? "").trimmingCharacters(in: .whitespaces).isEmpty {
                ArtEmptyState(
                    mood: .sleepy,
                    title: "Internal only.",
                    bodyText: "This area is for the PetDocs team. Your vault is safe and sound."
                )
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Product admin").font(.title2.bold())
                        Text("Hi team. Small tools, handled with care. View only on mobile. Signed in as \(ownerEmail ?? "").")
                            .font(.body).foregroundStyle(.secondary)
                    }
                    if loading { ProgressView().tint(Color.brandTeal) }
                    if let error {
                        Text(error).foregroundStyle(.red).font(.body)
                    }
                    Text("Your vault at a glance").font(.headline)
                    HStack(spacing: 8) {
                        stat("Pets", petCount)
                        stat("Docs", docCount)
                    }
                    HStack(spacing: 8) {
                        stat("Active links", linkCount)
                        stat("Reminders", reminderCount)
                    }
                    Text("Owner scoped counts only. Global totals need admin stats, which has no mobile binding yet.")
                        .font(.caption).foregroundStyle(.secondary)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Web first admin ops").font(.headline)
                        webRow("Roles and team access", "Server side RBAC plus audit. Never grant from a device. Use Team access on web.")
                        webRow("Revoke any link and pet lock", "Destructive and audit logged. Use Share link safety or Pet lock on web.")
                        webRow("Audit log, inbox and integrations", "Browser only. Use the web admin, mail, and integrations pages.")
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16).background(.white).cornerRadius(16)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Open on web").font(.headline)
                        Link("Open web admin", destination: URL(string: "https://petdocs.app/dashboard/admin")!)
                            .frame(minHeight: 44)
                        Text("/dashboard/admin, /dashboard/admin/mail, /dashboard/admin/integrations")
                            .font(.caption).foregroundStyle(.secondary)
                        Text("Deep links open in the browser until the app has admin bindings plus a verified staff role.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16).background(.white).cornerRadius(16)
                }
            }
        }
        .padding(16)
        .background(Color.cream.opacity(0.4))
        .navigationTitle("Admin")
        .task(id: ownerId) {
            guard let api, let ownerId, !ownerId.isEmpty else {
                petCount = 0
                docCount = 0
                reminderCount = 0
                linkCount = 0
                loading = false
                return
            }
            loading = true
            error = nil
            do {
                let pets = try await api.listPets(ownerId: ownerId)
                petCount = pets.count
                var d = 0
                var l = 0
                for p in pets {
                    d += try await api.listDocs(ownerId: ownerId, petId: p.id, category: nil).count
                    l += try await api.listShareLinks(ownerId: ownerId, petId: p.id).filter { $0.isActive }.count
                }
                docCount = d
                linkCount = l
                reminderCount = try await api.listReminders(ownerId: ownerId).count
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }

    private func stat(_ label: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)").font(.title2.bold())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12).background(.white).cornerRadius(16)
    }

    private func webRow(_ title: String, _ reason: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.body.bold())
            Text(reason).font(.caption).foregroundStyle(.secondary)
        }
    }
}
