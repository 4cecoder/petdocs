package com.petdocs.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.ReminderItem
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

private const val WEEK_MILLIS = 7L * 24 * 60 * 60 * 1000

private fun dueLabel(dueAt: Long): String {
    val fmt = SimpleDateFormat("EEE, MMM d", Locale.US)
    return fmt.format(Date(dueAt))
}

/**
 * Chronological due list. Mirrors web `dashboard/reminders/page.tsx`
 * (Overdue / This week / Later groups + warm empty states).
 *
 * @param api optional backend client — null shows the empty groups (same copy
 * as web) without any network call.
 * @param ownerId optional owner id — null also shows the empty groups.
 * Both are trailing + defaulted so nav can call `RemindersScreen()`.
 */
@Composable
fun RemindersScreen(
    api: PetdocsApi? = null,
    ownerId: String? = null,
) {
    var reminders by remember { mutableStateOf<List<ReminderItem>>(emptyList()) }
    var petNames by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    // Null backend → empty groups, matching the web placeholder copy.
    LaunchedEffect(api, ownerId) {
        if (api == null || ownerId == null) {
            reminders = emptyList()
            petNames = emptyMap()
            loading = false
            return@LaunchedEffect
        }
        loading = true
        error = null
        try {
            val pets = api.listPets(ownerId)
            petNames = pets.associate { it.id to it.name }
            reminders = api.listReminders(ownerId, upcomingOnly = true)
        } catch (e: Exception) {
            error = e.message ?: "Couldn't load reminders"
            reminders = emptyList()
        } finally {
            loading = false
        }
    }

    fun removeLocal(id: String) {
        reminders = reminders.filterNot { it.id == id }
    }

    fun onDone(item: ReminderItem) {
        if (api == null || ownerId == null) return
        scope.launch {
            try {
                api.setReminderStatus(ownerId, item.id, "done")
                removeLocal(item.id)
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
                // snoozing dismisses for now — mirrors AppViewModel.snoozeReminder.
                // TODO(reminders): reschedule dueAt once the backend supports it.
                api.setReminderStatus(ownerId, item.id, "dismissed")
                removeLocal(item.id)
            } catch (e: Exception) {
                error = e.message ?: "Couldn't snooze"
            }
        }
    }

    val now = System.currentTimeMillis()
    val overdue = reminders.filter { it.dueAt < now }.sortedBy { it.dueAt }
    val thisWeek = reminders.filter { it.dueAt in now..<now + WEEK_MILLIS }.sortedBy { it.dueAt }
    val later = reminders.filter { it.dueAt >= now + WEEK_MILLIS }.sortedBy { it.dueAt }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Reminders", style = MaterialTheme.typography.headlineSmall)
                Text(
                    "We'll nudge you so nobody misses a treat or a jab. 💛",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Button(
                onClick = { /* TODO(reminders): creation needs a backend mutation first */ },
                modifier = Modifier.heightIn(min = 48.dp),
            ) {
                Text("+ Reminder")
            }
        }

        if (loading) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator()
            }
        }

        if (error != null) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Text(
                    error ?: "Something went wrong",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(16.dp),
                )
            }
        }

        ReminderGroupSection(
            title = "Overdue",
            emptyText = "Nothing overdue. 🎉",
            items = overdue,
            petNames = petNames,
            isOverdueGroup = true,
            onDone = ::onDone,
            onSnooze = ::onSnooze,
        )
        ReminderGroupSection(
            title = "This week",
            emptyText = "Nothing due this week. Nice and calm. 💛",
            items = thisWeek,
            petNames = petNames,
            isOverdueGroup = false,
            onDone = ::onDone,
            onSnooze = ::onSnooze,
        )
        ReminderGroupSection(
            title = "Later",
            emptyText = "Nothing scheduled later. Future-you says thanks! 🐾",
            items = later,
            petNames = petNames,
            isOverdueGroup = false,
            onDone = ::onDone,
            onSnooze = ::onSnooze,
        )
    }
}

@Composable
private fun ReminderGroupSection(
    title: String,
    emptyText: String,
    items: List<ReminderItem>,
    petNames: Map<String, String>,
    isOverdueGroup: Boolean,
    onDone: (ReminderItem) -> Unit,
    onSnooze: (ReminderItem) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        if (items.isEmpty()) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Text(
                    emptyText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else {
            items.forEach { item ->
                ReminderRow(
                    item = item,
                    petName = petNames[item.petId] ?: "Your pet",
                    isOverdue = isOverdueGroup,
                    onDone = { onDone(item) },
                    onSnooze = { onSnooze(item) },
                )
            }
        }
    }
}

@Composable
private fun ReminderRow(
    item: ReminderItem,
    petName: String,
    isOverdue: Boolean,
    onDone: () -> Unit,
    onSnooze: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(
                checked = false,
                onCheckedChange = { if (it) onDone() },
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    item.title.ifBlank { "Reminder" },
                    style = MaterialTheme.typography.bodyLarge,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        petName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        dueLabel(item.dueAt),
                        style = MaterialTheme.typography.bodySmall,
                        color = if (isOverdue) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }
            TextButton(
                onClick = onSnooze,
                modifier = Modifier.heightIn(min = 48.dp),
            ) {
                Text("Snooze")
            }
        }
    }
}
