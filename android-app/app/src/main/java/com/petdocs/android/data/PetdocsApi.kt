package com.petdocs.android.data

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Thrown for any non-2xx Convex HTTP response (and Convex-level errors). */
class PetdocsApiException(val status: Int, override val message: String) : Exception(message)

@Serializable
private data class ConvexRequest(
    val path: String,
    val args: JsonObject = JsonObject(emptyMap()),
    val format: String = "json",
)

@Serializable
private data class ConvexResponse(
    val value: JsonElement? = null,
    val error: String? = null,
    val errorMessage: String? = null,
)

@Serializable
private data class UploadResult(val storageId: String)

/** Return of `shareLinks:createToken` — the full token is a capability, never log it. */
data class ShareTokenResult(val linkId: String, val token: String)

/**
 * Thin Convex HTTP client — same function surface as the web app.
 *
 * Transport mirrors the portal's ConvexApi: POST `{convexUrl}/api/query|mutation`
 * with `{ path, args, format: "json" }`, unwrapping the `{ value }` envelope.
 * Non-2xx responses throw [PetdocsApiException].
 *
 * No Android imports here by design (pure Ktor + kotlinx.serialization) so this
 * file stays unit-testable on the JVM.
 */
class PetdocsApi(
    private val convexUrl: String,
    private val httpClient: HttpClient,
) {
    companion object {
        const val PETS_LIST = "pets:listByOwner"
        const val PETS_GET = "pets:get"
        const val PETS_CREATE = "pets:create"

        const val DOCUMENTS_GENERATE_UPLOAD_URL = "documents:generateUploadUrl"
        const val DOCUMENTS_CREATE = "documents:create"
        const val DOCUMENTS_LIST_BY_PET = "documents:listByPet"
        const val DOCUMENTS_GET_URL = "documents:getUrl"
        const val DOCUMENTS_MOVE_TO_TRASH = "documents:moveToTrash"

        const val VACCINATIONS_LIST_BY_PET = "vaccinations:listByPet"
        const val VACCINATIONS_DUE_SOON = "vaccinations:dueSoon"

        const val MEDICATIONS_LIST_BY_PET = "medications:listByPet"

        const val VET_VISITS_LIST_BY_PET = "vetVisits:listByPet"

        const val REMINDERS_LIST_BY_OWNER = "reminders:listByOwner"
        const val REMINDERS_SET_STATUS = "reminders:setStatus"

        const val SHARE_LINKS_CREATE_TOKEN = "shareLinks:createToken"
        const val SHARE_LINKS_LIST_BY_PET = "shareLinks:listByPet"
        const val SHARE_LINKS_REVOKE = "shareLinks:revoke"
        const val SHARE_LINKS_RESOLVE = "shareLinks:resolve"
        const val SHARE_LINKS_RECORD_VIEW = "shareLinks:recordView"
    }

    private fun baseUrl(): String = convexUrl.trimEnd('/')

    private suspend fun query(path: String, args: JsonObject = JsonObject(emptyMap())): JsonElement =
        post("api/query", path, args)

    private suspend fun mutation(path: String, args: JsonObject = JsonObject(emptyMap())): JsonElement =
        post("api/mutation", path, args)

    private suspend fun post(endpoint: String, path: String, args: JsonObject): JsonElement {
        val response: HttpResponse = httpClient.post("${baseUrl()}/$endpoint") {
            contentType(ContentType.Application.Json)
            setBody(ConvexRequest(path = path, args = args))
        }
        if (!response.status.isSuccess()) {
            val snippet = runCatching { response.bodyAsText().take(300) }.getOrNull().orEmpty()
            throw PetdocsApiException(
                status = response.status.value,
                message = "Convex $path failed: HTTP ${response.status.value} $snippet".trim(),
            )
        }
        val envelope: ConvexResponse = response.body()
        val convexError = envelope.errorMessage ?: envelope.error
        if (convexError != null) {
            throw PetdocsApiException(status = response.status.value, message = convexError)
        }
        return envelope.value ?: JsonNull
    }

    // --- Pets (convex/pets.ts) ---

    suspend fun listPets(ownerId: String, status: String? = null): List<Pet> {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            if (status != null) put("status", JsonPrimitive(status))
        }
        val value = query(PETS_LIST, args)
        if (value is JsonNull) return emptyList()
        return PetdocsJson.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(Pet.serializer()), value)
    }

    suspend fun getPet(ownerId: String, petId: String): Pet? {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("petId", JsonPrimitive(petId))
        }
        val value = query(PETS_GET, args)
        if (value is JsonNull) return null
        return PetdocsJson.decodeFromJsonElement(Pet.serializer(), value)
    }

    suspend fun createPet(
        ownerId: String,
        name: String,
        species: String,
        breed: String? = null,
        birthdate: Long? = null,
        weightKg: Double? = null,
        microchipId: String? = null,
    ): String {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("name", JsonPrimitive(name))
            put("species", JsonPrimitive(species))
            if (breed != null) put("breed", JsonPrimitive(breed))
            if (birthdate != null) put("birthdate", JsonPrimitive(birthdate))
            if (weightKg != null) put("weightKg", JsonPrimitive(weightKg))
            if (microchipId != null) put("microchipId", JsonPrimitive(microchipId))
        }
        return mutation(PETS_CREATE, args).jsonPrimitive.content
    }

    // --- Documents (convex/documents.ts) ---

    /**
     * Three Convex calls: `documents:generateUploadUrl` (mutation) -> raw PUT of
     * [bytes] to the signed URL -> `documents:create` (mutation). Returns the new
     * document id.
     */
    suspend fun uploadDocument(
        ownerId: String,
        petId: String,
        name: String,
        bytes: ByteArray,
        mime: String,
        category: DocCategory? = null,
        notes: String? = null,
        uploadedBy: String,
    ): String {
        val uploadUrl = mutation(DOCUMENTS_GENERATE_UPLOAD_URL).jsonPrimitive.content
        val storageId = putBytes(uploadUrl, bytes, mime)
            ?: throw PetdocsApiException(status = -1, message = "Document upload failed")
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("petId", JsonPrimitive(petId))
            put("name", JsonPrimitive(name))
            put("storageId", JsonPrimitive(storageId))
            put("mime", JsonPrimitive(mime))
            put("size", JsonPrimitive(bytes.size))
            if (category != null) put("category", JsonPrimitive(category.value))
            if (notes != null) put("notes", JsonPrimitive(notes))
            put("uploadedBy", JsonPrimitive(uploadedBy))
        }
        return mutation(DOCUMENTS_CREATE, args).jsonPrimitive.content
    }

    private suspend fun putBytes(uploadUrl: String, bytes: ByteArray, mime: String): String? {
        return try {
            val response: HttpResponse = httpClient.put(uploadUrl) {
                contentType(ContentType.parse(mime))
                setBody(bytes)
            }
            if (!response.status.isSuccess()) return null
            response.body<UploadResult>().storageId
        } catch (_: Exception) {
            null
        }
    }

    suspend fun listDocs(ownerId: String, petId: String, category: DocCategory? = null): List<VaultDoc> {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("petId", JsonPrimitive(petId))
            if (category != null) put("category", JsonPrimitive(category.value))
        }
        val value = query(DOCUMENTS_LIST_BY_PET, args)
        if (value is JsonNull) return emptyList()
        return PetdocsJson.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(VaultDoc.serializer()), value)
    }

    suspend fun getDocUrl(ownerId: String, documentId: String): String? {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("documentId", JsonPrimitive(documentId))
        }
        val value = query(DOCUMENTS_GET_URL, args)
        if (value is JsonNull) return null
        return value.jsonPrimitive.contentOrNull
    }

    suspend fun moveToTrash(ownerId: String, documentId: String): String {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("documentId", JsonPrimitive(documentId))
        }
        return mutation(DOCUMENTS_MOVE_TO_TRASH, args).jsonPrimitive.content
    }

    // --- Vaccinations (convex/vaccinations.ts) ---

    suspend fun listVaccinations(
        ownerId: String,
        petId: String,
        status: VaccineStatus? = null,
    ): List<Vaccination> {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("petId", JsonPrimitive(petId))
            if (status != null) put("status", JsonPrimitive(status.value))
        }
        val value = query(VACCINATIONS_LIST_BY_PET, args)
        if (value is JsonNull) return emptyList()
        return PetdocsJson.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(Vaccination.serializer()), value)
    }

    suspend fun dueSoon(ownerId: String, daysAhead: Int? = null): List<Vaccination> {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            if (daysAhead != null) put("daysAhead", JsonPrimitive(daysAhead))
        }
        val value = query(VACCINATIONS_DUE_SOON, args)
        if (value is JsonNull) return emptyList()
        return PetdocsJson.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(Vaccination.serializer()), value)
    }

    // --- Medications (convex/medications.ts) ---

    suspend fun listMedications(
        ownerId: String,
        petId: String,
        status: String? = null,
    ): List<Medication> {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("petId", JsonPrimitive(petId))
            if (status != null) put("status", JsonPrimitive(status))
        }
        val value = query(MEDICATIONS_LIST_BY_PET, args)
        if (value is JsonNull) return emptyList()
        return PetdocsJson.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(Medication.serializer()), value)
    }

    // --- Vet visits (convex/vetVisits.ts) ---

    suspend fun listVisits(ownerId: String, petId: String, limit: Int? = null): List<VetVisit> {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("petId", JsonPrimitive(petId))
            if (limit != null) put("limit", JsonPrimitive(limit))
        }
        val value = query(VET_VISITS_LIST_BY_PET, args)
        if (value is JsonNull) return emptyList()
        return PetdocsJson.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(VetVisit.serializer()), value)
    }

    // --- Reminders (convex/reminders.ts) ---

    suspend fun listReminders(ownerId: String, upcomingOnly: Boolean? = null): List<ReminderItem> {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            if (upcomingOnly != null) {
                put("upcomingOnly", JsonPrimitive(upcomingOnly))
            }
        }
        val value = query(REMINDERS_LIST_BY_OWNER, args)
        if (value is JsonNull) return emptyList()
        return PetdocsJson.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(ReminderItem.serializer()), value)
    }

    /** [status] must be `done` or `dismissed` (backend-validated). Returns the reminder id. */
    suspend fun setReminderStatus(ownerId: String, reminderId: String, status: String): String {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("reminderId", JsonPrimitive(reminderId))
            put("status", JsonPrimitive(status))
        }
        return mutation(REMINDERS_SET_STATUS, args).jsonPrimitive.content
    }

    // --- Share links (convex/shareLinks.ts) ---

    suspend fun createShareToken(
        ownerId: String,
        petId: String,
        scope: String,
        label: String? = null,
        expiresAt: Long? = null,
        maxViews: Int? = null,
    ): ShareTokenResult {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("petId", JsonPrimitive(petId))
            put("scope", JsonPrimitive(scope))
            if (label != null) put("label", JsonPrimitive(label))
            if (expiresAt != null) put("expiresAt", JsonPrimitive(expiresAt))
            if (maxViews != null) put("maxViews", JsonPrimitive(maxViews))
        }
        val obj = mutation(SHARE_LINKS_CREATE_TOKEN, args).jsonObject
        return ShareTokenResult(
            linkId = obj["linkId"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            token = obj["token"]?.jsonPrimitive?.contentOrNull.orEmpty(),
        )
    }

    suspend fun listShareLinks(ownerId: String, petId: String): List<ShareLink> {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("petId", JsonPrimitive(petId))
        }
        val value = query(SHARE_LINKS_LIST_BY_PET, args)
        if (value is JsonNull) return emptyList()
        return PetdocsJson.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(ShareLink.serializer()), value)
    }

    suspend fun revokeShareLink(ownerId: String, linkId: String): String {
        val args = buildJsonObject {
            put("ownerId", JsonPrimitive(ownerId))
            put("linkId", JsonPrimitive(linkId))
        }
        return mutation(SHARE_LINKS_REVOKE, args).jsonPrimitive.content
    }

    /** Public resolver for shared passports — NO auth, token only. Null when expired/revoked. */
    suspend fun resolvePassport(token: String): PassportPayload? {
        val args = buildJsonObject {
            put("token", JsonPrimitive(token))
        }
        val value = query(SHARE_LINKS_RESOLVE, args)
        if (value is JsonNull) return null
        return PetdocsJson.decodeFromJsonElement(PassportPayload.serializer(), value)
    }

    /** Increments the link view counter. Null when the token is no longer live. */
    suspend fun recordView(token: String): Int? {
        val args = buildJsonObject {
            put("token", JsonPrimitive(token))
        }
        val value = mutation(SHARE_LINKS_RECORD_VIEW, args)
        if (value is JsonNull) return null
        return value.jsonPrimitive.contentOrNull?.toIntOrNull()
    }
}
