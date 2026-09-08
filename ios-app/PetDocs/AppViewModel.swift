import Foundation

// Minimal dashboard state: pets, docs for the selected pet, and the
// owner upcoming reminders. Mirrors Android AppViewModel.
@MainActor
final class AppViewModel: ObservableObject {
    @Published var pets: [Pet] = []
    @Published var docs: [VaultDoc] = []
    @Published var reminders: [ReminderItem] = []
    @Published var loading = false
    @Published var errorMessage: String?
    @Published var selectedPetId: String?

    func selectPet(_ petId: String?) {
        selectedPetId = petId
    }

    func clearError() {
        errorMessage = nil
    }

    // Sequential load: pets first, then docs for the selected (or first)
    // pet, then the owner upcoming reminders.
    func refresh(api: ConvexAPI, ownerId: String) async {
        loading = true
        errorMessage = nil
        defer { loading = false }
        do {
            let pets = try await api.listPets(ownerId: ownerId)
            self.pets = pets
            if selectedPetId == nil || !pets.contains(where: { $0.id == selectedPetId }) {
                selectedPetId = pets.first?.id
            }
            if let petId = selectedPetId {
                docs = try await api.listDocs(ownerId: ownerId, petId: petId)
            } else {
                docs = []
            }
            reminders = try await api.listReminders(ownerId: ownerId, upcomingOnly: true)
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    // Marks a reminder done and drops it from the list.
    func doneReminder(api: ConvexAPI, ownerId: String, reminderId: String) async {
        do {
            _ = try await api.setReminder(ownerId: ownerId, reminderId: reminderId, status: "done")
            reminders.removeAll { $0.id == reminderId }
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
