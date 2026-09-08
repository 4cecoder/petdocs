package com.petdocs.android.data

// ---------------------------------------------------------------------------
// CI DEPENDENCY GAPS (read before running on CI):
//
// AppViewModel is an AndroidViewModel (needs Application + DataStore) and
// PetdocsApi is a final class (no interface), so idiomatic ViewModel tests
// want extra deps. This file stays hermetic with ONLY existing deps:
//   - real PetdocsApi backed by a hand-rolled HttpClientEngineBase fake
//     (no ktor-client-mock on the classpath),
//   - real AppViewModel with an Unsafe-allocated Application (no Robolectric)
//     + injected ownerId via init() so refresh() never touches DataStore,
//   - Dispatchers.setMain(Unconfined) + runBlocking polling (no turbine).
//
// For idiomatic tests, CI should add:
//   testImplementation("io.ktor:ktor-client-mock:3.0.3")
//   testImplementation("app.cash.turbine:turbine:1.2.0")
// With those, prefer MockEngine + turbine:
//   HttpClient(MockEngine { respond(...) }) { install(ContentNegotiation) { json(PetdocsJson) } }
//   viewModel.pets.test { assertEquals(..., awaitItem()) }
// And to drop the Unsafe/Application hack entirely:
//   testImplementation("org.robolectric:robolectric:4.13")
//   testImplementation("androidx.arch.core:core-testing:2.2.0")
// ---------------------------------------------------------------------------

import android.app.Application
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [AppViewModel] refresh / done flows.
 *
 * Uses the REAL ViewModel + REAL PetdocsApi (fake transport) so the exact
 * Convex paths refresh()/doneReminder() rely on are covered
 * (`pets:listByOwner`, `documents:listByPet`, `reminders:listByOwner`,
 * `reminders:setStatus`). Style follows [ModelsTest] (JUnit4).
 */
@OptIn(ExperimentalCoroutinesApi::class, io.ktor.util.InternalAPI::class)
class AppViewModelTest {

    // --- Fake transport (duplicate of PetdocsApiTest's; kept local so each
    // test file is self-contained and deletable independently) ---

    private data class RecordedRequest(
        val url: String,
        val method: HttpMethod,
        val bodyText: String,
    ) {
        val convexPath: String?
            get() = runCatching {
                PetdocsJson.parseToJsonElement(bodyText).jsonObject["path"]?.jsonPrimitive?.content
            }.getOrNull()
    }

    private suspend fun OutgoingContent.readTestBody(): String = when (this) {
        is OutgoingContent.ByteArrayContent -> bytes().decodeToString()
        is OutgoingContent.NoContent -> ""
        is OutgoingContent.ReadChannelContent -> readFrom().readRemaining().readBytes().decodeToString()
        else -> ""
    }

