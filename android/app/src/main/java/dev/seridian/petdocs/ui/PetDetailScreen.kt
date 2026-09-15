package dev.seridian.petdocs.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dev.seridian.petdocs.data.AppUiState
import dev.seridian.petdocs.data.Pet
import java.text.DateFormat
import java.util.Date

/**
 * Read-only pet detail (#24): vitals + recent records from
 * GET /api/pets/{petId}. Nothing here writes — editing stays web-only for
 * the beta.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PetDetailScreen(state: AppUiState.SignedIn, onBack: () -> Unit) {
    val petName = state.petSummary?.pet?.name
        ?: state.me.pets.firstOrNull { it.id == state.selectedPetId }?.name
        ?: "Pet"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(petName) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        when {
            state.petLoading -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
            state.petSummary == null -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        text = state.petError ?: "Couldn't load this pet's records.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            else -> PetDetailContent(state)
        }
    }
}

@Composable
private fun PetDetailContent(state: AppUiState.SignedIn) {
    val summary = state.petSummary ?: return
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            SectionCard(title = "Vitals") {
                VitalRow("Species", summary.pet.species.replaceFirstChar { it.uppercase() })
                summary.pet.breed?.let { VitalRow("Breed", it) }
                summary.pet.sex?.let { VitalRow("Sex", it.replaceFirstChar { c -> c.uppercase() }) }
                summary.pet.weightKg?.let { VitalRow("Weight", "$it kg") }
                summary.pet.birthdate?.let {
                    VitalRow("Born", formatDate(it))
                }
                summary.pet.microchipId?.let { VitalRow("Microchip", it) }
                summary.pet.color?.let { VitalRow("Color", it) }
            }
        }

        if (summary.vaccinations.isNotEmpty()) {
            item {
                SectionCard(title = "Recent vaccinations") {
                    summary.vaccinations.forEachIndexed { index, vac ->
                        if (index > 0) HorizontalDivider()
                        RecordRow(
                            title = vac.vaccineName,
                            subtitle = listOfNotNull(
                                vac.status.replaceFirstChar { it.uppercase() },
                                vac.administeredAt?.let { formatDate(it) },
                                vac.provider,
                            ).joinToString(" · "),
                        )
                    }
                }
            }
        }

        if (summary.visits.isNotEmpty()) {
            item {
                SectionCard(title = "Recent vet visits") {
                    summary.visits.forEachIndexed { index, visit ->
                        if (index > 0) HorizontalDivider()
                        RecordRow(
                            title = visit.reason,
                            subtitle = listOfNotNull(
                                formatDate(visit.visitedAt),
                                visit.clinicName,
                                visit.vetName,
                            ).joinToString(" · "),
                        )
                    }
                }
            }
        }

        if (summary.documents.isNotEmpty()) {
            item {
                SectionCard(title = "Recent documents") {
                    summary.documents.forEachIndexed { index, doc ->
                        if (index > 0) HorizontalDivider()
                        RecordRow(
                            title = doc.name,
                            subtitle = listOfNotNull(
                                doc.category?.replace('_', ' ')?.replaceFirstChar { c -> c.uppercase() },
                                formatBytes(doc.size),
                                formatDate(doc.createdAt),
                            ).joinToString(" · "),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun VitalRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun RecordRow(title: String, subtitle: String) {
    Column(Modifier.padding(vertical = 6.dp)) {
        Text(title, style = MaterialTheme.typography.bodyMedium)
        Text(
            subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

private fun formatDate(epochMs: Long): String =
    DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(epochMs))

private fun formatBytes(bytes: Long): String = when {
    bytes >= 1_048_576 -> "%.1f MB".format(bytes / 1_048_576.0)
    bytes >= 1024 -> "%.0f KB".format(bytes / 1024.0)
    else -> "$bytes B"
}
