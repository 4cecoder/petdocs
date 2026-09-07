package com.petdocs.android.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowDropDown
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.Pet
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.ShareLink
import com.petdocs.android.data.Vaccination
import com.petdocs.android.data.maskChip
import com.petdocs.android.data.vaccineStatusFor
import com.petdocs.android.ui.components.Stepper
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

private const val HOUR_MILLIS = 60L * 60 * 1000
private const val DAY_MILLIS = 24 * HOUR_MILLIS

private data class ExpiryOption(val label: String, val durationMillis: Long) {
    val short: String
        get() = when (durationMillis) {
            24 * HOUR_MILLIS -> "24h"
            7 * DAY_MILLIS -> "7d"
            else -> "30d"
        }
}

private val EXPIRY_OPTIONS = listOf(
    ExpiryOption("24 hours", 24 * HOUR_MILLIS),
    ExpiryOption("7 days", 7 * DAY_MILLIS),
    ExpiryOption("30 days", 30 * DAY_MILLIS),
)

private fun formatExpiry(expiresAt: Long?): String {
    if (expiresAt == null) return "Never expires"
    val fmt = SimpleDateFormat("MMM d, yyyy", Locale.US)
    return "Expires ${fmt.format(Date(expiresAt))}"
}

private fun formatAge(birthdateMillis: Long?): String {
    if (birthdateMillis == null) return "—"
    val born = Calendar.getInstance().apply { timeInMillis = birthdateMillis }
    val now = Calendar.getInstance()
    var months = (now.get(Calendar.YEAR) - born.get(Calendar.YEAR)) * 12 +
        (now.get(Calendar.MONTH) - born.get(Calendar.MONTH))
    if (now.get(Calendar.DAY_OF_MONTH) < born.get(Calendar.DAY_OF_MONTH)) months -= 1
    if (months < 0) return "—"
    if (months < 12) return "$months mo"
    val years = months / 12
    val rem = months % 12
    return if (rem == 0) "$years yr" else "$years yr $rem mo"
}

private fun formatWeight(weightKg: Double?): String {
    if (weightKg == null) return "—"
    val lb = Math.round(weightKg * 2.20462)
    return "$weightKg kg ($lb lb)"
}

/**
 * Owner share-link manager. Mirrors web `dashboard/share/page.tsx`:
 * active links + per-pet passport creator + printable apartment packet.
 *
 * @param api optional backend client — null shows the web empty state
 * ("No active links yet…") plus a demo packet, no network.
 * @param ownerId optional owner id — null behaves like [api] == null.
 * Both trailing + defaulted so nav can call `ShareScreen()`.
 */
