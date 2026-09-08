package com.petdocs.android.data

// ---------------------------------------------------------------------------
// CI DEPENDENCY GAPS (read before running on CI):
//
// These tests deliberately use ONLY deps already in app/build.gradle.kts
// (junit + kotlinx-coroutines-test + ktor-client-core/content-negotiation).
// ktor-client-mock is ABSENT, so instead of MockEngine we hand-roll a fake
// HttpClientEngineBase below (same behavior: scripted JSON envelopes,
// request recording for order assertions).
//
// For idiomatic tests, CI should add:
//   testImplementation("io.ktor:ktor-client-mock:3.0.3")
//   testImplementation("app.cash.turbine:turbine:1.2.0")
// With ktor-client-mock, replace FakeConvexEngine with:
//   HttpClient(MockEngine { request -> respond(...) }) { install(ContentNegotiation) { json(PetdocsJson) } }
// With turbine, replace polling loops in AppViewModelTest with:
//   viewModel.pets.test { assertEquals(..., awaitItem()) }
// Also consider (ViewModel needs Android framework):
//   testImplementation("org.robolectric:robolectric:4.13")
//   testImplementation("androidx.arch.core:core-testing:2.2.0")
// ---------------------------------------------------------------------------

import io.ktor.client.HttpClient
import io.ktor.client.engine.HttpClientEngineBase
import io.ktor.client.engine.HttpClientEngineConfig
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpProtocolVersion
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import io.ktor.util.date.GMTDate
import io.ktor.utils.io.ByteReadChannel
import io.ktor.utils.io.core.readBytes
import io.ktor.utils.io.readRemaining
import kotlinx.coroutines.test.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * Unit tests for [PetdocsApi] envelope handling + request shape.
 *
 * Uses a hand-rolled [FakeConvexEngine] (no ktor-client-mock on the
 * classpath) with a real [PetdocsApi] + ContentNegotiation JSON, mirroring
 * production wiring in MainActivity (`HttpClient(...) { install(...) }`).
 * Style follows [ModelsTest] (JUnit4, plain asserts).
 */
@OptIn(ExperimentalCoroutinesApi::class, io.ktor.util.InternalAPI::class)
class PetdocsApiTest {

    // --- Fake transport ---

    private data class RecordedRequest(
        val url: String,
        val method: HttpMethod,
        val bodyText: String,
    ) {
        /** Convex `path` arg (e.g. "pets:listByOwner"), null for raw PUT bodies. */
        val convexPath: String?
            get() = runCatching {
                PetdocsJson.parseToJsonElement(bodyText).jsonObject["path"]?.jsonPrimitive?.content
            }.getOrNull()
    }

    private suspend fun OutgoingContent.readTestBody(): String = when (this) {
        is OutgoingContent.ByteArrayContent -> bytes().decodeToString()
        is OutgoingContent.NoContent -> ""
        is OutgoingContent.ReadChannelContent -> readFrom().readRemaining().readBytes().decodeToString()
        // WriteChannelContent / upgrades are not used by PetdocsApi's JSON POSTs
        // or ByteArray PUTs in these tests; keep hermetic (MockEngine would stream it).
        else -> ""
    }

    /**
     * Minimal fake Convex backend. Records every request; [respond] returns
     * (status, body) per request. Upload PUTs are distinguished by method+URL.
     */
    private inner class FakeConvexEngine(
        private val respond: suspend (request: HttpRequestData, bodyText: String) -> Pair<HttpStatusCode, String>,
    ) : HttpClientEngineBase("fake-convex") {
        override val config: HttpClientEngineConfig = HttpClientEngineConfig()
        val requests = mutableListOf<RecordedRequest>()

        @OptIn(io.ktor.util.InternalAPI::class)
        override suspend fun execute(data: HttpRequestData): HttpResponseData {
            val bodyText = data.body.readTestBody()
            requests.add(RecordedRequest(data.url.toString(), data.method, bodyText))
            val (status, json) = respond(data, bodyText)
            return HttpResponseData(
                statusCode = status,
                requestTime = GMTDate(),
                headers = headersOf(HttpHeaders.ContentType, ContentType.Application.Json.toString()),
                version = HttpProtocolVersion.HTTP_1_1,
                body = ByteReadChannel(json),
                callContext = this@FakeConvexEngine.coroutineContext,
            )
        }
    }

    private fun clientFor(engine: FakeConvexEngine): HttpClient = HttpClient(engine) {
        install(ContentNegotiation) { json(PetdocsJson) }
    }

    private fun apiFor(
        respond: suspend (request: HttpRequestData, bodyText: String) -> Pair<HttpStatusCode, String>,
    ): Pair<PetdocsApi, FakeConvexEngine> {
        val engine = FakeConvexEngine(respond)
        return PetdocsApi("https://test.convex.cloud", clientFor(engine)) to engine
    }

