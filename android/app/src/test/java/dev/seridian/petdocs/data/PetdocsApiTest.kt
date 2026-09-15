package dev.seridian.petdocs.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy

/**
 * API-layer tests against a local MockWebServer: honest quota/verify
 * shapes, Bearer header handling, single-use error mapping, and
 * retry/backoff for transport failures only.
 */
class PetdocsApiTest {

    private lateinit var server: MockWebServer

    private fun api(): PetdocsApi = PetdocsApi(
        baseUrl = server.url("/").toString(),
        baseBackoffMs = 1,
        ioDispatcher = Dispatchers.Unconfined,
    )

    private fun jsonResponse(body: String): MockResponse = MockResponse()
        .setHeader("Content-Type", "application/json")
        .setBody(body.trimIndent())

    @kotlin.test.BeforeTest
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @kotlin.test.AfterTest
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `requestAuth posts the email and parses quota state`() = runTest {
        server.enqueue(
            jsonResponse(
                """
                {"ok":true,"attempted":true,"delivered":false,
                 "quotaExceeded":true,"retryAfterUtc":"2026-09-16T00:00:00.000Z"}
                """,
            ),
        )

        val res = api().requestAuth("owner@example.com")

        val recorded = server.takeRequest()
        assertEquals("/api/auth/request", recorded.path)
        assertEquals("POST", recorded.method)
        val sent = recorded.body.readUtf8()
        assertTrue(sent.contains("owner@example.com"))
        assertTrue(res.quotaExceeded)
        assertEquals("2026-09-16T00:00:00.000Z", res.retryAfterUtc)
    }

    @Test
    fun `verify parses success and consumes exactly one request`() = runTest {
        server.enqueue(
            jsonResponse(
                """
                {"ok":true,"sessionToken":"cafe1234","ownerId":"owner_1",
                 "expiresAt":1790000000000}
                """,
            ),
        )

        val res = api().verify("owner@example.com", "cafe1234")

        assertTrue(res.ok)
        assertEquals("cafe1234", res.sessionToken)
        assertEquals(1, server.requestCount)
    }

    @Test
    fun `verify maps 401 single-use errors to the honest message without retry`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"ok":false,"error":"This sign-in link has already been used."}"""),
        )

        val res = api().verify("owner@example.com", "cafe1234")

        assertFalse(res.ok)
        assertEquals("This sign-in link has already been used.", res.error)
        assertEquals(1, server.requestCount)
    }

    @Test
    fun `me sends the session token only in the Bearer header`() = runTest {
        server.enqueue(
            jsonResponse(
                """
                {"ownerId":"owner_1","email":"owner@example.com","pets":[]}
                """,
            ),
        )

        val me = api().me("cafe1234")

        val recorded = server.takeRequest()
        assertEquals("/api/me", recorded.path)
        assertEquals("Bearer cafe1234", recorded.getHeader("Authorization"))
        // The token must never ride in the URL or body.
        assertFalse(recorded.body.readUtf8().contains("cafe1234"))
        assertEquals("owner_1", me.ownerId)
    }

    @Test
    fun `me maps 401 to SessionExpiredException`() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(401).setBody("""{"error":"Unauthorized"}"""),
        )
        assertFailsWith<SessionExpiredException> { api().me("stale-token") }
    }

    @Test
    fun `petSummary hits the path-param route with ownership checked server-side`() = runTest {
        server.enqueue(
            jsonResponse(
                """
                {"pet":{"_id":"pet_1","name":"Rex","species":"dog","status":"active"},
                 "vaccinations":[],"visits":[],"documents":[]}
                """,
            ),
        )

        val summary = api().petSummary("cafe1234", "pet_1")

        val recorded = server.takeRequest()
        assertEquals("/api/pets/pet_1", recorded.path)
        assertEquals("Bearer cafe1234", recorded.getHeader("Authorization"))
        assertEquals("Rex", summary.pet.name)
    }

    @Test
    fun `transport failures retry with backoff and then succeed`() = runTest {
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
        server.enqueue(
            jsonResponse("""{"ownerId":"owner_1","email":"owner@example.com","pets":[]}"""),
        )

        val me = api().me("cafe1234")

        assertEquals(3, server.requestCount)
        assertEquals("owner@example.com", me.email)
    }

    @Test
    fun `persistent transport failure surfaces as an ApiError after max attempts`() = runTest {
        repeat(3) {
            server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
        }

        val error = assertFailsWith<ApiError> { api().me("cafe1234") }

        assertEquals(3, server.requestCount)
        assertEquals(0, error.code)
        // Friendly and honest, with or without the underlying detail —
        // never a token, never a raw stack trace.
        assertTrue(
            error.message!!.contains("Could not reach PetDocs") ||
                error.message!!.contains("Network problem"),
        )
    }

    @Test
    fun `server 500s do not retry (they are answers, not outages)`() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(500)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"error":"Backend exploded"}"""),
        )

        val error = assertFailsWith<ApiError> { api().me("cafe1234") }

        assertEquals(1, server.requestCount)
        assertEquals(500, error.code)
        assertEquals("Backend exploded", error.message)
    }
}
