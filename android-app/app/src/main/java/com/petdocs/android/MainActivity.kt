package com.petdocs.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
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

class MainActivity : ComponentActivity() {
    // Lifecycle-aware dashboard state via the platform ViewModelProvider
    // (lifecycle-viewmodel is already on the classpath; no extra deps).
    private val appViewModel: AppViewModel by lazy {
        ViewModelProvider(this)[AppViewModel::class.java]
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PetdocsTheme {
                // Shared session (DataStore) + Convex HTTP client. Same wiring
                // as ReminderPollWorker: OkHttp + JSON content negotiation.
                // (BuildConfig needs no import — same package.)
                val session = remember { SessionStore(applicationContext) }
                val http = remember {
                    HttpClient(OkHttp) {
                        install(ContentNegotiation) { json(PetdocsJson) }
                    }
                }
                DisposableEffect(http) { onDispose { http.close() } }
                val api = remember(http) { PetdocsApi(BuildConfig.CONVEX_URL, http) }
                PetdocsNav(api = api, session = session, appViewModel = appViewModel)
            }
        }
    }
}
