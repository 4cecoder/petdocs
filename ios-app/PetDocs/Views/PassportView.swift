import SwiftUI

// Public pet passport. No auth, token only.
// Offline (api nil) shows placeholder with the token, no network.

struct PassportView: View {
    var token: String
    var api: ConvexAPI? = nil

    @State private var payload: PassportPayload? = nil
    @State private var loading = false
    @State private var expired = false
    @State private var error: String? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text("🐾").font(.largeTitle)
                Text("petdocs passport").font(.caption).foregroundStyle(.secondary)
                Text(payload?.pet.name.isEmpty == false ? payload!.pet.name : "Shared pet profile")
                    .font(.title.bold())
                Text(passportSubtitle())
                    .font(.body).foregroundStyle(.secondary)
                Text("Link: \(token)").font(.caption).foregroundStyle(.secondary)

                if loading { ProgressView().tint(Color.brandTeal) }
                if let error {
                    Text(error).foregroundStyle(.red).font(.body)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16).background(.white).cornerRadius(16)
                }
                if expired {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("This link expired or was revoked.").font(.headline)
                        Text("Ask the owner for a fresh passport link.")
                            .font(.body).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16).background(.white).cornerRadius(16)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Vaccinations").font(.headline)
                    let lines = payload?.vaccinations ?? []
                    if lines.isEmpty {
                        Text("Verified records will appear here once the owner connects the vault.")
                            .font(.body).foregroundStyle(.secondary)
                    } else {
                        ForEach(lines.indices, id: \.self) { i in
                            let line = lines[i]
                            HStack(spacing: 12) {
                                VaccineBadge(status: line.status)
                                VStack(alignment: .leading) {
                                    Text(line.vaccineName.isEmpty ? "Vaccine" : line.vaccineName)
                                        .font(.subheadline.bold())
                                    Text(vaccineLineDetail(line)).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .frame(minHeight: 44)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16).background(.white).cornerRadius(16)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Documents").font(.headline)
                    let docs = payload?.documents ?? []
                    if docs.isEmpty {
                        Text("Shared documents appear here (never the full vault).")
                            .font(.body).foregroundStyle(.secondary)
                    } else {
                        ForEach(docs, id: \.id) { d in
                            HStack(spacing: 12) {
                                Text("📄").font(.body)
                                VStack(alignment: .leading) {
                                    Text(d.name.isEmpty ? "Document" : d.name).font(.body)
                                    Text(d.category.rawValue).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .frame(minHeight: 44)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16).background(.white).cornerRadius(16)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Owner contact").font(.headline)
                    Text("Shared contact details appear here (never the full vault).")
                        .font(.body).foregroundStyle(.secondary)
                    Text("Heads up: this link may expire or be revoked at any time.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16).background(.white).cornerRadius(16)

                Text("Powered by petdocs. Own your pet docs.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding(24)
        }
        .background(Color.cream.opacity(0.4))
        .navigationTitle("Passport")
        .task(id: token) {
            guard let api else {
                payload = nil
                loading = false
                return
            }
            loading = true
            error = nil
            expired = false
            do {
                guard let resolved = try await api.resolvePassport(token: token) else {
                    expired = true
                    loading = false
                    return
                }
                payload = resolved
                _ = try? await api.recordView(token: token)
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }

    private func passportSubtitle() -> String {
        guard let p = payload else { return "A read only peek shared with love." }
        var s = p.pet.species.isEmpty ? "Beloved pet" : p.pet.species
        if let b = p.pet.breed, !b.isEmpty { s += " · \(b)" }
        return s
    }

    private func vaccineLineDetail(_ line: VaccineLine) -> String {
        switch line.status {
        case .administered: return "Given \(shortDate(line.administeredAt))"
        case .due: return "Due \(shortDate(line.dueAt))"
        case .overdue: return "Overdue since \(shortDate(line.dueAt))"
        case .waived: return "Waived by vet"
        }
    }
}
