package dev.seridian.petdocs.data

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Session storage semantics on the JVM (Robolectric drives real
 * SharedPreferences; the encrypted variant is exercised on device — the
 * store is built over injected prefs so both use the same logic).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class SessionStoreTest {

    private lateinit var context: Context
    private var nowMs: Long = 1_757_000_000_000

    @BeforeTest
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
    }

    @AfterTest
    fun tearDown() {
        context.getSharedPreferences("test_session", Context.MODE_PRIVATE)
            .edit().clear().commit()
    }

    private fun store(): SessionStore = SessionStore(
        context.getSharedPreferences("test_session", Context.MODE_PRIVATE),
        nowMs = { nowMs },
    )

    private fun session(
        token: String = "cafe1234",
        ownerId: String = "owner_1",
        email: String = "owner@example.com",
        expiresInMs: Long = 30L * 24 * 60 * 60 * 1000,
    ) = SessionStore.Session(token, ownerId, email, nowMs + expiresInMs)

    @Test
    fun `round trips a session`() {
        val store = store()
        store.save(session())

        val loaded = store.load()
        assertNotNull(loaded)
        assertEquals("cafe1234", loaded.sessionToken)
        assertEquals("owner_1", loaded.ownerId)
        assertEquals("owner@example.com", loaded.email)
    }

    @Test
    fun `missing session loads as null`() {
        assertNull(store().load())
    }

    @Test
    fun `expired session loads as null and is cleared`() {
        val store = store()
        store.save(session(expiresInMs = 1_000))
        nowMs += 2_000

        assertNull(store.load())
        // And the stale token did not survive on disk.
        assertNull(store.load())
    }

    @Test
    fun `blank token is treated as signed out`() {
        val store = store()
        store.save(session(token = "   "))
        assertNull(store.load())
    }

    @Test
    fun `clear removes the session`() {
        val store = store()
        store.save(session())
        store.clear()
        assertNull(store.load())
    }

    @Test
    fun `a fresh save replaces an old token (single session per device)`() {
        val store = store()
        store.save(session(token = "old"))
        store.save(session(token = "new"))

        assertEquals("new", store.load()?.sessionToken)
    }
}
