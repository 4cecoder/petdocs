package dev.seridian.petdocs.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.seridian.petdocs.data.AppUiState
import dev.seridian.petdocs.data.AppViewModel
import dev.seridian.petdocs.data.SignInStage
import dev.seridian.petdocs.data.SignInUiState

/**
 * Sign-in flow (#24): email → check-email → deep-link auto-verify (driven
 * by MainActivity's petdocs:// handler) with a manual token paste fallback.
 * Honest states only: quota exhaustion and single-use/expired errors are
 * shown verbatim from the server.
 */
@Composable
fun SignInScreen(viewModel: AppViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val signIn = (state as? AppUiState.SignedOut)?.signIn ?: SignInUiState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "PetDocs",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = "Every record. Ready at the vet.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(32.dp))

        when (signIn.stage) {
            SignInStage.EnterEmail -> EmailForm(viewModel, signIn)
            SignInStage.CheckEmail -> CheckEmail(viewModel, signIn)
        }
    }
}

@Composable
private fun EmailForm(viewModel: AppViewModel, signIn: SignInUiState) {
    OutlinedTextField(
        value = signIn.email,
        onValueChange = viewModel::updateEmail,
        modifier = Modifier
            .fillMaxWidth()
            .semantics { contentDescription = "Email address" },
        label = { Text("Email address") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
        enabled = !signIn.sending && !signIn.verifying,
    )
    signIn.error?.let { FormMessage(it, isError = true) }
    if (signIn.verifying) {
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(8.dp))
            Text(
                "Restoring your session…",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
    Spacer(Modifier.height(16.dp))
    Button(
        onClick = viewModel::requestMagicLink,
        enabled = !signIn.sending && !signIn.verifying && signIn.email.isNotBlank(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        if (signIn.sending) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary,
            )
        } else {
            Text("Continue")
        }
    }
}

@Composable
private fun CheckEmail(viewModel: AppViewModel, signIn: SignInUiState) {
    Text(
        text = "Check your email",
        style = MaterialTheme.typography.titleLarge,
    )
    Spacer(Modifier.height(8.dp))
    Text(
        text = "We sent a sign-in link for ${signIn.email}. Open it on this " +
            "device and PetDocs will sign you in automatically.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
    )
    Spacer(Modifier.height(16.dp))

    if (signIn.quotaExceeded) {
        Card(
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.errorContainer,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(16.dp)) {
                Text(
                    text = "Email quota reached",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
                Text(
                    text = "Email sending is rate-limited right now. Try again " +
                        "after UTC midnight" +
                        (signIn.retryAfterUtc?.let { " ($it)" } ?: "") + ".",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
            }
        }
        Spacer(Modifier.height(16.dp))
    }

    signIn.message?.let { FormMessage(it, isError = false) }
    signIn.error?.let { FormMessage(it, isError = true) }

    if (signIn.verifying) {
        Spacer(Modifier.height(12.dp))
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth(),
        ) {
            CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 3.dp)
            Spacer(Modifier.height(8.dp))
            Text("Signing you in…", style = MaterialTheme.typography.bodySmall)
        }
    } else {
        OutlinedTextField(
            value = signIn.pastedToken,
            onValueChange = viewModel::updatePastedToken,
            modifier = Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Paste sign-in link" },
            label = { Text("Or paste the link / token") },
            singleLine = true,
        )
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = { viewModel.verifyPasted(signIn.pastedToken) },
            enabled = signIn.pastedToken.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Verify")
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = viewModel::backToEmail) {
            Text("Use a different email")
        }
    }
}

@Composable
private fun FormMessage(text: String, isError: Boolean) {
    Text(
        text = text,
        color = if (isError) {
            MaterialTheme.colorScheme.error
        } else {
            MaterialTheme.colorScheme.onSurfaceVariant
        },
        style = MaterialTheme.typography.bodySmall,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
    )
}
