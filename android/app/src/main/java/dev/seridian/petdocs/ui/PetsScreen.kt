package dev.seridian.petdocs.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.seridian.petdocs.data.AppUiState
import dev.seridian.petdocs.data.Pet

/**
 * Read-only pets list from GET /api/me (#24). The Android beta is a
 * companion app — adding/editing pets happens on the web dashboard.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PetsScreen(
    state: AppUiState.SignedIn,
    onOpenPet: (String) -> Unit,
    onRefresh: () -> Unit,
    onSignOut: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("PetDocs") },
                actions = {
                    IconButton(
                        onClick = onRefresh,
                        modifier = Modifier.semantics { contentDescription = "Refresh" },
                    ) {
                        Icon(Icons.Filled.Refresh, contentDescription = null)
                    }
                    IconButton(onClick = onSignOut) {
                        Icon(Icons.Filled.Settings, contentDescription = "Sign out")
                    }
                },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding)) {
            Text(
                text = state.me.email,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            when {
                state.refreshing && state.me.pets.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        androidx.compose.material3.CircularProgressIndicator()
                    }
                }
                state.me.pets.isEmpty() -> EmptyPets(state.petError)
                else -> PetList(state, onOpenPet)
            }
        }
    }
}

@Composable
private fun EmptyPets(error: String?) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("No pets yet", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            text = error
                ?: "Add your pets from the web dashboard — they will show up here instantly.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

@Composable
private fun PetList(state: AppUiState.SignedIn, onOpenPet: (String) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(state.me.pets, key = { it.id }) { pet ->
            PetCard(pet) { onOpenPet(pet.id) }
        }
        state.petError?.let { error ->
            item {
                Text(
                    text = error,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@Composable
private fun PetCard(pet: Pet, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .semantics { contentDescription = "Pet ${pet.name}" },
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(pet.name, style = MaterialTheme.typography.titleMedium)
                Text(
                    text = listOfNotNull(
                        pet.species.replaceFirstChar { it.uppercase() },
                        pet.breed,
                        pet.weightKg?.let { "${it}kg" },
                    ).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Icon(
                Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}
