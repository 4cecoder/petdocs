package com.petdocs.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.DocUrl
import com.petdocs.android.data.PassportPayload
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.VaccineLine
import com.petdocs.android.data.VaccineStatus
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private fun formatDate(millis: Long?): String {
    if (millis == null) return "—"
    return SimpleDateFormat("MMM d, yyyy", Locale.US).format(Date(millis))
}

private fun dotColor(status: VaccineStatus): Color = when (status) {
    VaccineStatus.ADMINISTERED -> Color(0xFF2E7D32)
    VaccineStatus.DUE -> Color(0xFFF9A825)
    VaccineStatus.OVERDUE -> Color(0xFFC62828)
    VaccineStatus.WAIVED -> Color(0xFF9E9E9E)
}

/**
 * Public pet passport — NO auth, NO dashboard shell.
 * Mirrors web `p/[shareToken]/page.tsx`: pet header + vaccine list with
 * status dots + doc links + expiry note + "Powered by petdocs" footer.
 *
 * Must never leak other pets, owner email, or storageIds — the payload is
 * already a scoped projection from `shareLinks:resolve`.
 *
 * @param token share token from the deep link (`passport/{token}`).
 * @param api optional backend client — null shows a placeholder with the
 * token (no network). Trailing + defaulted so nav keeps working.
 */
@Composable
fun PassportScreen(
    token: String,
    api: PetdocsApi? = null,
) {
    var payload by remember { mutableStateOf<PassportPayload?>(null) }
    var loading by remember { mutableStateOf(false) }
    var expired by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(token, api) {
        if (api == null) {
            // TODO(resolvePassport): call api.resolvePassport(token) (+ recordView)
            // once a client is provided; placeholder below shows the token.
            payload = null
            loading = false
            return@LaunchedEffect
        }
        loading = true
        error = null
        expired = false
        try {
            val resolved = api.resolvePassport(token)
            if (resolved == null) {
                expired = true
            } else {
                payload = resolved
                // Best-effort view count — never blocks the passport itself.
                runCatching { api.recordView(token) }
            }
        } catch (e: Exception) {
            error = e.message ?: "Couldn't open this passport"
        } finally {
            loading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // --- Pet header (public, warm) ---
        Text("🐾", style = MaterialTheme.typography.displaySmall)
        Text(
            "petdocs passport",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        val petName = payload?.pet?.name?.ifBlank { null } ?: "Shared pet profile"
        Text(petName, style = MaterialTheme.typography.headlineMedium)
        val subtitle = payload?.let { p ->
            buildString {
                append(p.pet.species.ifBlank { "Beloved pet" })
                if (!p.pet.breed.isNullOrBlank()) append(" · ${p.pet.breed}")
            }
        } ?: "A read-only peek shared with love 💛"
        Text(
            subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            "Link: $token",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (loading) {
            CircularProgressIndicator()
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

        if (expired) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text("This link has expired or been revoked. 🍂", style = MaterialTheme.typography.titleSmall)
                    Text(
                        "Ask the owner for a fresh passport link — they'll be happy to share.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        // --- Vaccinations with status dots (never color-only: dot + label) ---
        OutlinedCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Vaccinations", style = MaterialTheme.typography.titleMedium)
                val vaccines = payload?.vaccinations ?: emptyList()
                if (vaccines.isEmpty()) {
                    Text(
                        "Verified records will appear here once the owner connects their vault. ✨",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    vaccines.forEach { line ->
                        VaccineRow(line = line)
                    }
                }
            }
        }

        // --- Doc links (scoped projection only — no storageIds, no vault) ---
        OutlinedCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Documents", style = MaterialTheme.typography.titleMedium)
                val docs = payload?.documents ?: emptyList()
                if (docs.isEmpty()) {
                    Text(
                        "Shared documents appear here (never the full vault). 📄",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    docs.forEach { doc ->
                        DocRow(doc = doc)
                    }
                }
            }
        }

        // --- Owner contact placeholder / expiry note ---
        OutlinedCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text("Owner contact", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Shared contact details appear here (never the full vault).",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Heads up: this link may expire or be revoked by the owner at any time. " +
                        "If something looks off, ask them for a fresh one. 💛",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // --- Footer ---
        Text(
            "Powered by petdocs — own your pet's docs.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun VaccineRow(line: VaccineLine) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(dotColor(line.status)),
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(line.vaccineName.ifBlank { "Vaccine" }, style = MaterialTheme.typography.bodyMedium)
            Text(
                when (line.status) {
                    VaccineStatus.ADMINISTERED -> "Given ${formatDate(line.administeredAt)}"
                    VaccineStatus.DUE -> "Due ${formatDate(line.dueAt)}"
                    VaccineStatus.OVERDUE -> "Overdue since ${formatDate(line.dueAt)}"
                    VaccineStatus.WAIVED -> "Waived by vet"
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            line.status.value,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun DocRow(doc: DocUrl) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("📄", style = MaterialTheme.typography.bodyLarge)
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                doc.name.ifBlank { "Document" },
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                doc.category?.value ?: "document",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