    private fun ok(json: String) = HttpStatusCode.OK to json

    // --- Fixtures (must match Models.kt serializers) ---

    private val pet1 = """{"_id":"pet-1","ownerId":"owner-1","name":"Miso","species":"cat"}"""
    private val pet2 = """{"_id":"pet-2","ownerId":"owner-1","name":"Mochi","species":"dog","breed":"Shiba"}"""
    private val doc1 =
        """{"_id":"doc-1","ownerId":"owner-1","petId":"pet-1","name":"Vax.pdf","storageId":"store-1","mime":"application/pdf","size":123}"""
    private val rem1 =
        """{"_id":"rem-1","ownerId":"owner-1","petId":"pet-1","kind":"vaccination","title":"Rabies booster","dueAt":1800000000000}"""
    private val passportValue =
        """{"scope":"passport","pet":{"name":"Miso","species":"cat"},"vaccinations":[],"documents":[]}"""

    // --- Query envelope ---

    @Test
    fun listPetsUnwrapsValueEnvelope() = runTest {
        val (api, engine) = apiFor { _, _ -> ok("""{"value":[$pet1,$pet2]}""") }
        val pets = api.listPets("owner-1")
        assertEquals(2, pets.size)
        assertEquals("Miso", pets[0].name)
        assertEquals("pet-2", pets[1].id)
        assertEquals(1, engine.requests.size)
        assertEquals("pets:listByOwner", engine.requests[0].convexPath)
        assertTrue(engine.requests[0].url.endsWith("/api/query"))
        assertTrue(engine.requests[0].bodyText.contains("owner-1"))
    }

    @Test
    fun listPetsReturnsEmptyOnNullValue() = runTest {
        val (api, _) = apiFor { _, _ -> ok("""{"value":null}""") }
        assertEquals(emptyList<Pet>(), api.listPets("owner-1"))
    }

    @Test
    fun queryErrorEnvelopeThrowsPetdocsApiException() = runTest {
        val (api, _) = apiFor { _, _ -> ok("""{"error":"boom"}""") }
        try {
            api.listPets("owner-1")
            fail("expected PetdocsApiException")
        } catch (e: PetdocsApiException) {
            assertEquals("boom", e.message)
        }
    }

    @Test
    fun mutationErrorMessageEnvelopeThrows() = runTest {
        val (api, engine) = apiFor { _, _ -> ok("""{"errorMessage":"nope"}""") }
        try {
            api.createPet(ownerId = "owner-1", name = "Miso", species = "cat")
            fail("expected PetdocsApiException")
        } catch (e: PetdocsApiException) {
            assertEquals("nope", e.message)
        }
        assertEquals("pets:create", engine.requests.single().convexPath)
    }

    @Test
    fun non2xxThrowsWithStatusCode() = runTest {
        val (api, _) = apiFor { _, _ -> HttpStatusCode.InternalServerError to "oops" }
        try {
            api.listPets("owner-1")
            fail("expected PetdocsApiException")
        } catch (e: PetdocsApiException) {
            assertEquals(500, e.status)
            assertTrue(e.message!!.contains("500"))
        }
    }

    // --- Upload flow (3 calls in order) ---

    @Test
    fun uploadFlowPostsThreeCallsInOrderWithCorrectPaths() = runTest {
        val uploadUrl = "https://upload.test/xyz"
        val (api, engine) = apiFor { request, bodyText ->
            val path = runCatching {
                PetdocsJson.parseToJsonElement(bodyText).jsonObject["path"]?.jsonPrimitive?.content
            }.getOrNull()
            when {
                request.method == HttpMethod.Post && path == "documents:generateUploadUrl" ->
                    ok("""{"value":"$uploadUrl"}""")
                request.method == HttpMethod.Put && request.url.toString() == uploadUrl ->
                    ok("""{"storageId":"storage-123"}""")
                request.method == HttpMethod.Post && path == "documents:create" ->
                    ok("""{"value":"doc-new"}""")
                else -> HttpStatusCode.BadRequest to """{"error":"unexpected ${request.method.value} ${request.url}"}"""
            }
        }
        val docId = api.uploadDocument(
            ownerId = "owner-1",
            petId = "pet-1",
            name = "Vax.pdf",
            bytes = "fake-bytes".toByteArray(),
            mime = "application/pdf",
            uploadedBy = "owner-1",
        )
        assertEquals("doc-new", docId)
        assertEquals(3, engine.requests.size)
        // 1: generateUploadUrl mutation
        assertEquals(HttpMethod.Post, engine.requests[0].method)
        assertEquals("documents:generateUploadUrl", engine.requests[0].convexPath)
        assertTrue(engine.requests[0].url.endsWith("/api/mutation"))
        // 2: raw PUT to the signed URL (not via /api/*)
        assertEquals(HttpMethod.Put, engine.requests[1].method)
        assertEquals(uploadUrl, engine.requests[1].url)
        // 3: documents:create mutation carrying the storageId
        assertEquals(HttpMethod.Post, engine.requests[2].method)
        assertEquals("documents:create", engine.requests[2].convexPath)
        assertTrue(engine.requests[2].bodyText.contains("storage-123"))
        assertTrue(engine.requests[2].bodyText.contains("pet-1"))
    }

