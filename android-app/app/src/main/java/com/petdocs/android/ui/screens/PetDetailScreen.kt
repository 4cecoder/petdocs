package com.petdocs.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import com.petdocs.android.data.Vaccination
import com.petdocs.android.data.VaultDoc
import com.petdocs.android.data.VetVisit
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Pet profile: header + share + upload + docs + timeline.
 * Mirrors web `src/app/dashboard/pets/[petId]/page.tsx`
 * (TODO(convex): pets.get + documents.listByPet + vaccinations.listByPet).
 */
@Composable
fun PetDetailScreen(
    petId: String,
    onShare: () -> Unit,
    api: PetdocsApi? = null,
    ownerId: String? = null,
) {
    var pet by remember { mutableStateOf<Pet?>(null) }
    var docs by remember { mutableStateOf(emptyList<VaultDoc>()) }
    var vaccinations by remember { mutableStateOf(emptyList<Vaccination>()) }
    var visits by remember { mutableStateOf(emptyList<VetVisit>()) }

    // TODO(api): wire pets:get + documents:listByPet + vaccinations:listByPet + vetVisits:listByPet here.
    LaunchedEffect(api, ownerId, petId) {
        if (api == null || ownerId == null) return@LaunchedEffect
        // Wiring lands separately — warm placeholders show until then.
    }

    val timeline = remember(vaccinations, visits) {
        buildDetailTimeline(vaccinations, visits)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text = "🐾", style = MaterialTheme.typography.displaySmall)
                }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = pet?.name ?: "Pet profile",
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    Text(
                        text = "ID: $petId (wiring lands with Convex)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Button(
                        onClick = onShare,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp),
                    ) {
                        Text("🔗 Share ${pet?.name ?: "your pet"}'s passport")
                    }
                    Text(
                        text = "Read-only link for vets, groomers, or boarders — no login needed. Revoke anytime.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Add a document",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Button(
                            onClick = { /* TODO(api): open camera/upload (documents:generateUploadUrl → documents:create) */ },
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp),
                        ) {
                            Text("📷 Take photo / upload")
                        }
                        Text(
                            text = "PDF or photo, up to 10MB. Saved to this pet's vault.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Documents",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                if (docs.isEmpty()) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        ),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(text = "📸", style = MaterialTheme.typography.displaySmall)
                            Text(
                                text = "Nothing here yet",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                text = "No documents yet — snap a photo of a vaccine cert to get started.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }

        if (docs.isNotEmpty()) {
            items(docs, key = { it.id }) { doc ->
                DetailDocRow(doc = doc)
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Timeline",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                if (timeline.isEmpty()) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        ),
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(text = "📋", style = MaterialTheme.typography.displaySmall)
                            Text(
                                text = "No history yet",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                text = "Upload your first document and it will show up here.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }

        if (timeline.isNotEmpty()) {
            items(timeline, key = { it.id }) { entry ->
                DetailTimelineRow(entry = entry)
            }
        }
    }
}

/** One timeline entry: vaccines and vet visits merged, newest first. */
private data class DetailTimelineEntry(
    val id: String,
    val dateMillis: Long,
    val kind: String,
    val title: String,
    val detail: String?,
)

private fun buildDetailTimeline(
    vaccinations: List<Vaccination>,
    visits: List<VetVisit>,
): List<DetailTimelineEntry> {
    val vaccineEntries = vaccinations.map { v ->
        DetailTimelineEntry(
            id = v.id,
            dateMillis = v.administeredAt ?: v.dueAt ?: v.createdAt,
            kind = "vaccine",
            title = v.vaccineName,
            detail = v.provider ?: v.notes,
        )
    }
    val visitEntries = visits.map { visit ->
        DetailTimelineEntry(
            id = visit.id,
            dateMillis = visit.visitedAt,
            kind = "visit",
            title = visit.reason.ifBlank { "Vet visit" },
            detail = visit.clinicName ?: visit.vetName ?: visit.diagnosis,
        )
    }
    return (vaccineEntries + visitEntries).sortedByDescending { it.dateMillis }
}

private fun detailKindEmoji(kind: String): String = when (kind) {
    "visit" -> "🏥"
    else -> "💉"
}

private fun detailDocEmoji(mime: String): String =
    if (mime.contains("pdf", ignoreCase = true)) "📕" else "🖼️"

private fun formatDetailDate(millis: Long): String {
    if (millis <= 0L) return ""
    return SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(Date(millis))
}

@Composable
private fun DetailDocRow(doc: VaultDoc) {
    Card(
        onClick = { /* TODO(api): open document viewer (documents:getUrl) */ },
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp),
    ) {
        ListItem(
            leadingContent = {
                Text(text = detailDocEmoji(doc.mime), style = MaterialTheme.typography.titleLarge)
            },
            headlineContent = {
                Text(text = doc.name, style = MaterialTheme.typography.titleSmall)
            },
            supportingContent = {
                Text(
                    text = listOfNotNull(
                        doc.category?.value?.replace('_', ' '),
                        formatDetailDate(doc.createdAt).takeIf { it.isNotEmpty() },
                    ).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                )
            },
        )
    }
}

@Composable
private fun DetailTimelineRow(entry: DetailTimelineEntry) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp),
    ) {
        ListItem(
            leadingContent = {
                Text(text = detailKindEmoji(entry.kind), style = MaterialTheme.typography.titleLarge)
            },
            headlineContent = {
                Text(text = entry.title, style = MaterialTheme.typography.titleSmall)
            },
            supportingContent = {
                Column {
                    val date = formatDetailDate(entry.dateMillis)
                    if (date.isNotEmpty()) {
                        Text(text = date, style = MaterialTheme.typography.bodySmall)
                    }
                    entry.detail?.takeIf { it.isNotBlank() }?.let {
                        Text(text = it, style = MaterialTheme.typography.bodySmall)
                    }
                }
            },
        )
    }
}
