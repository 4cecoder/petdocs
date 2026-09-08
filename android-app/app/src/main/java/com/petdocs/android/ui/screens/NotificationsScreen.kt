package com.petdocs.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.ReminderItem
import com.petdocs.android.data.Vaccination
import com.petdocs.android.data.vaccineStatusFor
import com.petdocs.android.ui.components.ArtEmptyState
import com.petdocs.android.ui.components.ErrorBox
import com.petdocs.android.ui.components.LoadingSpinner
import com.petdocs.android.ui.components.PetMood
import com.petdocs.android.ui.components.ReminderRow
import com.petdocs.android.ui.components.SectionHeader
import com.petdocs.android.ui.components.VaccineBadge
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

private fun notificationDueLabel(dueAt: Long): String {
    if (dueAt <= 0L) return "Due soon"
    return SimpleDateFormat("EEE, MMM d", Locale.US).format(Date(dueAt))
}

/**
 * Care-alert inbox. Mirrors web `src/app/dashboard/notifications/page.tsx`.
 *
 * Honest scope: `PetdocsApi` has no `notifications:*` bindings (the web
 * `notifications` table — passport views, claims, mail, transfers — is only
 * reachable via web `convexHttp`), so this screen surfaces what the mobile
 * backend CAN see: vaccinations `dueSoon` + owner reminders
 * (`reminders:listByOwner`). Marking a reminder done uses
 * `reminders:setStatus`; vaccines have no mobile `markAdministered` binding,
 * so they link out to the pet profile instead of mutating.
 *
 * Background delivery still comes from [ReminderPollWorker] (15-minute
 * WorkManager poll, no FCM in MVP) — this screen is the readable inbox.
 *
 * @param api optional backend client — null shows the "all caught up" empty
 * state, no network.
 * @param ownerId optional owner id — null behaves like [api] == null.
 * Both trailing + defaulted so nav can call `NotificationsScreen()`.
 */
@Composable
fun NotificationsScreen(
    api: PetdocsApi? = null,
    ownerId: String? = null,
) {
    var reminders by remember { mutableStateOf<List<ReminderItem>>(emptyList()) }
    var dueVaccines by remember { mutableStateOf<List<Vaccination>>(emptyList()) }
    var petNames by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun load() {
        if (api == null || ownerId == null) {
            reminders = emptyList()
            dueVaccines = emptyList()
            petNames = emptyMap()
            loading = false
            return
        }
        scope.launch {
            loading = true
            error = null
            try {
                petNames = api.listPets(ownerId).associate { it.id to it.name }
                reminders = api.listReminders(ownerId, upcomingOnly = true)
                    .sortedBy { it.dueAt }
                dueVaccines = api.dueSoon(ownerId)
                    .sortedBy { it.dueAt ?: Long.MAX_VALUE }
            } catch (e: Exception) {
                error = e.message ?: "Couldn't load notifications"
                reminders = emptyList()
                dueVaccines = emptyList()
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(api, ownerId) { load() }

    fun removeReminderLocal(id: String) {
        reminders = reminders.filterNot { it.id == id }
    }

    fun onDone(item: ReminderItem) {
        if (api == null || ownerId == null) return
        scope.launch {
            try {
                api.setReminderStatus(ownerId, item.id, "done")
                removeReminderLocal(item.id)
            } catch (e: Exception) {
                error = e.message ?: "Couldn't mark done"
            }
        }
    }

    fun onSnooze(item: ReminderItem) {
        if (api == null || ownerId == null) return
        scope.launch {
            try {
                // Backend has no snooze mutation (only done/dismissed), so
                // snoozing dismisses for now — mirrors RemindersScreen.
                // TODO(reminders): reschedule dueAt once the backend supports it.
                api.setReminderStatus(ownerId, item.id, "dismissed")
                removeReminderLocal(item.id)
            } catch (e: Exception) {
                error = e.message ?: "Couldn't snooze"
            }
        }
    }

    val unread = reminders.size + dueVaccines.size
    val now = System.currentTimeMillis()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Notifications", style = MaterialTheme.typography.headlineSmall)
            Text(
                if (unread > 0) "$unread unread" else "You are all caught up on alerts.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (loading) LoadingSpinner()

        if (error != null) {
            ErrorBox(message = error ?: "Something went wrong", onRetry = ::load)
        }

        if (!loading && error == null && unread == 0) {
            ArtEmptyState(
                mood = PetMood.CLOCK,
                title = "All caught up.",
                body = "Passport views, reminders, claims, mail, and transfers will show up here.",
            )
        }

        if (dueVaccines.isNotEmpty()) {
            SectionHeader(title = "Due soon")
            dueVaccines.forEach { vaccine ->
                val status = vaccineStatusFor(vaccine.dueAt, vaccine.status)
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        VaccineBadge(status = status)
                        Text(
                            vaccine.vaccineName.ifBlank { "Vaccine" },
                            style = MaterialTheme.typography.titleSmall,
                        )
                        Text(
                            "${petNames[vaccine.petId] ?: "Your pet"} · " +
                                notificationDueLabel(vaccine.dueAt ?: 0L),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            "Manage vaccines from the pet profile — " +
                                "marking doses given stays web-first for now.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        if (reminders.isNotEmpty()) {
            SectionHeader(title = "Reminders")
            reminders.forEach { item ->
                ReminderRow(
                    title = item.title.ifBlank { "Reminder" },
                    pet = petNames[item.petId] ?: "Your pet",
                    due = notificationDueLabel(item.dueAt),
                    overdue = item.dueAt < now,
                    onDone = { onDone(item) },
                    onSnooze = { onSnooze(item) },
                )
            }
        }

        if (unread > 0) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text("Where these come from", style = MaterialTheme.typography.titleSmall)
                    Text(
                        "Server-side alerts (passport views, claims, mail, transfers) " +
                            "live in the web notifications feed — this inbox shows " +
                            "your actionable care alerts. Background checks run " +
                            "every 15 minutes.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            "Signed-out preview shows the same empty state — " +
                                "sign in to load your alerts.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
