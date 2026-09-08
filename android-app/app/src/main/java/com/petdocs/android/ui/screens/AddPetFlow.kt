package com.petdocs.android.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.validatePetName
import com.petdocs.android.ui.components.Stepper
import kotlinx.coroutines.launch

private val ADD_PET_STEPS = listOf("Name", "Details")
private val PET_SPECIES_OPTIONS = listOf("dog", "cat", "bird", "rabbit", "reptile", "other")

/**
 * Full-screen 2 step add pet flow. Mirrors web `src/app/dashboard/pets/page.tsx`
 * wizard (Name with validation, then Details species/breed).
 *
 * Step 1 validates with [validatePetName]. Step 2 calls
 * `pets:create` via [api] when wired, then [onDone].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddPetFlow(
    onDone: () -> Unit,
    api: PetdocsApi? = null,
    ownerId: String? = null,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var step by remember { mutableStateOf(0) }
    var name by remember { mutableStateOf("") }
    var species by remember { mutableStateOf("dog") }
    var breed by remember { mutableStateOf("") }
    var speciesExpanded by remember { mutableStateOf(false) }
    var creating by remember { mutableStateOf(false) }
    var formError by remember { mutableStateOf<String?>(null) }

    val nameProblem = validatePetName(name)

    fun handleCreate() {
        val problem = validatePetName(name)
        if (problem != null) {
            formError = problem
            step = 0
            return
        }
        if (creating) return
        creating = true
        formError = null
        scope.launch {
            try {
                if (api != null && ownerId != null) {
                    api.createPet(
                        ownerId = ownerId,
                        name = name.trim(),
                        species = species,
                        breed = breed.trim().takeIf { it.isNotBlank() },
                    )
                    Toast.makeText(context, "Welcome ${name.trim()}. Vault ready.", Toast.LENGTH_SHORT).show()
                } else {
                    // TODO(api): wire pets:create from nav/session; name is validated.
                    Toast.makeText(context, "Pet saved locally (sync not wired yet)", Toast.LENGTH_SHORT).show()
                }
                onDone()
            } catch (e: Exception) {
                formError = e.message ?: "Could not add pet. Try again."
            } finally {
                creating = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Stepper(current = step, labels = ADD_PET_STEPS)

        if (step == 0) {
            Text(
                text = "Name your pet",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                text = "What do we call them?",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = name,
                onValueChange = {
                    name = it
                    if (formError != null) formError = null
                },
                label = { Text("Name") },
                placeholder = { Text("Biscuit") },
                singleLine = true,
                isError = name.isNotEmpty() && nameProblem != null,
                supportingText = {
                    if (name.isNotEmpty() && nameProblem != null) {
                        Text(text = nameProblem)
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )
            formError?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = onDone,
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp),
                ) {
                    Text("Cancel")
                }
                Button(
                    onClick = { step = 1 },
                    enabled = nameProblem == null,
                    modifier = Modifier
                        .weight(2f)
                        .heightIn(min = 48.dp),
                ) {
                    Text("Continue")
                }
            }
        } else {
            Text(
                text = "Pet details",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                text = "A little more about ${name.trim().ifBlank { "your pet" }}.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            ExposedDropdownMenuBox(
                expanded = speciesExpanded,
                onExpandedChange = { speciesExpanded = !speciesExpanded },
            ) {
                OutlinedTextField(
                    value = species,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Species") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(speciesExpanded) },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth(),
                )
                ExposedDropdownMenu(
                    expanded = speciesExpanded,
                    onDismissRequest = { speciesExpanded = false },
                ) {
                    PET_SPECIES_OPTIONS.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.replaceFirstChar { c -> c.uppercase() }) },
                            onClick = { species = option; speciesExpanded = false },
                        )
                    }
                }
            }
            OutlinedTextField(
                value = breed,
                onValueChange = { breed = it },
                label = { Text("Breed (optional)") },
                placeholder = { Text("Golden retriever") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            formError?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = { step = 0 },
                    enabled = !creating,
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp),
                ) {
                    Text("Back")
                }
                Button(
                    onClick = ::handleCreate,
                    enabled = !creating,
                    modifier = Modifier
                        .weight(2f)
                        .heightIn(min = 48.dp),
                ) {
                    Text(if (creating) "Adding..." else "Add pet")
                }
            }
        }
    }
}
