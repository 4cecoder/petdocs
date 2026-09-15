package dev.seridian.petdocs.data

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import dev.seridian.petdocs.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Where the user is in the sign-in journey. */
enum class SignInStage {
    /** Email form. */
    EnterEmail,

    /** Email (probably) sent — show the deep-link hint + manual token paste. */
    CheckEmail,
}

data class SignInUiState(
    val stage: SignInStage = SignInStage.EnterEmail,
    val email: String = "",
    /** Manual fallback input: a pasted deep link, web link, or bare token. */
    val pastedToken: String = "",
    val sending: Boolean = false,
    /** Set when the server reports honest quota exhaustion (Resend 429). */
    val quotaExceeded: Boolean = false,
    /** ISO timestamp of the next UTC midnight when quotaExceeded is true. */
    val retryAfterUtc: String? = null,
    val message: String? = null,
    val error: String? = null,
    val verifying: Boolean = false,
)

sealed interface AppUiState {
    data object Restoring : AppUiState

    data class SignedOut(val signIn: SignInUiState = SignInUiState()) : AppUiState

    data class SignedIn(
        val me: MeResponse,
        val selectedPetId: String? = null,
        val petSummary: PetSummaryResponse? = null,
        val petLoading: Boolean = false,
        val petError: String? = null,
        val refreshing: Boolean = false,
    ) : AppUiState
}

/**
 * Single source of UI truth. Survives process death only through
 * [SessionStore] (tokens) — server state is refetched, never cached.
 */
