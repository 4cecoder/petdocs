import SwiftUI

// 3 step onboarding wizard: Your pet, First doc, All set.
// Creates the pet when wired, else advances locally.

struct OnboardingView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil
    var onDone: () -> Void = {}

    @State private var step = 0
    @State private var petName = ""
    @State private var species = "dog"
    @State private var touched = false
    @State private var createdPetId: String? = nil
    @State private var creating = false
    @State private var error: String? = nil

    let speciesOptions = ["dog", "cat", "bird", "rabbit", "reptile", "other"]
    let steps = ["Your pet", "First doc", "All set"]

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                StepperView(current: step, labels: steps)
                if step == 0 {
                    PetMoodArt(mood: .happy, size: 88)
                    Text("Add your first pet").font(.title2.bold())
                    Text("Takes less than 3 minutes.").font(.body).foregroundStyle(.secondary)
                    TextField("Mochi", text: $petName)
                        .textFieldStyle(.roundedBorder)
                        .frame(minHeight: 44)
                    if touched, let problem = validatePetName(petName) {
                        Text(problem).font(.caption).foregroundStyle(.red)
                    } else {
                        Text("Photo comes later. Name and species is enough for now.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Picker("Species", selection: $species) {
                        ForEach(speciesOptions, id: \.self) { s in Text(s.capitalized).tag(s) }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    if let error {
                        Text(error).font(.caption).foregroundStyle(.red)
                    }
                    Button(creating ? "Saving..." : "Continue") {
                        Task { await continueFromPet() }
                    }
                    .buttonStyle(.borderedProminent).tint(Color.brandTeal)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .disabled(validatePetName(petName) != nil || creating)
                } else if step == 1 {
                    PetMoodArt(mood: .camera, size: 88)
                    Text("Snap your first doc").font(.title2.bold())
                    Text("A rabies certificate is perfect.").font(.body).foregroundStyle(.secondary)
                    Button {
                        step = 2
                    } label: {
                        VStack(alignment: .leading) {
                            Text("Upload a document").font(.headline)
                            Text("Photo or PDF, under 10MB").font(.caption)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .frame(minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent).tint(Color.brandTeal)
                    Button {
                        step = 2
                    } label: {
                        VStack(alignment: .leading) {
                            Text("Skip for now").font(.headline)
                            Text("Do this later").font(.caption)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .frame(minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                    .tint(Color.brandTeal)
                    Text("Skippable. Pick up where you left off.")
                        .font(.caption).foregroundStyle(.secondary)
                    Button("Back") { step = 0 }.frame(minHeight: 44)
                } else {
                    PetMoodArt(mood: .rocket, size: 88)
                    Text("You are set!").font(.title2.bold())
                    Text("\(displayName()) has a vault. Share the passport or add a reminder next.")
                        .font(.body).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Go to dashboard", action: onDone)
                        .buttonStyle(.borderedProminent).tint(Color.brandTeal)
                        .frame(maxWidth: .infinity, minHeight: 44)
                    Text("Add a reminder later from the dashboard.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 32)
        }
        .background(Color.cream.opacity(0.4))
    }

    private func displayName() -> String {
        let t = petName.trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? "Your pet" : t
    }

    private func continueFromPet() async {
        touched = true
        guard validatePetName(petName) == nil, !creating else { return }
        guard let api, let ownerId, !ownerId.isEmpty, createdPetId == nil else {
            step = 1
            return
        }
        creating = true
        error = nil
        defer { creating = false }
        do {
            createdPetId = try await api.createPet(
                ownerId: ownerId,
                name: petName.trimmingCharacters(in: .whitespaces),
                species: species,
                breed: nil
            )
            step = 1
        } catch {
            self.error = error.localizedDescription
        }
    }
}
