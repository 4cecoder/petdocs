package dev.seridian.petdocs.data

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.io.IOException

/** Thrown when a Bearer session is rejected (expired/revoked/unknown). */
class SessionExpiredException : Exception("Session expired — sign in again")

/** Non-2xx from the mobile API with the server's honest error message. */
class ApiError(val code: Int, message: String) : Exception(message)

@Serializable
private data class ErrorBody(val error: String? = null)

/**
 * Thin client over the mobile HTTP surface (convex/http.ts, #24):
 *
 *   POST /api/auth/request { email }
 *   POST /api/auth/verify { email, token } → { sessionToken, ownerId }
 *   GET  /api/me            (Bearer) → { ownerId, email, pets[] }
 *   GET  /api/pets/{petId}  (Bearer) → vitals + recent records
 *
 * Robustness rules:
 *   - transport failures (IOException) retry with exponential backoff
 *     (default 1s/2s/4s); HTTP 4xx/5xx do NOT retry (they are answers,
 *     not outages);
 *   - 401 on a Bearer call maps to [SessionExpiredException] so callers
 *     can drop straight back to sign-in;
 *   - the session token is only ever sent in the Authorization header —
 *     it is never logged, never written to exceptions, never echoed.
 */
class PetdocsApi(
    baseUrl: String,
    private val baseBackoffMs: Long = 1_000,
    private val maxAttempts: Int = 3,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val client: HttpClient = defaultHttpClient(),
) {
    private val base = baseUrl.trimEnd('/')

    suspend fun requestAuth(email: String): AuthRequestResponse =
        retrying {
            val res: HttpResponse = client.post("$base/api/auth/request") {
                contentType(ContentType.Application.Json)
                setBody(mapOf("email" to email))
            }
            res.ensureOkAndParse()
        }

    suspend fun verify(email: String, token: String): VerifyResponse =
        retrying {
            val res: HttpResponse = client.post("$base/api/auth/verify") {
                contentType(ContentType.Application.Json)
                setBody(mapOf("email" to email, "token" to token))
            }
            // Honest failures (single-use/expired/invalid) arrive as 401
            // with { ok:false, error } — that's an answer, not an outage.
            if (res.status.isSuccess()) res.body()
            else res.body<ErrorBody>().let { body ->
                VerifyResponse(
                    ok = false,
                    error = body.error ?: "Sign-in failed (HTTP ${res.status.value}).",
                )
            }
        }

    suspend fun me(sessionToken: String): MeResponse = bearerGet(
        sessionToken,
        "$base/api/me",
    )

    suspend fun petSummary(sessionToken: String, petId: String): PetSummaryResponse =
        bearerGet(sessionToken, "$base/api/pets/$petId")

    private suspend inline fun <reified T> bearerGet(
        sessionToken: String,
        url: String,
    ): T = retrying {
        val res: HttpResponse = client.get(url) {
            header(HttpHeaders.Authorization, "Bearer $sessionToken")
        }
        if (res.status.value == 401) throw SessionExpiredException()
        res.ensureOkAndParse<T>()
    }

    private suspend inline fun <reified T> HttpResponse.ensureOkAndParse(): T {
        if (!status.isSuccess()) {
            val message = runCatching { body<ErrorBody>().error }
                .getOrNull()
                ?: "Request failed (HTTP ${status.value})."
            throw ApiError(status.value, message)
        }
        return body<T>()
    }

    /**
     * Exponential backoff for transport errors only. Delay runs on
     * [ioDispatcher] so tests can collapse it.
     */
    private suspend fun <T> retrying(block: suspend () -> T): T {
        var lastError: IOException? = null
        repeat(maxAttempts) { attempt ->
            try {
                return block()
            } catch (e: IOException) {
                lastError = e
                if (attempt < maxAttempts - 1) {
                    withContext(ioDispatcher) {
                        delay(baseBackoffMs * (1L shl attempt))
                    }
                }
            }
        }
        throw ApiError(
            code = 0,
            message = lastError?.message
                ?.takeIf { it.isNotBlank() }
                ?.let { "Network problem: $it" }
                ?: "Could not reach PetDocs. Check your connection.",
        )
    }

    companion object {
        /**
         * No request/response logging — the session token must never reach
         * logcat. Body negotiation via kotlinx-serialization.
         */
        private fun defaultHttpClient(): HttpClient = HttpClient(OkHttp) {
            install(ContentNegotiation) {
                json(petdocsJson)
            }
            engine {
                config {
                    retryOnConnectionFailure(true)
                }
            }
        }
    }
}
