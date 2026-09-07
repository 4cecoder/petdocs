package com.petdocs.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.VaultDoc
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Global filterable doc list. Mirrors web `src/app/dashboard/docs/page.tsx`
 * (TODO(convex): per-pet queries + category filter).
 */
@Composable
fun DocsScreen(
    api: PetdocsApi? = null,
    ownerId: String? = null,
) {
    var docs by remember { mutableStateOf(emptyList<VaultDoc>()) }
    var selectedPetId by remember { mutableStateOf<String?>(null) }

    // TODO(api): wire per-pet documents:listByPet queries + category filter here.
    LaunchedEffect(api, ownerId, selectedPetId) {
        if (api == null || ownerId == null) return@LaunchedEffect
        // Wiring lands separately — warm empty state shows until then.
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text(
                text = "Documents",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground,
            )
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                    FilterChip(
                        selected = selectedPetId == null,
                        onClick = { selectedPetId = null },
                        label = { Text("All pets") },
                        modifier = Modifier.heightIn(min = 48.dp),
                    )
                }
                // TODO(api): per-pet filter chips once pets:listByOwner is wired.
            }
        }

        if (docs.isEmpty()) {
            item {
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
        } else {
            items(docs, key = { it.id }) { doc ->
                VaultDocRow(doc = doc)
            }
        }
    }
}

private fun vaultDocEmoji(mime: String): String =
    if (mime.contains("pdf", ignoreCase = true)) "📕" else "🖼️"

private fun formatVaultDate(millis: Long): String {
    if (millis <= 0L) return ""
    return SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(Date(millis))
}

@Composable
private fun VaultDocRow(doc: VaultDoc) {
    Card(
        onClick = { /* TODO(api): open document viewer (documents:getUrl) */ },
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp),
    ) {
        ListItem(
            leadingContent = {
                Text(text = vaultDocEmoji(doc.mime), style = MaterialTheme.typography.titleLarge)
            },
            headlineContent = {
                Text(text = doc.name, style = MaterialTheme.typography.titleSmall)
            },
            supportingContent = {
                Text(
                    text = listOfNotNull(
                        doc.category?.value?.replace('_', ' '),
                        formatVaultDate(doc.createdAt).takeIf { it.isNotEmpty() },
                    ).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                )
            },
        )
    }
}
