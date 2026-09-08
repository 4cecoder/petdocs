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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.ui.components.ArtEmptyState
import com.petdocs.android.ui.components.ErrorBox
import com.petdocs.android.ui.components.LoadingSpinner
import com.petdocs.android.ui.components.PetMood

private data class AdminCounts(
    val pets: Int = 0,
    val docs: Int = 0,
    val reminders: Int = 0,
    val activeLinks: Int = 0,
)

/**
 * Staff hub (view-only). Mirrors web `src/app/dashboard/admin/page.tsx`.
 *
 * Honest scope: `PetdocsApi` has no `admin:*` / `staff:*` bindings, so the
 * mobile app cannot verify staff role (`staff:myStaffRole`), read global
 * stats (`admin:stats`), list owners/links/audit, or perform destructive ops
 * (`admin:setRole`, `admin:revokeAnyLink`, `admin:lockPet`). This screen is a
 * view-only hub built from the owner-scoped queries the app CAN call
 * (`pets:listByOwner`, `documents:listByPet`, `reminders:listByOwner`,
 * `shareLinks:listByPet`) plus deep-link pointers to the web admin for
 * everything destructive. Gating is display-only via [ownerEmail]: without a
 * signed-in email it shows the same "Internal only" gate as web.
 *
 * @param api optional backend client — null shows zeroed counts, no network.
 * @param ownerId optional owner id — null behaves like [api] == null.
 * @param ownerEmail optional signed-in email — null/blank shows the gate.
 * All trailing + defaulted so nav can call `AdminScreen()`.
 */
@Composable
fun AdminScreen(
    api: PetdocsApi? = null,
    ownerId: String? = null,
    ownerEmail: String? = null,
) {
    var counts by remember { mutableStateOf(AdminCounts()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadKey by remember { mutableStateOf(0) }

    // Retry re-runs the loader below (suspend calls can't live in onRetry).
    fun requestReload() {
        if (api == null || ownerId == null) {
            counts = AdminCounts()
            error = null
            loading = false
        } else {
            reloadKey += 1
        }
    }

    LaunchedEffect(api, ownerId, reloadKey) {
        if (api == null || ownerId == null) {
            counts = AdminCounts()
            loading = false
            return@LaunchedEffect
        }
        loading = true
        error = null
        try {
            val pets = api.listPets(ownerId)
            var docs = 0
            var activeLinks = 0
            pets.forEach { pet ->
                docs += api.listDocs(ownerId, pet.id).size
                activeLinks += api.listShareLinks(ownerId, pet.id).count { it.isActive }
            }
            val reminders = api.listReminders(ownerId, upcomingOnly = true).size
            counts = AdminCounts(
                pets = pets.size,
                docs = docs,
                reminders = reminders,
                activeLinks = activeLinks,
            )
        } catch (e: Exception) {
            error = e.message ?: "Couldn't load admin overview"
        } finally {
            loading = false
        }
    }

    if (ownerEmail.isNullOrBlank()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ArtEmptyState(
                mood = PetMood.SIREN,
                title = "Internal only.",
                body = "This area is for the PetDocs team. Your vault is safe and sound.",
            )
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Product admin", style = MaterialTheme.typography.headlineSmall)
            Text(
                "Hi team. Small tools, handled with care. View-only on mobile — " +
                    "signed in as $ownerEmail.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (loading) LoadingSpinner()

        if (error != null) {
            ErrorBox(message = error ?: "Something went wrong", onRetry = ::requestReload)
        }

        Text("Your vault at a glance", style = MaterialTheme.typography.titleMedium)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            AdminStatTile(label = "Pets", value = counts.pets, modifier = Modifier.weight(1f))
            AdminStatTile(label = "Docs", value = counts.docs, modifier = Modifier.weight(1f))
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            AdminStatTile(
                label = "Active links",
                value = counts.activeLinks,
                modifier = Modifier.weight(1f),
            )
            AdminStatTile(
                label = "Reminders",
                value = counts.reminders,
                modifier = Modifier.weight(1f),
            )
        }
        Text(
            "Owner-scoped counts only — global totals (owners, all docs, audit) " +
                "need admin:stats, which has no mobile binding yet.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Web-first admin ops", style = MaterialTheme.typography.titleSmall)
                AdminWebOnlyRow(
                    title = "Roles & team access",
                    reason = "admin:setRole + staff:* need server-side RBAC + audit; " +
                        "never grant from a device. Use /dashboard/admin → Team access.",
                )
                AdminWebOnlyRow(
                    title = "Revoke any link & pet lock",
                    reason = "admin:revokeAnyLink / admin:lockPet are destructive and " +
                        "audit-logged. Use /dashboard/admin → Share link safety / Pet lock.",
                )
                AdminWebOnlyRow(
                    title = "Audit log, inbox & integrations",
                    reason = "admin:auditLog, team mail, and API keys/secrets stay in " +
                        "the browser. Use /dashboard/admin, /dashboard/admin/mail, " +
                        "/dashboard/admin/integrations.",
                )
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text("Open on web", style = MaterialTheme.typography.titleSmall)
                Text(
                    "/dashboard/admin · /dashboard/admin/mail · " +
                        "/dashboard/admin/integrations",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Deep links open in the browser until the app has admin:* " +
                        "bindings + verified staff role.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun AdminStatTile(
    label: String,
    value: Int,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier.heightIn(min = 48.dp)) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                "$value",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun AdminWebOnlyRow(
    title: String,
    reason: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.bodyMedium)
        Text(
            reason,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
