import SwiftUI

// Add pet in 2 steps: Name, Details.
// Offline (api or ownerId nil) finishes locally with no network.

struct AddPetFlowView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil
    var onDone: () -> Void = {}

    @State private var step = 0
    @State private var name = ""
    @State private var species = "dog"
    @State private var breed = ""
    @State private var creating = false
    @State private var formError: String? = nil
    @Environment(\.dismiss) private var dismiss

    let speciesOptions = ["dog", "cat", "bird", "rabbit", "reptile", "other"]

    var body: some View {
        VStack(spacing: 16) {
            StepperView(current: step, labels: ["Name", "Details"])
            if step == 0 {
                Text("Name your pet").font(.title2.bold())
                Text("What do we call them?").font(.body).foregroundStyle(.secondary)
                TextField("Biscuit", text: $name)
                    .textFieldStyle(.roundedBorder)
                    .frame(minHeight: 44)
                if let msg = validatePetName(name), !name.isEmpty {
                    Text(msg).font(.caption).foregroundStyle(.red)
                }
                if let formError {
                    Text(formError).font(.caption).foregroundStyle(.red)
                }
                HStack(spacing: 8) {
                    Button("Cancel") { onDone() }
                        .buttonStyle(.bordered).frame(maxWidth: .infinity, minHeight: 44)
                    Button("Continue") { step = 1 }
                        .buttonStyle(.borderedProminent).tint(Color.brandTeal)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .disabled(validatePetName(name) != nil)
                }
            } else {
                Text("Pet details").font(.title2.bold())
                Text("A little more about \(name.trimmingCharacters(in: .whitespaces).isEmpty ? "your pet" : name.trimmingCharacters(in: .whitespaces)).")
                    .font(.body).foregroundStyle(.secondary)
                Picker("Species", selection: $species) {
                    ForEach(speciesOptions, id: \.self) { s in
                        Text(s.capitalized).tag(s)
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, minHeight: 44)
                TextField("Breed (optional)", text: $breed)
                    .textFieldStyle(.roundedBorder)
                    .frame(minHeight: 44)
                if let formError {
                    Text(formError).font(.caption).foregroundStyle(.red)
                }
                HStack(spacing: 8) {
                    Button("Back") { step = 0 }
                        .buttonStyle(.bordered).frame(maxWidth: .infinity, minHeight: 44)
                        .disabled(creating)
                    Button(creating ? "Adding..." : "Add pet") {
                        Task { await handleCreate() }
                    }
                    .buttonStyle(.borderedProminent).tint(Color.brandTeal)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .disabled(creating)
                }
            }
            Spacer()
        }
        .padding(16)
        .navigationTitle("Add pet")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func handleCreate() async {
        if let problem = validatePetName(name) {
            formError = problem
            step = 0
            return
        }
        guard !creating else { return }
        creating = true
        formError = nil
        defer { creating = false }
        guard let api, let ownerId, !ownerId.isEmpty else {
            onDone()
            return
        }
        do {
            let trimmedBreed = breed.trimmingCharacters(in: .whitespaces)
            _ = try await api.createPet(
                ownerId: ownerId,
                name: name.trimmingCharacters(in: .whitespaces),
                species: species,
                breed: trimmedBreed.isEmpty ? nil : trimmedBreed
            )
            onDone()
        } catch {
            formError = error.localizedDescription
        }
    }
}
