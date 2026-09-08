import SwiftUI

// Pet profile with segmented tabs: Profile, Timeline, Docs, Share.
// Offline shows placeholders, no network.

struct PetDetailView: View {
    var petId: String
    var api: ConvexAPI? = nil
    var ownerId: String? = nil
    var onShare: () -> Void = {}
    var onUpload: (String) -> Void = { _ in }

    @State private var pet: Pet? = nil
    @State private var docs: [VaultDoc] = []
    @State private var vaccines: [Vaccination] = []
    @State private var visits: [VetVisit] = []
    @State private var meds: [Medication] = []
    @State private var loading = false
    @State private var error: String? = nil
    @State private var tab = 0

    var body: some View {
        VStack(spacing: 12) {
            Picker("Section", selection: $tab) {
                Text("Profile").tag(0)
                Text("Timeline").tag(1)
                Text("Docs").tag(2)
                Text("Share").tag(3)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)

            if loading { ProgressView().tint(Color.brandTeal) }
            if let error {
                Text(error).foregroundStyle(.red).font(.body).padding(.horizontal, 16)
            }

            ScrollView {
                VStack(spacing: 16) {
                    if tab == 0 {
                        HStack(spacing: 16) {
                            PetMoodArt(mood: .happy, size: 80)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(pet?.name ?? "Pet profile").font(.title2.bold())
                                Text(profileSubtitle()).font(.caption).foregroundStyle(.secondary)
                                if let chip = pet?.microchipId, !chip.isEmpty {
                                    Text("Chip \(maskChip(chip))").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                        }
                        .padding(16).background(.white).cornerRadius(16)
                        .padding(.horizontal, 16)
                        if !wired {
                            ArtEmptyState(mood: .sleepy, title: "Sign in to see details.", bodyText: "Profiles, vaccines, and visits live in the vault.")
                        }
                    } else if tab == 1 {
                        SectionHeader(title: "Timeline")
                            .padding(.horizontal, 16)
                        if timelineEntries().isEmpty {
                            ArtEmptyState(mood: .clock, title: "No history yet", bodyText: "Upload your first document and it will show up here.")
                        } else {
                            ForEach(timelineEntries(), id: \.id) { e in
                                HStack(spacing: 12) {
                                    Text(e.emoji).font(.title2)
                                    VStack(alignment: .leading) {
                                        Text(e.title).font(.subheadline.bold())
                                        if !e.detail.isEmpty {
                                            Text(e.detail).font(.caption).foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                }
                                .padding(12).background(.white).cornerRadius(16)
                                .padding(.horizontal, 16)
                            }
                        }
                    } else if tab == 2 {
                        VStack(alignment: .leading, spacing: 8) {
                            Button("Take photo or upload") { onUpload(petId) }
                                .buttonStyle(.borderedProminent).tint(Color.brandTeal)
                                .frame(maxWidth: .infinity, minHeight: 44)
                            Text("PDF or photo, up to 10MB. Saved to this pet vault.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        .padding(16).background(.white).cornerRadius(16)
                        .padding(.horizontal, 16)
                        SectionHeader(title: "Documents").padding(.horizontal, 16)
                        if docs.isEmpty {
                            ArtEmptyState(mood: .camera, title: "Nothing here yet", bodyText: "Snap a photo of a vaccine cert to get started.")
                        } else {
                            ForEach(docs) { d in
                                HStack(spacing: 12) {
                                    Text(d.mime.contains("pdf") ? "📕" : "🖼️").font(.title2)
                                    VStack(alignment: .leading) {
                                        Text(d.name).font(.subheadline.bold())
                                        Text("\(d.category.rawValue.replacingOccurrences(of: "_", with: " ")) · \(shortDate(d.createdAt))")
                                            .font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                }
                                .padding(12).background(.white).cornerRadius(16)
                                .padding(.horizontal, 16)
                            }
                        }
                    } else {
                        VStack(spacing: 8) {
                            Button("Share \(pet?.name ?? "your pet") passport", action: onShare)
                                .buttonStyle(.borderedProminent).tint(Color.brandTeal)
                                .frame(maxWidth: .infinity, minHeight: 44)
                            Text("Read only link for vets, groomers, or boarders. No login needed. Revoke anytime.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        .padding(16).background(.white).cornerRadius(16)
                        .padding(.horizontal, 16)
                    }
                }
                .padding(.bottom, 16)
            }
        }
        .background(Color.cream.opacity(0.4))
        .navigationTitle(pet?.name ?? "Pet")
        .task(id: petId) {
            guard let api, let ownerId, !ownerId.isEmpty else { return }
            loading = true
            error = nil
            do {
                pet = try await api.getPet(ownerId: ownerId, petId: petId)
                docs = try await api.listDocs(ownerId: ownerId, petId: petId, category: nil)
                vaccines = try await api.listVaccinations(ownerId: ownerId, petId: petId)
                visits = try await api.listVisits(ownerId: ownerId, petId: petId)
                meds = try await api.listMedications(ownerId: ownerId, petId: petId)
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }

    private var wired: Bool { api != nil && !(ownerId ?? "").isEmpty }

    private func profileSubtitle() -> String {
        guard let pet else { return "ID: \(petId)" }
        var parts: [String] = [pet.species]
        if let b = pet.breed, !b.isEmpty { parts.append(b) }
        if parts.isEmpty { return "ID: \(petId)" }
        return parts.joined(separator: " · ")
    }

    private struct TL: Hashable {
        let id: String
        let date: Int64
        let emoji: String
        let title: String
        let detail: String
    }

    private func timelineEntries() -> [TL] {
        var out: [TL] = []
        for v in vaccines {
            let d = v.administeredAt ?? v.dueAt ?? v.createdAt
            out.append(TL(id: v.id, date: d, emoji: "💉", title: v.vaccineName, detail: v.provider ?? v.notes ?? ""))
        }
        for vs in visits {
            out.append(TL(id: vs.id, date: vs.visitedAt, emoji: "🏥", title: vs.reason.isEmpty ? "Vet visit" : vs.reason, detail: vs.clinicName ?? vs.vetName ?? vs.diagnosis ?? ""))
        }
        return out.sorted { $0.date > $1.date }
    }
}
