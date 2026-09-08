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
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.petdocs.android.data.DocCategory
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.validateDocUpload
import com.petdocs.android.ui.components.Stepper
import kotlinx.coroutines.launch
import java.io.File

private val UPLOAD_STEPS = listOf("Capture", "Details", "Done")

/**
 * Steps 2 to 3 of the upload wizard: preview plus category plus notes plus
 * Upload. Mirrors web `DocUploader` Details step ("Tell us what this is.").
 *
 * Calls [PetdocsApi.uploadDocument] when [api]/[ownerId]/[petId] are wired,
 * otherwise shows a TODO toast and calls [onDone].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UploadDetailsScreen(
    photoPath: String,
    onDone: () -> Unit,
    api: PetdocsApi? = null,
    ownerId: String? = null,
    petId: String? = null,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var category by remember { mutableStateOf(DocCategory.VACCINE_RECORD) }
    var menuExpanded by remember { mutableStateOf(false) }
    var notes by remember { mutableStateOf("") }
    var uploading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val file = remember(photoPath) { File(photoPath) }
    val fileExists = file.exists()
    val fileProblem = if (!fileExists) {
        "Photo not found. Try capturing again."
    } else {
        validateDocUpload("image/jpeg", file.length())
    }

    fun handleUpload() {
        if (uploading) return
        if (fileProblem != null) {
            error = fileProblem
            return
        }
        uploading = true
        error = null
        scope.launch {
            try {
                if (api != null && ownerId != null && petId != null) {
                    val bytes = file.readBytes()
                    api.uploadDocument(
                        ownerId = ownerId,
                        petId = petId,
                        name = file.name,
                        bytes = bytes,
                        mime = "image/jpeg",
                        category = category,
                        notes = notes.trim().takeIf { it.isNotBlank() },
                        uploadedBy = ownerId,
                    )
                    Toast.makeText(context, "Saved ${file.name} to the vault.", Toast.LENGTH_SHORT).show()
                } else {
                    // TODO(upload): wire api plus ownerId plus petId from nav/session.
                    Toast.makeText(context, "Upload not wired yet (TODO: documents:create)", Toast.LENGTH_SHORT).show()
                }
                onDone()
            } catch (e: Exception) {
                error = e.message ?: "Upload failed. Try again."
                Toast.makeText(context, "Upload failed", Toast.LENGTH_SHORT).show()
            } finally {
                uploading = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Stepper(current = 1, labels = UPLOAD_STEPS)

        Text(
            text = "Document details",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Text(
            text = "Tell us what this is.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (fileExists) {
            AsyncImage(
                model = file,
                contentDescription = "Scanned document preview",
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp)
                    .clip(RoundedCornerShape(16.dp)),
            )
            Text(
                text = file.name,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            Text(
                text = "No preview available.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        ExposedDropdownMenuBox(
            expanded = menuExpanded,
            onExpandedChange = { menuExpanded = !menuExpanded },
        ) {
            OutlinedTextField(
                value = category.value.replace('_', ' '),
                onValueChange = {},
                readOnly = true,
                label = { Text("Document type") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(menuExpanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth(),
            )
            ExposedDropdownMenu(
                expanded = menuExpanded,
                onDismissRequest = { menuExpanded = false },
            ) {
                DocCategory.entries.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option.value.replace('_', ' ')) },
                        onClick = { category = option; menuExpanded = false },
                    )
                }
            }
        }

        OutlinedTextField(
            value = notes,
            onValueChange = { notes = it },
            label = { Text("Notes (optional)") },
            placeholder = { Text("e.g. Annual checkup at Riverside") },
            singleLine = false,
            modifier = Modifier.fillMaxWidth(),
        )

        error?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
        } ?: run {
            Text(
                text = "PDF or photo, up to 10MB. Saved to this pet's vault.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedButton(
                onClick = onDone,
                enabled = !uploading,
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp),
            ) {
                Text("Back")
            }
            Button(
                onClick = ::handleUpload,
                enabled = !uploading && fileProblem == null,
                modifier = Modifier
                    .weight(2f)
                    .heightIn(min = 48.dp),
            ) {
                Text(if (uploading) "Uploading..." else "Upload")
            }
        }
    }
}
