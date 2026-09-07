package com.petdocs.android.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Shared lenient JSON for all Convex payloads. */
val PetdocsJson: Json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    coerceInputValues = true
    encodeDefaults = true
}

/** Mirrors `docCategory` union in convex/schema.ts + convex/documents.ts. */
@Serializable
enum class DocCategory(val value: String) {
    @SerialName("vaccine_record")
    VACCINE_RECORD("vaccine_record"),

    @SerialName("lab_result")
    LAB_RESULT("lab_result"),

    @SerialName("prescription")
    PRESCRIPTION("prescription"),

    @SerialName("insurance")
    INSURANCE("insurance"),

    @SerialName("microchip")
    MICROCHIP("microchip"),

    @SerialName("travel_certificate")
    TRAVEL_CERTIFICATE("travel_certificate"),

    @SerialName("photo")
    PHOTO("photo"),

    @SerialName("other")
    OTHER("other");

    companion object {
        fun fromValue(value: String?): DocCategory? =
            entries.firstOrNull { it.value == value }
    }
}

/** Mirrors `status` union in convex/vaccinations.ts. */
@Serializable
enum class VaccineStatus(val value: String) {
    @SerialName("due")
    DUE("due"),

    @SerialName("administered")
    ADMINISTERED("administered"),

    @SerialName("overdue")
    OVERDUE("overdue"),

    @SerialName("waived")
    WAIVED("waived");

    companion object {
        fun fromValue(value: String?): VaccineStatus? =
            entries.firstOrNull { it.value == value }
    }
}

@Serializable
data class Pet(
    @SerialName("_id") val id: String,
    val ownerId: String,
    val name: String,
    val species: String,
    val breed: String? = null,
    val sex: String? = null,
    val birthdate: Long? = null,
    val weightKg: Double? = null,
    val microchipId: String? = null,
    val color: String? = null,
    val avatarStorageId: String? = null,
    val status: String = "active",
    val isFavorite: Boolean = false,
    val locked: Boolean = false,
    val createdAt: Long = 0L,
)

@Serializable
data class VaultDoc(
    @SerialName("_id") val id: String,
    val ownerId: String,
    val petId: String,
    val name: String,
    val storageId: String,
    val mime: String,
    val size: Long = 0L,
    val category: DocCategory? = null,
    val tags: List<String> = emptyList(),
    val notes: String? = null,
    val extractedText: String? = null,
    val linkedVaccinationId: String? = null,
    val linkedVisitId: String? = null,
    val uploadedBy: String = "",
    val createdAt: Long = 0L,
    val isFavorite: Boolean = false,
    val isTrash: Boolean = false,
    val deletedAt: Long? = null,
)

@Serializable
data class Vaccination(
    @SerialName("_id") val id: String,
    val ownerId: String,
    val petId: String,
    val vaccineName: String,
    val status: VaccineStatus = VaccineStatus.DUE,
    val dueAt: Long? = null,
    val administeredAt: Long? = null,
    val provider: String? = null,
    val documentId: String? = null,
    val notes: String? = null,
    val createdAt: Long = 0L,
)

@Serializable
data class Medication(
    @SerialName("_id") val id: String,
    val ownerId: String,
    val petId: String,
    val name: String,
    val dosage: String,
    val frequency: String,
    val startAt: Long = 0L,
    val endAt: Long? = null,
    val status: String = "active",
    val instructions: String? = null,
    val documentId: String? = null,
    val createdAt: Long = 0L,
)

@Serializable
data class VetVisit(
    @SerialName("_id") val id: String,
    val ownerId: String,
    val petId: String,
    val visitedAt: Long = 0L,
    val clinicName: String? = null,
    val vetName: String? = null,
    val reason: String = "",
    val diagnosis: String? = null,
    val notes: String? = null,
    val weightKg: Double? = null,
    val documentIds: List<String> = emptyList(),
    val createdAt: Long = 0L,
)

@Serializable
data class ReminderItem(
    @SerialName("_id") val id: String,
    val ownerId: String,
    val petId: String,
    val kind: String = "custom",
    val title: String = "",
    val dueAt: Long = 0L,
    val status: String = "scheduled",
    val relatedVaccinationId: String? = null,
    val relatedMedicationId: String? = null,
    val relatedVisitId: String? = null,
    val createdAt: Long = 0L,
)

@Serializable
data class ShareLink(
    @SerialName("_id") val id: String,
    val ownerId: String,
    val petId: String,
    val token: String,
    val scope: String = "passport",
    val label: String? = null,
    val expiresAt: Long? = null,
    val maxViews: Int? = null,
    val viewCount: Int = 0,
    val isActive: Boolean = true,
    val revokedAt: Long? = null,
    val createdAt: Long = 0L,
)

// --- Public passport projection (shareLinks:resolve, NO auth) ---

@Serializable
data class PassportPet(
    val name: String = "",
    val species: String = "",
    val breed: String? = null,
    val birthdate: Long? = null,
)

@Serializable
data class VaccineLine(
    val vaccineName: String = "",
    val status: VaccineStatus = VaccineStatus.DUE,
    val administeredAt: Long? = null,
    val dueAt: Long? = null,
)

@Serializable
data class DocUrl(
    val id: String = "",
    val name: String = "",
    val category: DocCategory? = null,
    val url: String? = null,
)

@Serializable
data class PassportPayload(
    val scope: String = "passport",
    val pet: PassportPet = PassportPet(),
    val vaccinations: List<VaccineLine> = emptyList(),
    val documents: List<DocUrl> = emptyList(),
)

/**
 * Derives the display status for a vaccination: a row stored as `due` whose
 * due date has passed is shown as `overdue`. All other states pass through.
 */
fun vaccineStatusFor(
    dueAt: Long?,
    status: VaccineStatus,
    now: Long = System.currentTimeMillis(),
): VaccineStatus {
    if (status != VaccineStatus.DUE) return status
    if (dueAt != null && dueAt < now) return VaccineStatus.OVERDUE
    return VaccineStatus.DUE
}

/** Stringly-typed overload for rows decoded without the enum. */
fun vaccineStatusFor(
    dueAt: Long?,
    status: String?,
    now: Long = System.currentTimeMillis(),
): VaccineStatus {
    val parsed = VaccineStatus.fromValue(status) ?: VaccineStatus.DUE
    return vaccineStatusFor(dueAt, parsed, now)
}

/** Masks a microchip id, keeping only the last 4 characters visible. */
fun maskChip(full: String): String {
    if (full.isBlank()) return ""
    val last4 = full.takeLast(4)
    return "••••$last4"
}
