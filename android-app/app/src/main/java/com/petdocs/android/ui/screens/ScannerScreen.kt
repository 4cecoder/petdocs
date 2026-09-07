package com.petdocs.android.ui.screens

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.compose.AsyncImage
import com.petdocs.android.data.DocCategory
import com.petdocs.android.data.PetdocsApi
import kotlinx.coroutines.launch
import java.io.File

/**
 * CameraX document capture: preview -> photo saved to cache -> category ->
 * [PetdocsApi.uploadDocument]. Pass [api]/[ownerId]/[petId] to enable upload;
 * without them capture still works and upload is a TODO.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScannerScreen(
    onDone: () -> Unit,
    api: PetdocsApi? = null,
    ownerId: String? = null,
    petId: String? = null,
) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()

    val camPerm = Manifest.permission.CAMERA
    val checkPerm = { ContextCompat.checkSelfPermission(context, camPerm) == PackageManager.PERMISSION_GRANTED }
    var hasPermission by remember { mutableStateOf(checkPerm()) }
    var showRationale by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasPermission = granted
        showRationale = !granted && (context as? Activity)?.shouldShowRequestPermissionRationale(camPerm) == true
    }
    LaunchedEffect(Unit) { if (!hasPermission) permissionLauncher.launch(camPerm) }

    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var photoFile by remember { mutableStateOf<File?>(null) }
    var category by remember { mutableStateOf(DocCategory.OTHER) }
    var menuExpanded by remember { mutableStateOf(false) }
    var uploading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    if (!hasPermission) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = if (showRationale) {
                    "petdocs needs camera access to scan documents. " +
                        "Please allow it — your photos stay on this device until you upload."
                } else {
                    "Camera permission is required to scan documents."
                },
                style = MaterialTheme.typography.bodyMedium,
            )
            Button(onClick = { permissionLauncher.launch(camPerm) }, modifier = Modifier.padding(top = 16.dp)) {
                Text("Allow camera")
            }
        }
        return
    }

    fun takePhoto() {
        val capture = imageCapture ?: return
        val file = File(context.cacheDir, "scan-${System.currentTimeMillis()}.jpg")
        val options = ImageCapture.OutputFileOptions.Builder(file).build()
        capture.takePicture(options, ContextCompat.getMainExecutor(context), object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    photoFile = file
                    error = null
                }

                override fun onError(exc: ImageCaptureException) {
                    error = exc.message ?: "Capture failed"
                }
            },
        )
    }

    fun upload() {
        val file = photoFile ?: return
        if (uploading) return
        uploading = true
        scope.launch {
            try {
                if (api != null && ownerId != null && petId != null) {
                    val bytes = file.readBytes()
                    api.uploadDocument(ownerId, petId, file.name, bytes, "image/jpeg", category, uploadedBy = ownerId)
                    Toast.makeText(context, "Document uploaded", Toast.LENGTH_SHORT).show()
                } else {
                    // TODO(upload): wire api + ownerId + petId from nav/session; the
                    // captured file (photoFile, JPEG in cacheDir) is ready to upload.
                    Toast.makeText(context, "Scan saved (upload not wired yet)", Toast.LENGTH_SHORT).show()
                }
                onDone()
            } catch (e: Exception) {
                error = e.message ?: "Upload failed"
                Toast.makeText(context, "Upload failed", Toast.LENGTH_SHORT).show()
            } finally {
                uploading = false
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        AndroidView(
            factory = { ctx ->
                PreviewView(ctx).also { previewView ->
                    ProcessCameraProvider.getInstance(ctx).addListener(
                        {
                            val provider = ProcessCameraProvider.getInstance(ctx).get()
                            val preview = Preview.Builder().build()
                                .also { it.surfaceProvider = previewView.surfaceProvider }
                            val capture = ImageCapture.Builder().build()
                            imageCapture = capture
                            provider.unbindAll()
                            provider.bindToLifecycle(lifecycle, CameraSelector.DEFAULT_BACK_CAMERA, preview, capture)
                        },
                        ContextCompat.getMainExecutor(ctx),
                    )
                }
            },
            modifier = Modifier.weight(1f).fillMaxWidth(),
        )

        error?.let {
            Text(
                text = it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 8.dp),
            )
        }

        photoFile?.let { file ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) {
                AsyncImage(
                    model = file,
                    contentDescription = "Scanned document preview",
                    modifier = Modifier.size(64.dp),
                )
                Spacer(modifier = Modifier.width(12.dp))
                ExposedDropdownMenuBox(
                    expanded = menuExpanded,
                    onExpandedChange = { menuExpanded = !menuExpanded },
                    modifier = Modifier.weight(1f),
                ) {
                    OutlinedTextField(
                        value = category.value,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Category") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(menuExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                    )
                    ExposedDropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false },
                    ) {
                        DocCategory.entries.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option.value) },
                                onClick = { category = option; menuExpanded = false },
                            )
                        }
                    }
                }
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        ) {
            Button(
                onClick = ::takePhoto,
                shape = CircleShape,
                modifier = Modifier.size(64.dp),
            ) {
                Icon(Icons.Filled.PhotoCamera, contentDescription = "Capture")
            }
            Spacer(modifier = Modifier.width(12.dp))
            Button(
                onClick = ::upload,
                enabled = photoFile != null && !uploading,
                modifier = Modifier.weight(1f),
            ) {
                Text(if (uploading) "Uploading…" else "Upload")
            }
        }
    }
}
