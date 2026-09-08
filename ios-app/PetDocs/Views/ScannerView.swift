import SwiftUI
import PhotosUI
import UIKit

// Photo picker plus category plus upload to the vault.
// Offline (api, ownerId, or petId nil) shows demo state, no network.

struct ScannerView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil
    var petId: String? = nil
    var onDone: () -> Void = {}

    @State private var pickerItem: PhotosPickerItem? = nil
    @State private var imageData: Data? = nil
    @State private var preview: Image? = nil
    @State private var name = "Vaccine certificate"
    @State private var category: DocCategory = .other
    @State private var uploading = false
    @State private var error: String? = nil
    @State private var pets: [Pet] = []
    @State private var chosenPetId: String? = nil

    private var wiredUpload: Bool {
        api != nil && !(ownerId ?? "").isEmpty && (petId ?? chosenPetId) != nil
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text("Scan a document").font(.title2.bold()).frame(maxWidth: .infinity, alignment: .leading)
                Text("A rabies certificate is perfect. PDF or photo, up to 10MB.")
                    .font(.body).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if let preview {
                    preview.resizable().scaledToFit().frame(maxHeight: 220).cornerRadius(16)
                } else {
                    ArtEmptyState(mood: .camera, title: "Pick a photo", bodyText: "Choose from your library. It stays on device until you upload.")
                }

                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Text("Choose photo").frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)
                .tint(Color.brandTeal)

                if pets.count > 1 && petId == nil {
                    Picker("Pet", selection: $chosenPetId) {
                        Text("Select pet").tag(nil as String?)
                        ForEach(pets) { p in Text(p.name).tag(p.id as String?) }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, minHeight: 44)
                }

                TextField("Document name", text: $name)
                    .textFieldStyle(.roundedBorder)
                    .frame(minHeight: 44)

                Picker("Category", selection: $category) {
                    ForEach(DocCategory.allCases, id: \.self) { c in
                        Text(c.rawValue.replacingOccurrences(of: "_", with: " ")).tag(c)
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, minHeight: 44)

                if let error {
                    Text(error).font(.caption).foregroundStyle(.red)
                }

                Button(uploading ? "Uploading..." : "Upload") {
                    Task { await upload() }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.brandTeal)
                .frame(maxWidth: .infinity, minHeight: 44)
                .disabled(imageData == nil || uploading || name.trimmingCharacters(in: .whitespaces).isEmpty)

                if !wiredUpload {
                    Text("Sign in and pick a pet to enable upload. Your photo stays local for now.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(16)
        }
        .background(Color.cream.opacity(0.4))
        .navigationTitle("Scanner")
        .task(id: ownerId) {
            guard let api, let ownerId, !ownerId.isEmpty else { return }
            do {
                pets = try await api.listPets(ownerId: ownerId)
                if chosenPetId == nil { chosenPetId = petId ?? pets.first?.id }
            } catch {
                self.error = error.localizedDescription
            }
        }
        .onChange(of: pickerItem) { _, _ in
            Task {
                guard let item = pickerItem else { return }
                do {
                    if let data = try await item.loadTransferable(type: Data.self) {
                        imageData = data
                        if let ui = UIImage(data: data) {
                            preview = Image(uiImage: ui)
                        }
                        error = nil
                    }
                } catch {
                    self.error = "Could not load that photo. Try another."
                }
            }
        }
    }

    private func upload() async {
        guard let data = imageData else { return }
        guard !uploading else { return }
        let mime = "image/jpeg"
        if let problem = validateDocUpload(mime: mime, sizeBytes: Int64(data.count)) {
            error = problem
            return
        }
        guard let api, let ownerId, !ownerId.isEmpty else {
            error = "Sign in to upload. Photo is ready when you are."
            return
        }
        guard let targetPet = petId ?? chosenPetId else {
            error = "Pick a pet first."
            return
        }
        uploading = true
        defer { uploading = false }
        do {
            _ = try await api.uploadDocument(
                ownerId: ownerId,
                petId: targetPet,
                name: name.trimmingCharacters(in: .whitespaces),
                doc: data,
                mime: mime,
                category: category,
                uploadedBy: ownerId
            )
            onDone()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
