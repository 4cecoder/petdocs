import SwiftUI

// Care alert inbox: due soon vaccines plus reminders.
// Offline shows the all caught up state, no network.

struct NotificationsView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil

    @State private var reminders: [ReminderItem] = []
    @State private var dueVaccines: [Vaccination] = []
    @State private var petNames: [String: String] = [:]
    @State private var loading = false
    @State private var error: String? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Notifications").font(.title2.bold())
                    Text(unread > 0 ? "\(unread) unread" : "You are all caught up on alerts.")
                        .font(.body).foregroundStyle(.secondary)
                }
                if loading { ProgressView().tint(Color.brandTeal) }
                if let error {
                    Text(error).foregroundStyle(.red).font(.body)
                }
                if !loading && error == nil && unread == 0 {
                    ArtEmptyState(
                        mood: .clock,
                        title: "All caught up.",
                        bodyText: "Passport views, reminders, claims, mail, and transfers will show up here."
                    )
                }
                if !dueVaccines.isEmpty {
                    SectionHeader(title: "Due soon")
                    ForEach(dueVaccines) { v in
                        let display = vaccineStatus(dueAt: v.dueAt, status: v.status)
                        VStack(alignment: .leading, spacing: 6) {
                            VaccineBadge(status: display)
                            Text(v.vaccineName.isEmpty ? "Vaccine" : v.vaccineName).font(.subheadline.bold())
                            Text("\(petNames[v.petId] ?? "Your pet") · \(shortDate(v.dueAt))")
                                .font(.caption).foregroundStyle(.secondary)
                            Text("Manage vaccines from the pet profile. Marking doses given stays web first for now.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12).background(.white).cornerRadius(16)
                    }
                }
                if !reminders.isEmpty {
                    SectionHeader(title: "Reminders")
                    ForEach(reminders) { item in
                        HStack(spacing: 8) {
                            VStack(alignment: .leading) {
                                Text(item.title.isEmpty ? "Reminder" : item.title).font(.subheadline.bold())
                                Text("\(petNames[item.petId] ?? "Your pet") · \(shortDay(item.dueAt))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Done") {
                                Task { await done(item) }
                            }
                            .frame(minHeight: 44)
                        }
                        .padding(.horizontal, 12).padding(.vertical, 4)
                        .background(.white).cornerRadius(16)
                    }
                }
                if unread > 0 {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Where these come from").font(.headline)
                        Text("Server side alerts live in the web feed. This inbox shows your actionable care alerts. Background checks run every 15 minutes.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16).background(.white).cornerRadius(16)
                }
            }
            .padding(16)
        }
        .background(Color.cream.opacity(0.4))
        .navigationTitle("Notifications")
        .task(id: ownerId) {
            guard let api, let ownerId, !ownerId.isEmpty else {
                reminders = []
                dueVaccines = []
                petNames = [:]
                loading = false
                return
            }
            loading = true
            error = nil
            do {
                let pets = try await api.listPets(ownerId: ownerId)
                petNames = Dictionary(uniqueKeysWithValues: pets.map { ($0.id, $0.name) })
                reminders = try await api.listReminders(ownerId: ownerId)
                dueVaccines = try await api.dueSoon(ownerId: ownerId)
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }

    private var unread: Int { reminders.count + dueVaccines.count }

    private func done(_ item: ReminderItem) async {
        guard let api, let ownerId, !ownerId.isEmpty else { return }
        do {
            _ = try await api.setReminder(ownerId: ownerId, reminderId: item.id, status: "done")
            reminders.removeAll { $0.id == item.id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
