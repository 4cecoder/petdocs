import SwiftUI

// Chronological due list grouped as Overdue, This week, Later.
// Offline shows empty groups, no network. Done uses setReminder.

struct RemindersView: View {
    var api: ConvexAPI? = nil
    var ownerId: String? = nil

    @State private var reminders: [ReminderItem] = []
    @State private var petNames: [String: String] = [:]
    @State private var loading = false
    @State private var error: String? = nil

    private let weekMs: Int64 = 7 * 24 * 60 * 60 * 1000

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Reminders").font(.title2.bold())
                        Text("We nudge you so nobody misses a treat or a jab.")
                            .font(.body).foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)

                if loading { ProgressView().tint(Color.brandTeal) }
                if let error {
                    Text(error).foregroundStyle(.red).font(.body).padding(.horizontal, 16)
                }

                group("Overdue", items: overdue, empty: "Nothing overdue. Nice work.")
                group("This week", items: thisWeek, empty: "Nothing due this week. Calm ahead.")
                group("Later", items: later, empty: "Nothing scheduled later. Future you says thanks.")
            }
            .padding(.vertical, 16)
        }
        .background(Color.cream.opacity(0.4))
        .navigationTitle("Reminders")
        .task(id: ownerId) {
            guard let api, let ownerId, !ownerId.isEmpty else {
                reminders = []
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
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }

    private var nowMs: Int64 { Int64(Date().timeIntervalSince1970 * 1000) }
    private var overdue: [ReminderItem] {
        reminders.filter { $0.dueAt < nowMs }.sorted { $0.dueAt < $1.dueAt }
    }
    private var thisWeek: [ReminderItem] {
        reminders.filter { $0.dueAt >= nowMs && $0.dueAt < nowMs + weekMs }.sorted { $0.dueAt < $1.dueAt }
    }
    private var later: [ReminderItem] {
        reminders.filter { $0.dueAt >= nowMs + weekMs }.sorted { $0.dueAt < $1.dueAt }
    }

    private func group(_ title: String, items: [ReminderItem], empty: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: title).padding(.horizontal, 16)
            if items.isEmpty {
                Text(empty).font(.body).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16).background(.white).cornerRadius(16)
                    .padding(.horizontal, 16)
            } else {
                ForEach(items) { item in
                    HStack(spacing: 8) {
                        Button {
                            Task { await markDone(item) }
                        } label: {
                            Image(systemName: "circle").font(.title2)
                        }
                        .frame(minWidth: 44, minHeight: 44)
                        .tint(Color.brandTeal)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title.isEmpty ? "Reminder" : item.title).font(.subheadline.bold())
                            HStack(spacing: 8) {
                                Text(petNames[item.petId] ?? "Your pet").font(.caption).foregroundStyle(.secondary)
                                Text(shortDay(item.dueAt)).font(.caption)
                                    .foregroundStyle(item.dueAt < nowMs ? .red : .secondary)
                            }
                        }
                        Spacer()
                        Button("Snooze") {
                            Task { await snooze(item) }
                        }
                        .frame(minHeight: 44)
                        .font(.caption)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(.white).cornerRadius(16)
                    .padding(.horizontal, 16)
                }
            }
        }
    }

    private func markDone(_ item: ReminderItem) async {
        guard let api, let ownerId, !ownerId.isEmpty else { return }
        do {
            _ = try await api.setReminder(ownerId: ownerId, reminderId: item.id, status: "done")
            reminders.removeAll { $0.id == item.id }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func snooze(_ item: ReminderItem) async {
        guard let api, let ownerId, !ownerId.isEmpty else { return }
        do {
            _ = try await api.setReminder(ownerId: ownerId, reminderId: item.id, status: "dismissed")
            reminders.removeAll { $0.id == item.id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
