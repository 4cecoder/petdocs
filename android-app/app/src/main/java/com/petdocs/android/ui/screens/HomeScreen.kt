package com.petdocs.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.Pet
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.ReminderItem
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Dashboard home: greeting + pet cards + due-soon reminders.
 * Mirrors web `src/app/dashboard/page.tsx`.
 */
@Composable
fun HomeScreen(
    onPet: (String) -> Unit,
    onDocs: () -> Unit,
    onReminders: () -> Unit,
    api: PetdocsApi? = null,
    ownerId: String? = null,
) {
    var pets by remember { mutableStateOf(emptyList<Pet>()) }
    var dueSoon by remember { mutableStateOf(emptyList<ReminderItem>()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // Dashboard greeting data: pets:listByOwner + reminders:listByOwner(upcomingOnly).
    // Null api/ownerId keeps the warm empty states (previews, signed-out).
    LaunchedEffect(api, ownerId) {
        if (api == null || ownerId == null) {
            pets = emptyList()
            dueSoon = emptyList()
            loading = false
            return@LaunchedEffect
        }
        loading = true
        error = null
        try {
            pets = api.listPets(ownerId)
            dueSoon = api.listReminders(ownerId, upcomingOnly = true)
        } catch (e: Exception) {
            error = e.message ?: "Couldn't load your pets"
        } finally {
            loading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Good morning 🐾",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Button(
                onClick = { /* TODO(api): open add-pet flow (pets:create) */ },
                modifier = Modifier.heightIn(min = 48.dp),
            ) {
                Text("+ Add pet")
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "Your pets",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground,
            )
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
                        text = error ?: "Something went wrong",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }
            if (pets.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(text = "🐾", style = MaterialTheme.typography.displaySmall)
                        Text(
                            text = "Your pets will appear here.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = "Add your first pet to create its vault.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            } else {
                pets.forEach { pet ->
                    PetHomeCard(
                        pet = pet,
                        dueCount = dueSoon.count { it.petId == pet.id },
                        onClick = { onPet(pet.id) },
                    )
                }
            }
            OutlinedButton(
                onClick = onDocs,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
            ) {
                Text("📄 Browse the document vault")
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Due soon",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                TextButton(
                    onClick = onReminders,
                    modifier = Modifier.heightIn(min = 48.dp),
                ) {
                    Text("View all")
                }
            }
            if (dueSoon.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Text(
                        text = "No upcoming reminders. Boosters and meds will show up here.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            } else {
                dueSoon.take(3).forEach { reminder ->
                    DueSoonRow(reminder = reminder, onClick = onReminders)
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
    }
}

@Composable
private fun PetHomeCard(
    pet: Pet,
    dueCount: Int,
    onClick: () -> Unit,
) {
    val dotColor = if (dueCount > 0) {
        MaterialTheme.colorScheme.tertiary
    } else {
        MaterialTheme.colorScheme.primary
    }
    val statusText = if (dueCount > 0) "$dueCount due soon" else "All clear"
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "🐾", style = MaterialTheme.typography.headlineSmall)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = pet.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = listOfNotNull(
                        pet.species,
                        pet.breed?.takeIf { it.isNotBlank() },
                    ).joinToString(" · "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(dotColor),
                    )
                    Text(
                        text = " $statusText",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun DueSoonRow(
    reminder: ReminderItem,
    onClick: () -> Unit,
) {
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(text = "⏰", style = MaterialTheme.typography.titleLarge)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = reminder.title.ifBlank { "Reminder" },
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = formatHomeDate(reminder.dueAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private fun formatHomeDate(millis: Long): String {
    if (millis <= 0L) return "Due soon"
    return SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(Date(millis))
}
