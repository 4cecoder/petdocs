package com.petdocs.android.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.petdocs.android.data.SessionStore
import com.petdocs.android.ui.components.PetMood
import com.petdocs.android.ui.components.PetMoodArt
import com.petdocs.android.ui.components.Stepper
import kotlinx.coroutines.launch

private val LOGIN_STEPS = listOf("Email", "Inbox")

/**
 * Magic-link sign-in as 2 steps. Mirrors the web copy in `src/app/sign-in/page.tsx`:
 * email field plus "Send magic link" button, then a check inbox confirmation.
 */
@Composable
fun LoginScreen(
    onSignedIn: () -> Unit,
    session: SessionStore? = null,
) {
    val context = LocalContext.current
    // Shared session when provided by Nav (MainActivity owns it); otherwise a
    // local one on the same DataStore, same keys either way.
    val sessionStore = session ?: remember { SessionStore(context.applicationContext) }
    val scope = rememberCoroutineScope()

    var step by remember { mutableStateOf(0) }
    var email by remember { mutableStateOf("") }
    var sent by remember { mutableStateOf(false) }
    var sending by remember { mutableStateOf(false) }

    fun sendLink() {
        val trimmed = email.trim()
        if (trimmed.isBlank() || sending) return
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
            step = 1
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Stepper(current = step, labels = LOGIN_STEPS)

        if (step == 0) {
            Text(text = "🐾", style = MaterialTheme.typography.displaySmall)
            Text(text = "Welcome to petdocs", style = MaterialTheme.typography.headlineMedium)
            Text(
                text = "Sign in with a magic link. No password needed.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email") },
                placeholder = { Text("you@example.com") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = ::sendLink,
                enabled = email.isNotBlank() && !sending,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
            ) {
                Text(if (sending) "Sending..." else "Send magic link")
            }
            Text(
                text = "We will email you a one tap sign in link.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                PetMoodArt(mood = PetMood.MAIL, size = 88.dp)
                Text(text = "Check your inbox", style = MaterialTheme.typography.headlineSmall)
                Text(
                    text = "Click the link to sign in.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = if (sent) "We sent a magic link to ${email.trim()}. It expires soon, so open it from this device." else " ",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = { step = 0 },
                    enabled = !sending,
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp),
                ) {
                    Text("Back")
                }
                Button(
                    onClick = onSignedIn,
                    modifier = Modifier
                        .weight(2f)
                        .heightIn(min = 48.dp),
                ) {
                    Text("Continue")
                }
            }
            TextButton(
                onClick = ::sendLink,
                enabled = !sending,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
            ) {
                Text(if (sending) "Sending..." else "Resend magic link")
            }
        }
    }
}
