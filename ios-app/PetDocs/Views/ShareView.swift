import SwiftUI
import UIKit

// Owner share link manager: active links plus per pet passport creator
// plus printable apartment packet. Offline shows demo packet.

struct ShareView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil

    @State private var pets: [Pet] = []
    @State private var links: [ShareLink] = []
    @State private var packetVaccines: [Vaccination] = []
    @State private var loading = false
    @State private var error: String? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Shared links").font(.title2.bold())
                    Text("One link per recipient. Revoke one without breaking the others.")
                        .font(.body).foregroundStyle(.secondary)
                }
                if loading { ProgressView().tint(Color.brandTeal) }
                if let error {
                    Text(error).foregroundStyle(.red).font(.body)
                }
                SectionHeader(title: "Active links")
                if links.isEmpty {
                    Text("No active links yet. Create one from a pet profile and it will appear here.")
                        .font(.body).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16).background(.white).cornerRadius(16)
                } else {
                    ForEach(links) { link in
                        let petName = pets.first { $0.id == link.petId }?.name ?? "Your pet"
                        HStack {
                            VStack(alignment: .leading) {
                                Text(link.label?.isEmpty == false ? link.label! : "\(petName) passport")
                                    .font(.subheadline.bold())
                                Text("\(link.scope) · \(link.expiresAt.map { shortDate($0) } ?? "No expiry")")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Revoke") {
                                Task { await revoke(link) }
                            }
                            .frame(minHeight: 44)
                        }
                        .padding(12).background(.white).cornerRadius(16)
                    }
                }

                SectionHeader(title: "Share a passport")
                Text("Pick a pet, choose how long the link lives, then send it with love.")
                    .font(.body).foregroundStyle(.secondary)
                if api == nil || (ownerId ?? "").isEmpty || pets.isEmpty {
                    Text("Sign in to create passport links. Each one is a read only peek, never the full vault.")
                        .font(.body).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16).background(.white).cornerRadius(16)
                } else {
                    ForEach(pets) { pet in
                        ShareCreatorCard(pet: pet, api: api!, ownerId: ownerId!)
                    }
                }

                SectionHeader(title: "Apartment packet")
                Text("A printable pet resume for rental applications.")
                    .font(.body).foregroundStyle(.secondary)
                if let first = pets.first {
                    ApartmentPacketCard(
                        petName: first.name,
                        species: first.species,
                        breed: first.breed,
                        birthdate: first.birthdate,
                        weightKg: first.weightKg,
                        microchipId: first.microchipId,
                        vaccines: packetVaccines
                    )
                } else {
                    ApartmentPacketCard(
                        petName: "Mochi",
                        species: "dog",
                        breed: "Shiba Inu",
                        birthdate: nil,
                        weightKg: 9.0,
                        microchipId: "xxxx1234",
                        vaccines: [],
                        demo: [("Rabies", "valid"), ("DHPP", "valid"), ("Bordetella", "expiring")]
                    )
                }
            }
            .padding(16)
        }
        .background(Color.cream.opacity(0.4))
        .navigationTitle("Share")
        .task(id: ownerId) {
            guard let api, let ownerId, !ownerId.isEmpty else {
                pets = []
                links = []
                return
            }
            loading = true
            error = nil
            do {
                let loaded = try await api.listPets(ownerId: ownerId)
                pets = loaded
                var all: [ShareLink] = []
                for p in loaded {
                    all += try await api.listShareLinks(ownerId: ownerId, petId: p.id)
                }
                links = all.filter { $0.isActive }
                if let first = loaded.first {
                    packetVaccines = try await api.listVaccinations(ownerId: ownerId, petId: first.id)
                }
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }

    private func revoke(_ link: ShareLink) async {
        guard let api, let ownerId, !ownerId.isEmpty else { return }
        do {
            _ = try await api.revokeShareLink(ownerId: ownerId, linkId: link.id)
            links.removeAll { $0.id == link.id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct ExpiryChoice: Hashable {
    let label: String
    let short: String
    let millis: Int64
}

private let expiries: [ExpiryChoice] = [
    ExpiryChoice(label: "24 hours", short: "24h", millis: 24 * 60 * 60 * 1000),
    ExpiryChoice(label: "7 days", short: "7d", millis: 7 * 24 * 60 * 60 * 1000),
    ExpiryChoice(label: "30 days", short: "30d", millis: 30 * 24 * 60 * 60 * 1000),
]

private struct ShareCreatorCard: View {
    var pet: Pet
    var api: ConvexAPI
    var ownerId: String

    @State private var label = ""
    @State private var expiry = expiries[1]
    @State private var creating = false
    @State private var createdUrl: String? = nil
    @State private var error: String? = nil

    private var step: Int {
        if createdUrl != nil { return 2 }
        if !label.trimmingCharacters(in: .whitespaces).isEmpty { return 1 }
        return 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Share \(pet.name) passport").font(.headline)
            StepperView(current: step, labels: ["Who", "Expiry", "Copy"])
            Text("1. Who is this for?").font(.caption.bold())
            TextField("Vet, groomer...", text: $label)
                .textFieldStyle(.roundedBorder)
                .frame(minHeight: 44)
            HStack(spacing: 8) {
                ForEach(["Vet", "Groomer", "Boarder", "Landlord"], id: \.self) { p in
                    Button(p) { label = p }
                        .buttonStyle(.bordered)
                        .frame(minHeight: 44)
                }
            }
            Text("2. How long should it live?").font(.caption.bold())
            Picker("Expiry", selection: $expiry) {
                ForEach(expiries, id: \.self) { e in Text(e.label).tag(e) }
            }
            .pickerStyle(.menu)
            .frame(minHeight: 44)
            Text("3. Copy and send").font(.caption.bold())
            Button(creating ? "Creating..." : "Create and copy link") {
                Task { await create() }
            }
            .buttonStyle(.borderedProminent).tint(Color.brandTeal)
            .frame(maxWidth: .infinity, minHeight: 44)
            .disabled(creating)
            if let createdUrl {
                Text("Ready to send: \(createdUrl)").font(.caption).foregroundStyle(.secondary)
                Button("Copy again") { UIPasteboard.general.string = createdUrl }
                    .frame(minHeight: 44)
            }
            if let error {
                Text(error).font(.caption).foregroundStyle(.red)
            }
        }
        .padding(16).background(.white).cornerRadius(16)
    }

    private func create() async {
        guard !creating else { return }
        creating = true
        error = nil
        defer { creating = false }
        do {
            let trimmed = label.trimmingCharacters(in: .whitespaces)
            let finalLabel = trimmed.isEmpty ? "\(pet.name) passport (\(expiry.short))" : "\(pet.name) passport, \(trimmed) (\(expiry.short))"
            let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
            let result = try await api.createShareToken(
                ownerId: ownerId,
                petId: pet.id,
                scope: "passport",
                label: finalLabel,
                expiresAt: nowMs + expiry.millis
            )
            let url = "https://petdocs.app/p/\(result.token)"
            createdUrl = url
            UIPasteboard.general.string = url
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct ApartmentPacketCard: View {
    var petName: String
    var species: String
    var breed: String?
    var birthdate: Int64?
    var weightKg: Double?
    var microchipId: String?
    var vaccines: [Vaccination]
    var demo: [(String, String)]? = nil

    var rows: [(String, String)] {
        if let demo { return demo }
        let mapped = vaccines.map { v in
            (v.vaccineName, vaccineStatus(dueAt: v.dueAt, status: v.status).rawValue)
        }
        if mapped.isEmpty {
            return [("Rabies", "valid"), ("DHPP", "valid"), ("Bordetella", "expiring")]
        }
        return mapped
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Text("🐾").font(.largeTitle)
                VStack(alignment: .leading) {
                    Text("Pet resume").font(.caption).foregroundStyle(.secondary)
                    Text(petName).font(.title2.bold())
                    Text(([species] + [breed ?? ""].filter { !$0.isEmpty }).joined(separator: " · "))
                        .font(.subheadline).foregroundStyle(.secondary)
                }
            }
            fact("Breed", breed ?? "Not listed")
            fact("Weight", weightKg.map { "\($0) kg" } ?? "Not listed")
            fact("Age", birthdate.map { shortDate($0) } ?? "Ask vet")
            fact("Spay or neuter", "Ask vet")
            fact("Microchip", microchipId?.isEmpty == false ? maskChip(microchipId!) : "Not listed")
            Text("Vaccinations").font(.headline)
            ForEach(rows, id: \.0) { r in
                HStack {
                    Text(r.0).font(.body)
                    Spacer()
                    Text(r.1).font(.caption).foregroundStyle(.secondary)
                }
                .frame(minHeight: 32)
            }
            Text("\(petName) is part of a documented, vaccinated household. Ask the owner for the read only passport link to verify any detail.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .padding(16).background(.white).cornerRadius(16)
    }

    private func fact(_ k: String, _ v: String) -> some View {
        HStack {
            Text(k).font(.caption).foregroundStyle(.secondary)
            Spacer()
            Text(v).font(.body)
        }
    }
}
