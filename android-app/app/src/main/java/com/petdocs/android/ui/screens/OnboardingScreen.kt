package com.petdocs.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.validatePetName
import com.petdocs.android.ui.components.PetMood
import com.petdocs.android.ui.components.PetMoodArt
import com.petdocs.android.ui.components.Stepper
import kotlinx.coroutines.launch

/** Species choices — mirrors web `PET_SPECIES` in `src/lib/validators.ts`. */
private val ONBOARDING_SPECIES = listOf("dog", "cat", "bird", "rabbit", "reptile", "other")

private val ONBOARDING_STEPS = listOf("Your pet", "First doc", "All set")

/**
 * 3-step onboarding wizard. Mirrors web `src/app/onboarding/page.tsx`
 * (pet → doc → done, resumable, skippable, goal <3 minutes).
 *
 * Step 0 creates the pet via `pets:create` when [api]/[ownerId] are set;
 * without a backend it advances locally (same TODO as web). Step 1 advances
 * on upload-tap or skip (real picker → `documents:generateUploadUrl → POST →
 * `documents:create` is still TODO, like web). Step 2 calls [onDone].
 *
 * @param onDone called when the user taps "Go to dashboard".
 * @param api optional backend client — null advances locally, no network.
 * @param ownerId optional owner id — null behaves like [api] == null.
 * Both trailing + defaulted so nav can call `OnboardingScreen(onDone = …)`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(
    onDone: () -> Unit,
    api: PetdocsApi? = null,
    ownerId: String? = null,
) {
    var step by remember { mutableStateOf(0) }
    var petName by remember { mutableStateOf("") }
    var species by remember { mutableStateOf(ONBOARDING_SPECIES.first()) }
    var speciesExpanded by remember { mutableStateOf(false) }
    var touched by remember { mutableStateOf(false) }
    var createdPetId by remember { mutableStateOf<String?>(null) }
    var creating by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val nameProblem = remember(petName) { validatePetName(petName) }
    val displayName = petName.trim().ifBlank { "Your pet" }

    fun goBack() {
        if (step > 0) step -= 1
    }

    fun handlePetContinue() {
        touched = true
        if (validatePetName(petName) != null || creating) return
        if (api == null || ownerId == null || createdPetId != null) {
            // No backend (preview) or pet already created — advance locally.
            // TODO(convex): createdPetId is null here; step 1 upload stays a stub.
            step = 1
            return
        }
        creating = true
        error = null
        scope.launch {
            try {
                createdPetId = api.createPet(
                    ownerId = ownerId,
                    name = petName.trim(),
                    species = species,
                )
                step = 1
            } catch (e: Exception) {
                error = e.message ?: "Couldn't create your pet"
            } finally {
                creating = false
            }
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
        Stepper(current = step, labels = ONBOARDING_STEPS)

        when (step) {
            0 -> {
                PetMoodArt(mood = PetMood.HAPPY, size = 88.dp)
                Text("Add your first pet", style = MaterialTheme.typography.headlineSmall)
                Text(
                    "Takes less than 3 minutes.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = petName,
                    onValueChange = { petName = it },
                    label = { Text("Pet's name") },
                    placeholder = { Text("Mochi") },
                    singleLine = true,
                    isError = touched && nameProblem != null,
                    supportingText = {
                        if (touched && nameProblem != null) {
                            Text(nameProblem, color = MaterialTheme.colorScheme.error)
                        } else {
                            Text("Photo comes later. Name and species is enough for now.")
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                ExposedDropdownMenuBox(
                    expanded = speciesExpanded,
                    onExpandedChange = { speciesExpanded = !speciesExpanded },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    OutlinedTextField(
                        value = species.replaceFirstChar { it.uppercase() },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Species") },
                        trailingIcon = {
                            ExposedDropdownMenuDefaults.TrailingIcon(speciesExpanded)
                        },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                    )
                    ExposedDropdownMenu(
                        expanded = speciesExpanded,
                        onDismissRequest = { speciesExpanded = false },
                    ) {
                        ONBOARDING_SPECIES.forEach { option ->
                            DropdownMenuItem(
                                text = {
                                    Text(option.replaceFirstChar { it.uppercase() })
                                },
                                onClick = {
                                    species = option
                                    speciesExpanded = false
                                },
                            )
                        }
                    }
                }
                if (error != null) {
                    Text(
                        error ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                    )
                }
                Button(
                    onClick = ::handlePetContinue,
                    enabled = nameProblem == null && !creating,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                ) {
                    Text(if (creating) "Saving…" else "Continue")
                }
            }

            1 -> {
                PetMoodArt(mood = PetMood.CAMERA, size = 88.dp)
                Text("Snap your first doc", style = MaterialTheme.typography.headlineSmall)
                Text(
                    "A rabies certificate is perfect.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(
                    onClick = {
                        // TODO(convex): real doc picker → documents:generateUploadUrl
                        // → POST → documents:create for createdPetId, then advance.
                        step = 2
                    },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
                ) {
                    Column(horizontalAlignment = Alignment.Start) {
                        Text("Upload a document")
                        Text(
                            "Photo or PDF, under 10MB",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
                OutlinedButton(
                    onClick = { step = 2 },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
                ) {
                    Column(horizontalAlignment = Alignment.Start) {
                        Text("Skip for now")
                        Text(
                            "Do this later",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
                Text(
                    "Skippable. Pick up where you left off.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
                TextButton(
                    onClick = ::goBack,
                    modifier = Modifier.heightIn(min = 48.dp),
                ) {
                    Text("← Back")
                }
            }

            else -> {
                PetMoodArt(mood = PetMood.ROCKET, size = 88.dp)
                Text("You're set!", style = MaterialTheme.typography.headlineSmall)
                Text(
                    "$displayName has a vault. Share the passport or add a reminder next.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = onDone,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                ) {
                    Text("Go to dashboard")
                }
                Text(
                    "Add a reminder later from the dashboard.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