    @Test
    fun uploadThrowsWhenPutFails() = runTest {
        val uploadUrl = "https://upload.test/xyz"
        val (api, _) = apiFor { request, bodyText ->
            val path = runCatching {
                PetdocsJson.parseToJsonElement(bodyText).jsonObject["path"]?.jsonPrimitive?.content
            }.getOrNull()
            when {
                request.method == HttpMethod.Post && path == "documents:generateUploadUrl" ->
                    ok("""{"value":"$uploadUrl"}""")
                request.method == HttpMethod.Put ->
                    HttpStatusCode.InternalServerError to "put failed"
                else -> ok("""{"value":"doc-new"}""")
            }
        }
        try {
            api.uploadDocument(
                ownerId = "owner-1",
                petId = "pet-1",
                name = "Vax.pdf",
                bytes = "x".toByteArray(),
                mime = "application/pdf",
                uploadedBy = "owner-1",
            )
            fail("expected PetdocsApiException")
        } catch (e: PetdocsApiException) {
            assertEquals(-1, e.status)
        }
    }

    // --- List decodes ---

    @Test
    fun listDocsDecodesArray() = runTest {
        val (api, engine) = apiFor { _, _ -> ok("""{"value":[$doc1]}""") }
        val docs = api.listDocs("owner-1", "pet-1")
        assertEquals(1, docs.size)
        assertEquals("Vax.pdf", docs[0].name)
        assertEquals("store-1", docs[0].storageId)
        assertEquals("documents:listByPet", engine.requests.single().convexPath)
    }

    @Test
    fun listRemindersDecodesArray() = runTest {
        val (api, engine) = apiFor { _, _ -> ok("""{"value":[$rem1]}""") }
        val reminders = api.listReminders("owner-1", upcomingOnly = true)
        assertEquals(1, reminders.size)
        assertEquals("Rabies booster", reminders[0].title)
        assertEquals("reminders:listByOwner", engine.requests.single().convexPath)
    }

    @Test
    fun listVaccinationsEmptyOnNullValue() = runTest {
        val (api, _) = apiFor { _, _ -> ok("""{"value":null}""") }
        assertEquals(emptyList<Vaccination>(), api.listVaccinations("owner-1", "pet-1"))
    }

    // --- Passport resolver ---

    @Test
    fun resolvePassportNullOnJsonNull() = runTest {
        val (api, engine) = apiFor { _, _ -> ok("""{"value":null}""") }
        assertNull(api.resolvePassport("tok-123"))
        assertEquals("shareLinks:resolve", engine.requests.single().convexPath)
    }

    @Test
    fun resolvePassportDecodesPayload() = runTest {
        val (api, _) = apiFor { _, _ -> ok("""{"value":$passportValue}""") }
        val payload = api.resolvePassport("tok-123")
        assertEquals("passport", payload!!.scope)
        assertEquals("Miso", payload.pet.name)
    }

    // --- Mutation unwraps ---

    @Test
    fun createPetUnwrapsIdAndSendsPath() = runTest {
        val (api, engine) = apiFor { _, _ -> ok("""{"value":"pet-new"}""") }
        assertEquals("pet-new", api.createPet("owner-1", "Miso", "cat"))
        assertEquals("pets:create", engine.requests.single().convexPath)
    }

    @Test
    fun setReminderStatusReturnsId() = runTest {
        val (api, engine) = apiFor { _, _ -> ok("""{"value":"rem-1"}""") }
        assertEquals("rem-1", api.setReminderStatus("owner-1", "rem-1", "done"))
        val body = engine.requests.single().bodyText
        assertEquals("reminders:setStatus", engine.requests.single().convexPath)
        assertTrue(body.contains("done"))
        assertTrue(body.contains("rem-1"))
    }

    @Test
    fun getDocUrlNullOnJsonNullAndValueWhenPresent() = runTest {
        val (nullApi, _) = apiFor { _, _ -> ok("""{"value":null}""") }
        assertNull(nullApi.getDocUrl("owner-1", "doc-1"))
        val (urlApi, _) = apiFor { _, _ -> ok("""{"value":"https://cdn.test/doc-1"}""") }
        assertEquals("https://cdn.test/doc-1", urlApi.getDocUrl("owner-1", "doc-1"))
    }
}
