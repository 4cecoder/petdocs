package dev.seridian.petdocs.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * On-device session storage (#24). The bearer token lives ONLY in
 * EncryptedSharedPreferences (AES-256-GCM key held in the Android
 * Keystore) — never in logs, never in plaintext prefs.
 *
 * The primary constructor takes a [SharedPreferences] instance so JVM
 * tests can drive the same logic with in-memory prefs; use the secondary
 * [Context] constructor in app code.
 *
 * Expiry is enforced at read time: a saved session past its [expiresAt]
 * is equivalent to no session and is cleared eagerly.
 */
class SessionStore(
    private val prefs: SharedPreferences,
    private val nowMs: () -> Long = System::currentTimeMillis,
) {
    constructor(context: Context) : this(encryptedPrefs(context))

    data class Session(
        val sessionToken: String,
        val ownerId: String,
        val email: String,
        val expiresAtMs: Long,
    )

    fun save(session: Session) {
        prefs.edit()
            .putString(KEY_TOKEN, session.sessionToken)
            .putString(KEY_OWNER_ID, session.ownerId)
            .putString(KEY_EMAIL, session.email)
            .putLong(KEY_EXPIRES_AT, session.expiresAtMs)
            .apply()
    }

    /** Live session or null (missing, corrupt, or expired — expired clears). */
    fun load(): Session? {
        val token = prefs.getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }
            ?: return null
        val ownerId = prefs.getString(KEY_OWNER_ID, null)?.takeIf { it.isNotBlank() }
            ?: return null
        val email = prefs.getString(KEY_EMAIL, null)?.takeIf { it.isNotBlank() }
            ?: return null
        val expiresAt = prefs.getLong(KEY_EXPIRES_AT, 0L)
        if (expiresAt <= nowMs()) {
            clear()
            return null
        }
        return Session(token, ownerId, email, expiresAt)
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val FILE = "petdocs_secure_session"
        private const val KEY_TOKEN = "session_token"
        private const val KEY_OWNER_ID = "owner_id"
        private const val KEY_EMAIL = "owner_email"
        private const val KEY_EXPIRES_AT = "expires_at_ms"

        private fun encryptedPrefs(context: Context): SharedPreferences {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            return EncryptedSharedPreferences.create(
                context,
                FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }
    }
}
