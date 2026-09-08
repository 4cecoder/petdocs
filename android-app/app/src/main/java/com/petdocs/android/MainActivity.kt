package com.petdocs.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModelProvider
import com.petdocs.android.data.AppViewModel
import com.petdocs.android.data.PetdocsApi
import com.petdocs.android.data.PetdocsJson
import com.petdocs.android.data.SessionStore
import com.petdocs.android.ui.nav.PetdocsNav
import com.petdocs.android.ui.theme.PetdocsTheme
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull

class MainActivity : ComponentActivity() {
    // Lifecycle-aware dashboard state via the platform ViewModelProvider
    // (lifecycle-viewmodel is already on the classpath, no extra deps).
    private val appViewModel: AppViewModel by lazy {
        ViewModelProvider(this)[AppViewModel::class.java]
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PetdocsTheme {
                // Shared session (DataStore) plus Convex HTTP client. Same wiring
                // as ReminderPollWorker: OkHttp plus JSON content negotiation.
                // (BuildConfig needs no import, same package.)
                val session = remember { SessionStore(applicationContext) }
                var ready by remember { mutableStateOf(false) }
                // Splash gate for the session race: hold a warm splash until the
                // first ownerEmail arrives or 800ms passes, then show the nav.
                LaunchedEffect(session) {
                    withTimeoutOrNull(800) { session.ownerEmail.first() }
                    ready = true
                }
                val http = remember {
                    HttpClient(OkHttp) {
                        install(ContentNegotiation) { json(PetdocsJson) }
                    }
                }
                DisposableEffect(http) { onDispose { http.close() } }
                val api = remember(http) { PetdocsApi(BuildConfig.CONVEX_URL, http) }
                if (!ready) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "petdocs 🐾 loading",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    PetdocsNav(api = api, session = session, appViewModel = appViewModel)
                }
            }
        }
    }
}