class AppViewModel(
    private val api: PetdocsApi,
    private val sessionStore: SessionStore,
) : ViewModel() {

    private val _state = MutableStateFlow<AppUiState>(AppUiState.Restoring)
    val state: StateFlow<AppUiState> = _state.asStateFlow()

    init {
        restoreSession()
    }

    /** Silent session restore on launch: expired sessions vanish here. */
    private fun restoreSession() {
        val session = sessionStore.load() ?: run {
            _state.value = AppUiState.SignedOut()
            return
        }
        viewModelScope.launch {
            _state.value = AppUiState.SignedOut(SignInUiState(verifying = true))
            try {
                val me = api.me(session.sessionToken)
                _state.value = AppUiState.SignedIn(me)
            } catch (e: SessionExpiredException) {
                sessionStore.clear()
                _state.value = AppUiState.SignedOut(
                    SignInUiState(error = "Your session expired. Sign in again."),
                )
            } catch (e: Exception) {
                // Offline at launch: keep the session, surface the problem.
                _state.value = AppUiState.SignedIn(
                    MeResponse(
                        ownerId = session.ownerId,
                        email = session.email,
                        pets = emptyList(),
                    ),
                )
                _state.update {
                    (it as? AppUiState.SignedIn)?.copy(
                        petError = offlineMessage(e),
                    ) ?: it
                }
            }
        }
    }

    fun updateEmail(value: String) {
        mutateSignIn { it.copy(email = value, error = null) }
    }

    fun updatePastedToken(value: String) {
        mutateSignIn { it.copy(pastedToken = value, error = null) }
    }

    /** Back from check-email to the address form (fresh request allowed). */
    fun backToEmail() {
        mutateSignIn {
            SignInUiState(email = it.email)
        }
    }

    /** POST /api/auth/request — always yields the honest quota state. */
    fun requestMagicLink() {
        val current = signInState() ?: return
        if (current.sending) return
        val email = current.email.trim()
        if (!email.contains('@') || !email.contains('.')) {
            mutateSignIn { it.copy(error = "Enter a valid email address.") }
            return
        }
        mutateSignIn { it.copy(sending = true, error = null, message = null) }
        viewModelScope.launch {
            try {
                val result = api.requestAuth(email)
                mutateSignIn {
                    if (result.quotaExceeded) {
                        it.copy(
                            sending = false,
                            quotaExceeded = true,
                            retryAfterUtc = result.retryAfterUtc,
                            stage = SignInStage.CheckEmail,
                        )
                    } else {
                        it.copy(
                            sending = false,
                            quotaExceeded = false,
                            retryAfterUtc = null,
                            stage = SignInStage.CheckEmail,
                            // Honest: only claim "sent" when delivered.
                            message = if (result.delivered) {
                                "Check your inbox — the link opens the app."
                            } else {
                                "We couldn't send the email just yet. Try again shortly."
                            },
                        )
                    }
                }
            } catch (e: Exception) {
                mutateSignIn {
                    it.copy(sending = false, error = friendly(e))
                }
            }
        }
    }

    /** Deep link landed: petdocs://signin?token=…&email=… (#24). */
    fun onDeepLink(email: String, token: String) {
        verifyAndStore(email.trim(), token.trim())
    }

    /**
     * Manual fallback: the pasted string may be the raw token, the full
     * deep link, or the web link. Whatever it is, we only ever forward
     * token + email — the pasted value is never logged.
     */
    fun verifyPasted(pasted: String) {
        val current = signInState() ?: return
        val raw = pasted.trim()
        if (raw.isEmpty()) {
            mutateSignIn { it.copy(error = "Paste the link or token from your email.") }
            return
        }
        val token = extractToken(raw) ?: run {
            mutateSignIn { it.copy(error = "That doesn't look like a PetDocs link or token.") }
            return
        }
        val email = extractEmail(raw) ?: current.email.trim().takeIf { it.isNotEmpty() } ?: run {
            mutateSignIn { it.copy(error = "Enter the email you signed in with above.") }
            return
        }
        verifyAndStore(email, token)
    }

    private fun verifyAndStore(email: String, token: String) {
        mutateSignIn {
            it.copy(
                verifying = true,
                error = null,
                message = null,
                email = if (it.email.isBlank()) email else it.email,
            )
        }
        viewModelScope.launch {
            try {
                val result = api.verify(email, token)
                val sessionToken = result.sessionToken
                val ownerId = result.ownerId
                val expiresAt = result.expiresAt
                if (!result.ok || sessionToken == null || ownerId == null) {
                    // Honest single-use / expired / invalid messaging.
                    mutateSignIn {
                        it.copy(verifying = false, error = result.error ?: "Sign-in failed.")
                    }
                    return@launch
                }
                sessionStore.save(
                    SessionStore.Session(
                        sessionToken = sessionToken,
                        ownerId = ownerId,
                        email = email,
                        expiresAtMs = expiresAt ?: defaultExpiry(),
                    ),
                )
                val me = api.me(sessionToken)
                _state.value = AppUiState.SignedIn(me)
            } catch (e: Exception) {
                mutateSignIn {
                    it.copy(verifying = false, error = friendly(e))
                }
            }
        }
    }

    fun openPet(petId: String) {
        val current = _state.value as? AppUiState.SignedIn ?: return
        if (current.selectedPetId == petId) return
        _state.value = current.copy(
            selectedPetId = petId,
            petSummary = null,
            petLoading = true,
            petError = null,
        )
        viewModelScope.launch {
            try {
                val token = sessionStore.load()?.sessionToken
                    ?: throw SessionExpiredException()
                val summary = api.petSummary(token, petId)
                mutateSignedIn {
                    it.copy(petSummary = summary, petLoading = false)
                }
            } catch (e: SessionExpiredException) {
                signOut("Your session expired. Sign in again.")
            } catch (e: Exception) {
                mutateSignedIn {
                    it.copy(petLoading = false, petError = friendly(e))
                }
            }
        }
    }

    fun closePet() {
        mutateSignedIn {
            it.copy(selectedPetId = null, petSummary = null, petError = null)
        }
    }

    fun refresh() {
        val session = sessionStore.load() ?: return
        mutateSignedIn { it.copy(refreshing = true) }
        viewModelScope.launch {
            try {
                val me = api.me(session.sessionToken)
                mutateSignedIn { it.copy(me = me, refreshing = false) }
            } catch (e: SessionExpiredException) {
                signOut("Your session expired. Sign in again.")
            } catch (e: Exception) {
                mutateSignedIn { it.copy(refreshing = false, petError = friendly(e)) }
            }
        }
    }

    fun signOut(message: String? = null) {
        sessionStore.clear()
        _state.value = AppUiState.SignedOut(
            SignInUiState(message = message ?: "Signed out."),
        )
    }

    // -- helpers ------------------------------------------------------------

    private fun signInState(): SignInUiState? =
        (_state.value as? AppUiState.SignedOut)?.signIn

    private fun mutateSignIn(transform: (SignInUiState) -> SignInUiState) {
        _state.update { state ->
            (state as? AppUiState.SignedOut)?.let { it.copy(signIn = transform(it.signIn)) }
                ?: state
        }
    }

    private fun mutateSignedIn(transform: (AppUiState.SignedIn) -> AppUiState.SignedIn) {
        _state.update { state ->
            (state as? AppUiState.SignedIn)?.let(transform) ?: state
        }
    }

    private fun defaultExpiry(): Long = System.currentTimeMillis() + 30L * 24 * 60 * 60 * 1000

    companion object {
        /** Accepts petdocs://signin?token=…, web links with ?token=…, or a bare token. */
        fun extractToken(raw: String): String? {
            val match = Regex("[?&]token=([0-9a-fA-F]{8,})").find(raw)
            return match?.groupValues?.get(1) ?: raw.takeIf { Regex("^[0-9a-fA-F]{32,64}$").matches(it) }
        }

        fun extractEmail(raw: String): String? {
            val match = Regex("[?&]email=([^&\\s]+)").find(raw)
            return match?.groupValues?.get(1)?.let { java.net.URLDecoder.decode(it, "UTF-8") }
        }

        private fun friendly(e: Exception): String = when (e) {
            is SessionExpiredException -> e.message ?: "Session expired."
            is ApiError -> e.message ?: "Something went wrong."
            else -> "Could not reach PetDocs. Check your connection and try again."
        }

        private fun offlineMessage(e: Exception): String = friendly(e)
    }
}

/** DI seam so tests can build the VM against MockWebServer + temp prefs. */
class AppViewModelFactory(
    private val context: Context,
    private val baseUrl: String? = null,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        val api = PetdocsApi(baseUrl ?: BuildConfig.CONVEX_URL)
        return AppViewModel(api, SessionStore(context)) as T
    }
}
