import PetDocsKit
import SwiftUI

/// Read-only pet list (M2 milestone brings real data via `GET` pet
/// endpoints once the android agent lands them; M1 shows the signed-in
/// shell). Placeholder content keeps navigation + sign-out testable before
/// the data contract exists.
struct PetsView: View {
    @ObservedObject var sessions: SessionStore
    @ObservedObject var auth: AuthController

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Pets will appear here once the mobile read endpoints land (M2).")
                        .foregroundStyle(.secondary)
                }
                Section {
                    signOutRow
                }
            }
            .navigationTitle("Pets")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private var signOutRow: some View {
        Button("Sign out") {
            auth.signOut()
        }
        .accessibilityIdentifier("pets.signOutButton")
        .foregroundStyle(.red)
    }
}

/// Read-only pet detail (M2): identity, breed/sex/age, weight, microchip,
/// color, avatar. No editing — petdocs mobile stays read-only until the
/// write contract exists.
struct PetDetailView: View {
    let pet: Pet

    var body: some View {
        List {
            Section("Identity") {
                row("Species", pet.species.capitalized)
                if let breed = pet.breed { row("Breed", breed) }
                if let sex = pet.sex { row("Sex", sex.capitalized) }
                if let color = pet.color { row("Color", color) }
            }
            Section("Health") {
                if let birthdate = pet.birthdate {
                    row("Born", Self.birthText(from: birthdate))
                }
                if let weightKg = pet.weightKg {
                    row("Weight", String(format: "%.1f kg", weightKg))
                }
                if let microchip = pet.microchipId {
                    row("Microchip", microchip)
                }
            }
        }
        .navigationTitle(pet.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ label: String, _ value: String) -> some View {
        LabeledContent(label, value: value)
    }

    /// `birthdate` is an epoch-milliseconds number in the pets table.
    private static func birthText(from epochMillis: Double) -> String {
        let date = Date(timeIntervalSince1970: epochMillis / 1000)
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