@Composable
fun ShareScreen(
    api: PetdocsApi? = null,
    ownerId: String? = null,
) {
    var pets by remember { mutableStateOf<List<Pet>>(emptyList()) }
    var links by remember { mutableStateOf<List<ShareLink>>(emptyList()) }
    var packetVaccines by remember { mutableStateOf<List<Vaccination>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(api, ownerId) {
        if (api == null || ownerId == null) {
            pets = emptyList()
            links = emptyList()
            return@LaunchedEffect
        }
        loading = true
        error = null
        try {
            val loadedPets = api.listPets(ownerId)
            pets = loadedPets
            val all = mutableListOf<ShareLink>()
            loadedPets.forEach { pet ->
                all += api.listShareLinks(ownerId, pet.id)
            }
            links = all.filter { it.isActive }
            // Packet vaccines come from the first pet, like the web demo packet.
            packetVaccines = loadedPets.firstOrNull()?.let { first ->
                api.listVaccinations(ownerId, first.id)
            } ?: emptyList()
        } catch (e: Exception) {
            error = e.message ?: "Couldn't load share links"
        } finally {
            loading = false
        }
    }

    fun onRevoke(link: ShareLink) {
        if (api == null || ownerId == null) return
        scope.launch {
            try {
                api.revokeShareLink(ownerId, link.id)
                links = links.filterNot { it.id == link.id }
            } catch (e: Exception) {
                error = e.message ?: "Couldn't revoke link"
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Shared links", style = MaterialTheme.typography.headlineSmall)
            Text(
                "One link per recipient — revoke one without breaking the others. 💛",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
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

        // --- Active links (label, scope, expiry, Revoke) ---
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Active links", style = MaterialTheme.typography.titleMedium)
            if (links.isEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "No active links yet. Create one from a pet's profile — they'll appear here. 🐾",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            } else {
                links.forEach { link ->
                    val petName = pets.firstOrNull { it.id == link.petId }?.name ?: "Your pet"
                    ShareLinkRow(
                        link = link,
                        petName = petName,
                        onRevoke = { onRevoke(link) },
                    )
                }
            }
        }

        // --- Per-pet passport creator ---
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Share a passport", style = MaterialTheme.typography.titleMedium)
            Text(
                "Pick a pet, choose how long the link lives, then send it with love.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (api == null || ownerId == null || pets.isEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        if (api == null || ownerId == null) {
                            "Sign in to create passport links — each one is a read-only peek, never the full vault."
                        } else {
                            "Add a pet first, then share their passport from here. 🐶"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            } else {
                pets.forEach { pet ->
                    ShareCreatorCard(pet = pet, api = api, ownerId = ownerId)
                }
            }
        }

        // --- Apartment packet (pet resume: breed/weight/age/spay/chip/vaccines) ---
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Apartment packet", style = MaterialTheme.typography.titleMedium)
            Text(
                "A printable pet resume for rental applications.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            val packetPet = pets.firstOrNull()
            if (packetPet != null && api != null && ownerId != null) {
                ApartmentPacketCard(
                    petName = packetPet.name,
                    species = packetPet.species,
                    breed = packetPet.breed,
                    birthdateMillis = packetPet.birthdate,
                    weightKg = packetPet.weightKg,
                    microchipId = packetPet.microchipId,
                    vaccinations = packetVaccines,
                )
            } else {
                // Demo packet mirroring the web SharePage props (Mochi).
                ApartmentPacketCard(
                    petName = "Mochi",
                    species = "dog",
                    breed = "Shiba Inu",
                    birthdateMillis = Calendar.getInstance().apply {
                        set(2021, Calendar.APRIL, 12)
                    }.timeInMillis,
                    weightKg = 9.0,
                    microchipId = "xxxx1234",
                    vaccinations = emptyList(),
                    demoVaccines = listOf(
                        PacketVaccine("Rabies", "valid"),
                        PacketVaccine("DHPP", "valid"),
                        PacketVaccine("Bordetella", "expiring"),
                    ),
                )
            }
        }
    }
}

@Composable
private fun ShareLinkRow(
    link: ShareLink,
    petName: String,
    onRevoke: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    link.label?.ifBlank { null } ?: "$petName's passport",
                    style = MaterialTheme.typography.bodyLarge,
                )
                Text(
                    "${link.scope} · ${formatExpiry(link.expiresAt)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            TextButton(
                onClick = onRevoke,
                modifier = Modifier.heightIn(min = 48.dp),
            ) {
                Text("Revoke")
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ShareCreatorCard(
    pet: Pet,
    api: PetdocsApi,
    ownerId: String,
) {
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var recipientLabel by remember { mutableStateOf("") }
    var expiry by remember { mutableStateOf(EXPIRY_OPTIONS[1]) }
    var expanded by remember { mutableStateOf(false) }
    var creating by remember { mutableStateOf(false) }
    var createdUrl by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    // Visible progress Who → Expiry → Copy.
    val step = when {
        createdUrl != null -> 2
        recipientLabel.isNotBlank() -> 1
        else -> 0
    }
    val presets = listOf("Vet", "Groomer", "Boarder", "Landlord", "Airline")

    OutlinedCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Share ${pet.name}'s passport 🐾", style = MaterialTheme.typography.titleSmall)
            Stepper(current = step, labels = listOf("Who", "Expiry", "Copy"))

            // Step 1 — Who: recipient label + preset chips.
            Text("1 · Who is this for?", style = MaterialTheme.typography.labelLarge)
            OutlinedTextField(
                value = recipientLabel,
                onValueChange = { recipientLabel = it },
                label = { Text("Recipient label") },
                placeholder = { Text("e.g. Vet, groomer…") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                presets.forEach { preset ->
                    AssistChip(
                        onClick = { recipientLabel = preset },
                        label = { Text(preset) },
                    )
                }
            }

            // Step 2 — Expiry dropdown: 24h / 7d / 30d (kept).
            Text("2 · How long should it live?", style = MaterialTheme.typography.labelLarge)
            Box {
                OutlinedButton(
                    onClick = { expanded = true },
                    modifier = Modifier.heightIn(min = 48.dp),
                ) {
                    Text("Lasts ${expiry.label}")
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(Icons.Outlined.ArrowDropDown, contentDescription = null)
                }
                DropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false },
                ) {
                    EXPIRY_OPTIONS.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.label) },
                            onClick = {
                                expiry = option
                                expanded = false
                            },
                        )
                    }
                }
            }

            // Step 3 — Copy (create + clipboard behavior kept).
            Text("3 · Copy + send", style = MaterialTheme.typography.labelLarge)
            Button(
                onClick = {
                    creating = true
                    error = null
                    scope.launch {
                        try {
                            val trimmed = recipientLabel.trim()
                            val finalLabel = if (trimmed.isBlank()) {
                                "${pet.name} passport (${expiry.short})"
                            } else {
                                "${pet.name} passport · $trimmed (${expiry.short})"
                            }
                            val result = api.createShareToken(
                                ownerId = ownerId,
                                petId = pet.id,
                                scope = "passport",
                                label = finalLabel,
                                expiresAt = System.currentTimeMillis() + expiry.durationMillis,
                            )
                            // TODO(baseUrl): pull the public web base URL from
                            // BuildConfig / remote config instead of hardcoding.
                            val url = "https://petdocs.app/p/${result.token}"
                            createdUrl = url
                            // Android clipboard: LocalClipboardManager + Toast.
                            clipboard.setText(AnnotatedString(url))
                            Toast.makeText(context, "Link copied", Toast.LENGTH_SHORT).show()
                        } catch (e: Exception) {
                            error = e.message ?: "Couldn't create link"
                        } finally {
                            creating = false
                        }
                    }
                },
                enabled = !creating,
                modifier = Modifier.heightIn(min = 48.dp).fillMaxWidth(),
            ) {
                Text(if (creating) "Creating…" else "Create + copy link")
            }

            if (createdUrl != null) {
                Text(
                    "Ready to send: $createdUrl",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(
                    onClick = {
                        clipboard.setText(AnnotatedString(createdUrl ?: ""))
                        Toast.makeText(context, "Link copied", Toast.LENGTH_SHORT).show()
                    },
                    modifier = Modifier.heightIn(min = 48.dp),
                ) {
                    Text("Copy again")
                }
            }

            if (error != null) {
                Text(
                    error ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

private data class PacketVaccine(val name: String, val statusLabel: String)

@Composable
private fun ApartmentPacketCard(
    petName: String,
    species: String,
    breed: String?,
    birthdateMillis: Long?,
    weightKg: Double?,
    microchipId: String?,
    vaccinations: List<Vaccination>,
    demoVaccines: List<PacketVaccine>? = null,
) {
    val vaccineRows: List<PacketVaccine> = demoVaccines ?: vaccinations.map { v ->
        val display = vaccineStatusFor(v.dueAt, v.status)
        PacketVaccine(v.vaccineName, display.value)
    }
    // Web packet always shows the demo trio when empty — keep the warmth here too.
    val rows = vaccineRows.ifEmpty {
        listOf(
            PacketVaccine("Rabies", "valid"),
            PacketVaccine("DHPP", "valid"),
            PacketVaccine("Bordetella", "expiring"),
        )
    }
    val chipLabel = if (microchipId.isNullOrBlank()) "Not listed" else maskChip(microchipId)

    OutlinedCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Header: identity.
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("🐾", style = MaterialTheme.typography.headlineMedium)
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        "Pet resume · Rental application",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(petName, style = MaterialTheme.typography.headlineSmall)
                    Text(
                        buildString {
                            append(species)
                            if (!breed.isNullOrBlank()) append(" · $breed")
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // Fact grid: breed / weight / age / spay / microchip-last-4.
            // (Pet has no spay field on Android yet → "Ask vet", like web unknown.)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                PacketFact("Breed", breed ?: "—")
                PacketFact("Weight", formatWeight(weightKg))
                PacketFact("Age", formatAge(birthdateMillis))
                PacketFact("Spay / Neuter", "Ask vet")
                PacketFact("Microchip", chipLabel)
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Vaccinations", style = MaterialTheme.typography.titleSmall)
                rows.forEach { v ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(v.name, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            v.statusLabel,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            Text(
                "$petName is part of a documented, vaccinated household. " +
                    "Ask the owner for the read-only passport link to verify any detail above. 🏠",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Button(
                onClick = {
                    // TODO(print): wire Android PrintManager here —
                    // getSystemService(PrintManager) + WebView/PrintDocumentAdapter
                    // rendering this packet, so the system "Save as PDF" picker
                    // handles output (web uses window.print() instead).
                },
                modifier = Modifier.heightIn(min = 48.dp).fillMaxWidth(),
            ) {
                Text("Save as PDF")
            }
        }
    }
}

@Composable
private fun PacketFact(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}
