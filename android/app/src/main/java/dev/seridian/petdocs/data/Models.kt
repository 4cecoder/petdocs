package dev.seridian.petdocs.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * DTOs mirroring the mobile HTTP surface in convex/http.ts (#24). Field
 * names must stay in lockstep with the server; unknown fields are ignored
 * so the backend can evolve without breaking older builds.
 */
@Serializable
data class AuthRequestResponse(
    val ok: Boolean = false,
    /** A send was attempted for a valid, non-cooldown request. */
    val attempted: Boolean = false,
    /** Resend accepted the email. */
    val delivered: Boolean = false,
    /** Resend reported 429/quota exhaustion — retry after UTC midnight. */
    val quotaExceeded: Boolean = false,
    /** ISO timestamp of the next 00:00 UTC when quotaExceeded is true. */
    val retryAfterUtc: String? = null,
)

@Serializable
data class VerifyResponse(
    val ok: Boolean = false,
    val sessionToken: String? = null,
    val ownerId: String? = null,
    /** Epoch ms; sessions live 30 days. */
    val expiresAt: Long? = null,
    /** Honest failure reason: invalid / already used / expired. */
    val error: String? = null,
)

@Serializable
data class Pet(
    @SerialName("_id") val id: String,
    val name: String,
    val species: String,
    val breed: String? = null,
    val sex: String? = null,
    val birthdate: Long? = null,
    val weightKg: Double? = null,
    val microchipId: String? = null,
    val color: String? = null,
    val status: String,
)

@Serializable
data class MeResponse(
    val ownerId: String,
    val email: String,
    val pets: List<Pet> = emptyList(),
)

@Serializable
data class Vaccination(
    @SerialName("_id") val id: String,
    val vaccineName: String,
    val status: String,
    val administeredAt: Long? = null,
    val dueAt: Long? = null,
    val provider: String? = null,
)

@Serializable
data class VetVisit(
    @SerialName("_id") val id: String,
    val visitedAt: Long,
    val reason: String,
    val clinicName: String? = null,
    val vetName: String? = null,
    val diagnosis: String? = null,
)

@Serializable
data class VaultDoc(
    @SerialName("_id") val id: String,
    val name: String,
    val category: String? = null,
    val mime: String,
    val size: Long,
    val createdAt: Long,
)

@Serializable
data class PetSummaryResponse(
    val pet: Pet,
    val vaccinations: List<Vaccination> = emptyList(),
    val visits: List<VetVisit> = emptyList(),
    val documents: List<VaultDoc> = emptyList(),
)

/** Shared parser — ignoreUnknownKeys keeps old builds forward-compatible. */
val petdocsJson: Json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
}
