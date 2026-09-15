package dev.seridian.petdocs.ui

import android.content.Context
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ApplicationProvider
import dev.seridian.petdocs.data.AppUiState
import dev.seridian.petdocs.data.AppViewModel
import dev.seridian.petdocs.data.PetdocsApi
import dev.seridian.petdocs.data.SessionStore
import dev.seridian.petdocs.data.SignInStage
import dev.seridian.petdocs.ui.theme.PetdocsTheme
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Compose UI test for the SignIn flow (#24) against a real
 * [AppViewModel] + [PetdocsApi] wired to a local MockWebServer —
 * the full email → check-email → (quota banner | manual paste → pets)
 * journey, no emulator required.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp")
class SignInScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private lateinit var server: MockWebServer
    private lateinit var viewModel: AppViewModel

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        server = MockWebServer()
        server.start()

        val context = ApplicationProvider.getApplicationContext<Context>()
        val prefs = context.getSharedPreferences("sign_in_test", Context.MODE_PRIVATE)
        prefs.edit().clear().commit()
        viewModel = AppViewModel(
            api = PetdocsApi(
                baseUrl = server.url("/").toString(),
                baseBackoffMs = 1,
                ioDispatcher = Dispatchers.Unconfined,
            ),
            sessionStore = SessionStore(prefs),
        )
    }

    @AfterTest
    fun tearDown() {
        server.shutdown()
        Dispatchers.resetMain()
    }

    private fun enqueueJson(body: String) {
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody(body.trimIndent()),
        )
    }

    private fun signInState(): dev.seridian.petdocs.data.SignInUiState? =
        (viewModel.state.value as? AppUiState.SignedOut)?.signIn

    private fun typeEmailAndContinue() {
        compose.onNodeWithContentDescription("Email address")
            .performTextInput("owner@example.com")
        compose.onNodeWithText("Continue").performClick()
        compose.waitUntil(10_000) {
            signInState()?.stage == SignInStage.CheckEmail
        }
    }

    @Test
    fun `email request moves to check-email with the manual fallback visible`() {
        enqueueJson(
            """
            {"ok":true,"attempted":true,"delivered":true,
             "quotaExceeded":false}
            """,
        )
        compose.setContent { PetdocsTheme { SignInScreen(viewModel) } }

        typeEmailAndContinue()

        compose.onNodeWithText("Check your email").assertExists()
        compose.onNodeWithContentDescription("Paste sign-in link").assertExists()
        assertEquals(
            "Check your inbox — the link opens the app.",
            signInState()?.message,
        )
    }

    @Test
    fun `quota exhaustion shows the honest retry-after banner`() {
        enqueueJson(
            """
            {"ok":true,"attempted":true,"delivered":false,
             "quotaExceeded":true,"retryAfterUtc":"2026-09-16T00:00:00.000Z"}
            """,
        )
        compose.setContent { PetdocsTheme { SignInScreen(viewModel) } }

        typeEmailAndContinue()

        compose.onNodeWithText("Email quota reached").assertExists()
        compose.onNodeWithText(
            "Email sending is rate-limited right now. Try again after UTC " +
                "midnight (2026-09-16T00:00:00.000Z).",
        ).assertExists()
        // Manual fallback stays available even under quota.
        compose.onNodeWithText("Verify").assertExists()
    }

    @Test
    fun `pasting the deep link verifies and lands on the pets list`() {
        // 1: auth/request, 2: auth/verify, 3: /api/me
        enqueueJson("""{"ok":true,"attempted":true,"delivered":true,"quotaExceeded":false}""")
        enqueueJson(
            """
            {"ok":true,"sessionToken":"cafe1234","ownerId":"owner_1",
             "expiresAt":1790000000000}
            """,
        )
        enqueueJson(
            """
            {"ownerId":"owner_1","email":"owner@example.com",
             "pets":[{"_id":"pet_1","name":"Rex","species":"dog","status":"active"}]}
            """,
        )
        compose.setContent { PetdocsTheme { PetdocsApp(viewModel) } }

        typeEmailAndContinue()

        val pasted = "petdocs://signin?token=cafe1234&email=owner%40example.com"
        compose.onNodeWithContentDescription("Paste sign-in link")
            .performTextReplacement(pasted)
        compose.onNodeWithText("Verify").performClick()

        compose.waitUntil(10_000) { viewModel.state.value is AppUiState.SignedIn }

        compose.onNodeWithText("Rex").assertExists()
        val signedIn = viewModel.state.value as AppUiState.SignedIn
        assertEquals("owner@example.com", signedIn.me.email)

        // The session token was persisted for the next launch (not logged).
        val context = ApplicationProvider.getApplicationContext<Context>()
        val prefs = context.getSharedPreferences("sign_in_test", Context.MODE_PRIVATE)
        assertEquals("cafe1234", prefs.getString("session_token", null))
    }

    @Test
    fun `single-use token surfaces the honest server error and stays signed out`() {
        enqueueJson("""{"ok":true,"attempted":true,"delivered":true,"quotaExceeded":false}""")
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"ok":false,"error":"This sign-in link has already been used."}"""),
        )
        compose.setContent { PetdocsTheme { SignInScreen(viewModel) } }

        typeEmailAndContinue()
        compose.onNodeWithContentDescription("Paste sign-in link")
            .performTextReplacement("cafe1234".repeat(8)) // 64-hex bare token
        compose.onNodeWithText("Verify").performClick()

        compose.waitUntil(10_000) {
            signInState()?.error != null
        }

        assertEquals(
            "This sign-in link has already been used.",
            signInState()?.error,
        )
        assertTrue(viewModel.state.value is AppUiState.SignedOut)
        // Nothing was persisted.
        val context = ApplicationProvider.getApplicationContext<Context>()
        val prefs = context.getSharedPreferences("sign_in_test", Context.MODE_PRIVATE)
        assertNull(prefs.getString("session_token", null))
    }

    @Test
    fun `an expired persisted session drops to sign-in on launch`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val prefs = context.getSharedPreferences("sign_in_test", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("session_token", "stale")
            .putString("owner_id", "owner_1")
            .putString("owner_email", "owner@example.com")
            .putLong("expires_at_ms", System.currentTimeMillis() - 1000)
            .commit()

        // A NEW ViewModel with the expired session on disk.
        val vm = AppViewModel(
            api = PetdocsApi(server.url("/").toString(), baseBackoffMs = 1),
            sessionStore = SessionStore(prefs),
        )
        compose.setContent { PetdocsTheme { PetdocsApp(vm) } }

        compose.waitUntil(10_000) {
            (vm.state.value as? AppUiState.SignedOut)?.signIn != null
        }

        assertNotNull((vm.state.value as AppUiState.SignedOut).signIn)
        compose.onNodeWithText("Continue").assertExists()
    }
}
