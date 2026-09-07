package com.petdocs.android.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.SessionStore
import kotlinx.coroutines.launch

/**
 * Magic-link sign-in. Mirrors the web copy in `src/app/sign-in/page.tsx`:
 * email field + "Send magic link" button, no password.
 */
@Composable
fun LoginScreen(onSignedIn: () -> Unit) {
    val context = LocalContext.current
    val sessionStore = remember { SessionStore(context.applicationContext) }
    val scope = rememberCoroutineScope()

    var email by remember { mutableStateOf("") }
    var sent by remember { mutableStateOf(false) }
    var sending by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 48.dp),
    ) {
        Text(text = "🐾", style = MaterialTheme.typography.displaySmall)
        Spacer(modifier = Modifier.height(16.dp))
        Text(text = "Welcome to petdocs", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Sign in with a magic link — no password to remember.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(24.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            placeholder = { Text("you@example.com") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(modifier = Modifier.height(12.dp))
        Button(
            onClick = {
                val trimmed = email.trim()
                if (trimmed.isBlank() || sending) return@Button
                sending = true
                scope.launch {
                    // TODO(magic-link verify): replace this scaffold session with a real
                    // requestMagicLink(email) call and only sign in after the emailed
                    // link is verified. ownerId is unknown until verification.
                    // TODO(deep-link): the real flow opens the emailed link via an app
                    // link, which verifies the token and then calls onSignedIn().
                    sessionStore.setSession(trimmed, null)
                    sent = true
                    sending = false
                    onSignedIn()
                }
            },
            enabled = email.isNotBlank() && !sending,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Send magic link")
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = if (sent) "✓ Check your inbox to finish signing in." else " ",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
