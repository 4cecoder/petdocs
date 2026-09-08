import SwiftUI

// Pet grid plus AddPetFlowView sheet (2 steps: Name, Details).
// Offline shows warm empty state, no network.

struct PetsView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil
    var onPet: (String) -> Void = { _ in }

    @State private var pets: [Pet] = []
    @State private var loading = false
    @State private var error: String? = nil
    @State private var showAdd = false

    private var wired: Bool { api != nil && !(ownerId ?? "").isEmpty }

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Pets").font(.title2.bold())
                Spacer()
                Button("+ Add pet") { showAdd = true }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.brandTeal)
                    .frame(minHeight: 44)
            }
            .padding(.horizontal, 16)
            if loading {
                ProgressView().tint(Color.brandTeal)
            }
            if let error {
                Text(error).foregroundStyle(.red).font(.body).padding(.horizontal, 16)
            }
            if pets.isEmpty {
                ArtEmptyState(
                    mood: .happy,
                    title: "No pets yet.",
                    bodyText: "Add your first pet to create its vault.",
                    ctaLabel: "Add your first pet",
                    onCta: { showAdd = true }
                )
            } else {
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(pets) { pet in
                            Button { onPet(pet.id) } label: {
                                VStack(alignment: .leading, spacing: 8) {
                                    PetMoodArt(mood: .happy, size: 56)
                                    Text(pet.name).font(.headline).foregroundStyle(.primary)
                                    Text([pet.species, pet.breed ?? ""].filter { !$0.isEmpty }.joined(separator: " · "))
                                        .font(.caption).foregroundStyle(.secondary)
                                    VaccineBadge(status: .administered)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(16)
                                .background(.white).cornerRadius(16)
                            }
                            .frame(minHeight: 44)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                }
            }
            Spacer()
        }
        .padding(.top, 16)
        .background(Color.cream.opacity(0.4))
        .navigationTitle("Pets")
        .sheet(isPresented: $showAdd) {
            NavigationStack {
                AddPetFlowView(api: api, ownerId: ownerId, onDone: {
                    showAdd = false
                })
            }
        }
        .task(id: ownerId) {
            guard let api, let ownerId, !ownerId.isEmpty else {
                pets = []
                loading = false
                return
            }
            loading = true
            error = nil
            do {
                pets = try await api.listPets(ownerId: ownerId)
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
}
