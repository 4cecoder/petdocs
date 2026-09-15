package dev.seridian.petdocs

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import dev.seridian.petdocs.data.AppViewModel
import dev.seridian.petdocs.data.AppViewModelFactory
import dev.seridian.petdocs.ui.PetdocsApp
import dev.seridian.petdocs.ui.theme.PetdocsTheme

/**
 * Single-activity Compose host. Handles the sign-in deep link
 * (petdocs://signin?token=…&email=…, #24) on cold start and via
 * onNewIntent while running.
 */
class MainActivity : ComponentActivity() {

    private val viewModel: AppViewModel by viewModels {
        AppViewModelFactory(applicationContext)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        consumeDeepLink(intent)
        setContent {
            PetdocsTheme {
                PetdocsApp(viewModel = viewModel)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        consumeDeepLink(intent)
    }

    private fun consumeDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "petdocs" || data.host != "signin") return
        val token = data.getQueryParameter("token")?.trim().orEmpty()
        val email = data.getQueryParameter("email")?.trim().orEmpty()
        if (token.isNotEmpty() && email.isNotEmpty()) {
            viewModel.onDeepLink(email = email, token = token)
        }
    }
}