    private inner class FakeConvexEngine(
        private val respond: suspend (request: HttpRequestData, bodyText: String) -> Pair<HttpStatusCode, String>,
    ) : HttpClientEngineBase("fake-convex-vm") {
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

    private fun apiAndEngine(
        respond: suspend (request: HttpRequestData, bodyText: String) -> Pair<HttpStatusCode, String>,
    ): Pair<PetdocsApi, FakeConvexEngine> {
        val engine = FakeConvexEngine(respond)
        val client = HttpClient(engine) { install(ContentNegotiation) { json(PetdocsJson) } }
        return PetdocsApi("https://test.convex.cloud", client) to engine
    }

    private fun ok(json: String) = HttpStatusCode.OK to json

    // --- Android harness without Robolectric ---

    /** Allocates Application without calling its stub constructor (which throws "Stub!"). */
    private fun fakeApplication(): Application {
        return try {
            val unsafeClass = Class.forName("sun.misc.Unsafe")
            val theUnsafe = unsafeClass.getDeclaredField("theUnsafe").apply { isAccessible = true }.get(null)
            val allocate = unsafeClass.getMethod("allocateInstance", Class::class.java)
            allocate.invoke(theUnsafe, Application::class.java) as Application
        } catch (e: Exception) {
            throw AssertionError(
                "Cannot create fake Application without Robolectric " +
                    "(add testImplementation(\"org.robolectric:robolectric:4.13\")): ${e.message}",
                e,
            )
        }
    }

    /**
     * Replaces AppViewModel's private SessionStore with one whose ownerId flow
     * emits [ownerId], so doneReminder()/snoozeReminder() never touch DataStore.
     * Needed because SessionStore/DataStore requires a real Android Context.
     */
    private fun AppViewModel.injectTestOwner(ownerId: String) {
        try {
            val unsafeClass = Class.forName("sun.misc.Unsafe")
            val theUnsafe = unsafeClass.getDeclaredField("theUnsafe").apply { isAccessible = true }.get(null)
            val allocate = unsafeClass.getMethod("allocateInstance", Class::class.java)
            val fakeStore = allocate.invoke(theUnsafe, SessionStore::class.java) as SessionStore
            SessionStore::class.java.getDeclaredField("ownerId").apply { isAccessible = true }
                .set(fakeStore, flowOf(ownerId))
            AppViewModel::class.java.getDeclaredField("session").apply { isAccessible = true }
                .set(this, fakeStore)
        } catch (e: Exception) {
            throw AssertionError("Cannot inject fake SessionStore ownerId: ${e.message}", e)
        }
    }

    private suspend fun awaitCondition(timeoutMs: Long = 5_000, pollMs: Long = 10, condition: () -> Boolean) {
        val start = System.currentTimeMillis()
        while (!condition()) {
            if (System.currentTimeMillis() - start > timeoutMs) error("timed out waiting for ViewModel state")
            delay(pollMs)
        }
    }

    // --- Fixtures ---

    private val pet1 = """{"_id":"pet-1","ownerId":"owner-1","name":"Miso","species":"cat"}"""
    private val pet2 = """{"_id":"pet-2","ownerId":"owner-1","name":"Mochi","species":"dog"}"""
    private val doc1 =
        """{"_id":"doc-1","ownerId":"owner-1","petId":"pet-1","name":"Vax.pdf","storageId":"store-1","mime":"application/pdf","size":10}"""
    private val doc2 =
        """{"_id":"doc-2","ownerId":"owner-1","petId":"pet-2","name":"Lab.png","storageId":"store-2","mime":"image/png","size":20}"""
    private val rem1 =
        """{"_id":"rem-1","ownerId":"owner-1","petId":"pet-1","kind":"vaccination","title":"Rabies booster","dueAt":1800000000000}"""

    /** Routes the three refresh() queries + setStatus mutation to canned envelopes. */
    private fun refreshResponder(
        petsJson: String = """{"value":[$pet1,$pet2]}""",
        docsForPet: Map<String, String> = mapOf("pet-1" to """{"value":[$doc1]}""", "pet-2" to """{"value":[$doc2]}"""),
        remindersJson: String = """{"value":[$rem1]}""",
    ): suspend (HttpRequestData, String) -> Pair<HttpStatusCode, String> = { _, bodyText ->
        val obj = runCatching { PetdocsJson.parseToJsonElement(bodyText).jsonObject }.getOrNull()
        val path = obj?.get("path")?.jsonPrimitive?.content
        val args = obj?.get("args")?.jsonObject
        when (path) {
            "pets:listByOwner" -> ok(petsJson)
            "documents:listByPet" -> {
                val petId = args?.get("petId")?.jsonPrimitive?.content
                ok(docsForPet[petId] ?: """{"value":[]}""")
            }
            "reminders:listByOwner" -> ok(remindersJson)
            "reminders:setStatus" -> {
                val rid = args?.get("reminderId")?.jsonPrimitive?.content ?: "rem-1"
                ok("""{"value":"$rid"}""")
            }
            else -> HttpStatusCode.BadRequest to """{"error":"unexpected $path"}"""
        }
    }

    @Before
    fun setUpMain() {
        // viewModelScope uses Dispatchers.Main; Unconfined runs refresh() eagerly
        // so polling below sees loading=true immediately (no virtual-time needed).
        Dispatchers.setMain(Dispatchers.Unconfined)
    }

    @After
    fun tearDownMain() {
        Dispatchers.resetMain()
    }

    // --- refresh() ---

    @Test
    fun refreshPopulatesPetsDocsReminders() = runBlocking {
        val (api, engine) = apiAndEngine(refreshResponder())
        val vm = AppViewModel(fakeApplication())
        vm.init(api, "owner-1")
        vm.refresh()
        awaitCondition { vm.pets.value.size == 2 && !vm.loading.value }
        assertEquals(listOf("pet-1", "pet-2"), vm.pets.value.map { it.id })
        // First pet auto-selected; docs/reminders populated.
        assertEquals("pet-1", vm.selectedPetId.value)
        assertEquals(1, vm.docs.value.size)
        assertEquals("Vax.pdf", vm.docs.value[0].name)
        assertEquals(1, vm.reminders.value.size)
        assertEquals("Rabies booster", vm.reminders.value[0].title)
        assertNull(vm.error.value)
        // Exact Convex paths refresh() must call, in order.
        assertEquals(
            listOf("pets:listByOwner", "documents:listByPet", "reminders:listByOwner"),
            engine.requests.map { it.convexPath },
        )
    }

    @Test
    fun refreshKeepsValidSelectionAndLoadsItsDocs() = runBlocking {
        val (api, engine) = apiAndEngine(refreshResponder())
        val vm = AppViewModel(fakeApplication())
        vm.init(api, "owner-1")
        vm.selectPet("pet-2")
        vm.refresh()
        awaitCondition { vm.pets.value.size == 2 && !vm.loading.value }
        assertEquals("pet-2", vm.selectedPetId.value)
        assertEquals(listOf("doc-2"), vm.docs.value.map { it.id })
        val docsCall = engine.requests.first { it.convexPath == "documents:listByPet" }
        assertTrue(docsCall.bodyText.contains("pet-2"))
    }

    @Test
    fun refreshResetsStaleSelectionToFirstPet() = runBlocking {
        val (api, _) = apiAndEngine(refreshResponder())
        val vm = AppViewModel(fakeApplication())
        vm.init(api, "owner-1")
        vm.selectPet("ghost")
        vm.refresh()
        awaitCondition { vm.pets.value.isNotEmpty() && !vm.loading.value }
        assertEquals("pet-1", vm.selectedPetId.value)
    }

    @Test
    fun refreshSetsErrorOnApiThrow() = runBlocking {
        val (api, _) = apiAndEngine { _, _ -> HttpStatusCode.InternalServerError to "boom" }
        val vm = AppViewModel(fakeApplication())
        vm.init(api, "owner-1")
        vm.refresh()
        awaitCondition { vm.error.value != null && !vm.loading.value }
        assertTrue(vm.error.value!!.contains("500"))
    }

    @Test
    fun refreshWithoutApiSetsConfiguredError() = runBlocking {
        val vm = AppViewModel(fakeApplication())
        vm.refresh()
        awaitCondition { vm.error.value != null && !vm.loading.value }
        assertEquals("API not configured", vm.error.value)
    }

    // --- doneReminder() ---

    @Test
    fun doneReminderRemovesFromListAndCallsSetStatus() = runBlocking {
        val (api, engine) = apiAndEngine(refreshResponder())
        val vm = AppViewModel(fakeApplication())
        vm.init(api, "owner-1")
        vm.injectTestOwner("owner-1")
        vm.refresh()
        awaitCondition { vm.reminders.value.size == 1 && !vm.loading.value }
        vm.doneReminder(api, "rem-1")
        awaitCondition { vm.reminders.value.isEmpty() }
        assertTrue(vm.reminders.value.none { it.id == "rem-1" })
        assertNull(vm.error.value)
        val statusCall = engine.requests.last { it.convexPath == "reminders:setStatus" }
        assertTrue(statusCall.bodyText.contains("rem-1"))
        assertTrue(statusCall.bodyText.contains("done"))
    }

    @Test
    fun selectPetAndClearError() = runBlocking {
        val vm = AppViewModel(fakeApplication())
        vm.selectPet("pet-9")
        assertEquals("pet-9", vm.selectedPetId.value)
        // Produce an error first (no api), then clear it.
        vm.refresh()
        awaitCondition { vm.error.value != null }
        vm.clearError()
        assertNull(vm.error.value)
        vm.selectPet(null)
        assertNull(vm.selectedPetId.value)
    }
}
