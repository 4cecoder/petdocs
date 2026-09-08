import SwiftUI

// Global filterable doc list with pet chips plus category chips.
// Offline shows warm empty state, no network.

struct DocsView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil

    @State private var pets: [Pet] = []
    @State private var docs: [VaultDoc] = []
    @State private var selectedPetId: String? = nil
    @State private var selectedCategory: DocCategory? = nil
    @State private var loading = false
    @State private var error: String? = nil

    private var wired: Bool { api != nil && !(ownerId ?? "").isEmpty }

    var filtered: [VaultDoc] {
        var list = docs
        if let c = selectedCategory {
            list = list.filter { $0.category == c }
        }
        return list.sorted { $0.createdAt > $1.createdAt }
    }

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Documents").font(.title2.bold())
                Spacer()
            }
            .padding(.horizontal, 16)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip("All pets", selected: selectedPetId == nil) { selectedPetId = nil }
                    ForEach(pets) { p in
                        chip(p.name, selected: selectedPetId == p.id) { selectedPetId = p.id }
                    }
                }
                .padding(.horizontal, 16)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip("All types", selected: selectedCategory == nil) { selectedCategory = nil }
                    ForEach(DocCategory.allCases, id: \.self) { c in
                        chip(c.rawValue.replacingOccurrences(of: "_", with: " "), selected: selectedCategory == c) {
                            selectedCategory = c
                        }
                    }
                }
                .padding(.horizontal, 16)
            }

            if loading { ProgressView().tint(Color.brandTeal) }
            if let error {
                Text(error).foregroundStyle(.red).font(.body).padding(.horizontal, 16)
            }

            ScrollView {
                if filtered.isEmpty {
                    ArtEmptyState(
                        mood: .camera,
                        title: "Nothing here yet",
                        bodyText: "No documents yet. Snap a photo of a vaccine cert to get started."
                    )
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(filtered) { d in
                            HStack(spacing: 12) {
                                Text(d.mime.contains("pdf") ? "📕" : "🖼️").font(.title2)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(d.name).font(.subheadline.bold())
                                    Text("\(d.category.rawValue.replacingOccurrences(of: "_", with: " ")) · \(shortDate(d.createdAt))")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .padding(12).background(.white).cornerRadius(16)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                }
            }
        }
        .padding(.top, 16)
        .background(Color.cream.opacity(0.4))
        .navigationTitle("Docs")
        .task(id: ownerId) {
            guard let api, let ownerId, !ownerId.isEmpty else {
                pets = []
                docs = []
                loading = false
                return
            }
            loading = true
            error = nil
            do {
                let loadedPets = try await api.listPets(ownerId: ownerId)
                pets = loadedPets
                let targets: [Pet]
                if let selectedPetId {
                    targets = loadedPets.filter { $0.id == selectedPetId }
                } else {
                    targets = loadedPets
                }
                var all: [VaultDoc] = []
                for p in targets {
                    all += try await api.listDocs(ownerId: ownerId, petId: p.id, category: nil)
                }
                docs = all.sorted { $0.createdAt > $1.createdAt }
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
        .onChange(of: selectedPetId) { _, _ in
            Task { await reloadDocs() }
        }
    }

    private func chip(_ label: String, selected: Bool, tap: @escaping () -> Void) -> some View {
        Button(label, action: tap)
            .buttonStyle(.borderedProminent)
            .tint(selected ? Color.brandTeal : Color.cream)
            .foregroundStyle(selected ? .white : .primary)
            .frame(minHeight: 44)
    }

    private func reloadDocs() async {
        guard let api, let ownerId, !ownerId.isEmpty else { return }
        do {
            if let selectedPetId {
                docs = try await api.listDocs(ownerId: ownerId, petId: selectedPetId, category: nil)
            } else {
                let loadedPets = try await api.listPets(ownerId: ownerId)
                var all: [VaultDoc] = []
                for p in loadedPets {
                    all += try await api.listDocs(ownerId: ownerId, petId: p.id, category: nil)
                }
                docs = all.sorted { $0.createdAt > $1.createdAt }
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
