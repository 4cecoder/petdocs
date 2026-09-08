import SwiftUI

// Dashboard home: greeting plus pet cards plus due soon.
// Offline (api or ownerId nil) shows warm demo states, no network.

struct HomeView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil
    var onPet: (String) -> Void = { _ in }
    var onDocs: () -> Void = {}
    var onReminders: () -> Void = {}

    @State private var pets: [Pet] = []
    @State private var due: [ReminderItem] = []
    @State private var loading = false
    @State private var error: String? = nil

    private var wired: Bool { api != nil && !(ownerId ?? "").isEmpty }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                HStack {
                    Text("Good morning 🐾").font(.title2.bold())
                    Spacer()
                }
                .padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Your pets")
                    if loading {
                        ProgressView().frame(maxWidth: .infinity).tint(Color.brandTeal)
                    }
                    if let error {
                        Text(error).font(.body).foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16).background(.white).cornerRadius(16)
                    }
                    if !wired || pets.isEmpty {
                        ArtEmptyState(
                            mood: .happy,
                            title: "Your pets will appear here.",
                            bodyText: "Add your first pet to create its vault."
                        )
                    } else {
                        ForEach(pets) { pet in
                            Button { onPet(pet.id) } label: {
                                HStack(spacing: 12) {
                                    PetMoodArt(mood: .happy, size: 48)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(pet.name).font(.headline).foregroundStyle(.primary)
                                        Text([pet.species, pet.breed ?? ""].filter { !$0.isEmpty }.joined(separator: " · "))
                                            .font(.subheadline).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    let n = due.filter { $0.petId == pet.id }.count
                                    Text(n > 0 ? "\(n) due soon" : "All clear")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                .padding(16)
                                .background(.white).cornerRadius(16)
                            }
                            .frame(minHeight: 44)
                        }
                    }
                    Button("Browse the document vault", action: onDocs)
                        .buttonStyle(.bordered)
                        .tint(Color.brandTeal)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Due soon", actionLabel: "View all", onAction: onReminders)
                    if due.isEmpty {
                        Text("No upcoming reminders. Boosters and meds will show up here.")
                            .font(.body).foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16).background(.white).cornerRadius(16)
                    } else {
                        ForEach(due.prefix(3)) { r in
                            Button(action: onReminders) {
                                HStack(spacing: 12) {
                                    Text("⏰").font(.title2)
                                    VStack(alignment: .leading) {
                                        Text(r.title.isEmpty ? "Reminder" : r.title)
                                            .font(.subheadline.bold()).foregroundStyle(.primary)
                                        Text(shortDay(r.dueAt)).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                }
                                .padding(.horizontal, 16).padding(.vertical, 12)
                                .background(.white).cornerRadius(16)
                            }
                            .frame(minHeight: 44)
                        }
                    }
                }
                .padding(.horizontal, 16)
                Spacer(minLength: 8)
            }
            .padding(.vertical, 16)
        }
        .background(Color.cream.opacity(0.4))
        .navigationTitle("Home")
        .task(id: ownerId) {
            guard let api, let ownerId, !ownerId.isEmpty else {
                pets = []
                due = []
                loading = false
                return
            }
            loading = true
            error = nil
            do {
                pets = try await api.listPets(ownerId: ownerId)
                due = try await api.listReminders(ownerId: ownerId)
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
}
