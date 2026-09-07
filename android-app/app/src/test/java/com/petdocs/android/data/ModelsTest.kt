package com.petdocs.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for [Models.kt] helpers — JSON round-trips via [PetdocsJson]
 * (which must tolerate unknown keys from newer backends), [vaccineStatusFor]
 * display-status logic, [maskChip], and the [DocCategory]/[VaccineStatus]
 * value mappings.
 *
 * NOTE (validator parity gap): the web app validates uploads in
 * `src/lib/validators.ts` (`ALLOWED_DOC_MIME` = application/pdf, image/jpeg,
 * image/png, image/webp, image/heic; `MAX_DOC_BYTES` = 10MB; empty files
 * rejected). `Models.kt` has no equivalent (`validateDocUpload` /
 * allowed-mime consts do not exist), so there is nothing to test here — an
 * Android-side validator (e.g. in `Models.kt` or `PetdocsApi.kt`) still needs
 * to be added to reach parity.
 */
class ModelsTest {

    // --- JSON round-trips ---

    @Test
    fun petRoundTrip() {
        val pet = Pet(
            id = "pet1",
            ownerId = "owner1",
            name = "Miso",
            species = "cat",
            breed = "Siamese",
            microchipId = "985141012345678",
        )
        val decoded = PetdocsJson.decodeFromString(Pet.serializer(), PetdocsJson.encodeToString(Pet.serializer(), pet))
        assertEquals(pet, decoded)
    }

    @Test
    fun petIgnoresUnknownKeys() {
        val decoded = PetdocsJson.decodeFromString<Pet>(
            Pet.serializer(),
            """{"_id":"pet1","ownerId":"owner1","name":"Miso","species":"cat","someFutureField":"x"}""",
        )
        assertEquals("Miso", decoded.name)
        assertEquals("pet1", decoded.id)
    }

    @Test
    fun vaccinationRoundTrip() {
        val vax = Vaccination(
            id = "vax1",
            ownerId = "owner1",
            petId = "pet1",
            vaccineName = "Rabies",
            status = VaccineStatus.ADMINISTERED,
            administeredAt = 1_700_000_000_000L,
        )
        val decoded = PetdocsJson.decodeFromString(
            Vaccination.serializer(),
            PetdocsJson.encodeToString(Vaccination.serializer(), vax),
        )
        assertEquals(vax, decoded)
    }

    @Test
    fun vaccinationIgnoresUnknownKeys() {
        val decoded = PetdocsJson.decodeFromString<Vaccination>(
            Vaccination.serializer(),
            """{"_id":"vax1","ownerId":"owner1","petId":"pet1","vaccineName":"Rabies","status":"due","futureFlag":true}""",
        )
        assertEquals(VaccineStatus.DUE, decoded.status)
    }

    @Test
    fun reminderRoundTrip() {
        val reminder = ReminderItem(
            id = "rem1",
            ownerId = "owner1",
            petId = "pet1",
            kind = "vaccination",
            title = "Rabies booster",
            dueAt = 1_800_000_000_000L,
        )
        val decoded = PetdocsJson.decodeFromString(
            ReminderItem.serializer(),
            PetdocsJson.encodeToString(ReminderItem.serializer(), reminder),
        )
        assertEquals(reminder, decoded)
    }

    @Test
    fun reminderIgnoresUnknownKeys() {
        val decoded = PetdocsJson.decodeFromString<ReminderItem>(
            ReminderItem.serializer(),
            """{"_id":"rem1","ownerId":"owner1","petId":"pet1","title":"Nails","dueAt":42,"bogus":1}""",
        )
        assertEquals("Nails", decoded.title)
    }

    // --- vaccineStatusFor (enum overload) ---

    @Test
    fun dueWithFutureDateStaysDue() {
        assertEquals(
            VaccineStatus.DUE,
            vaccineStatusFor(dueAt = 2_000_000_000_000L, status = VaccineStatus.DUE, now = 1_000L),
        )
    }

    @Test
    fun dueWithPastDateBecomesOverdue() {
        assertEquals(
            VaccineStatus.OVERDUE,
            vaccineStatusFor(dueAt = 500L, status = VaccineStatus.DUE, now = 1_000L),
        )
    }

    @Test
    fun administeredPassesThroughEvenWhenPast() {
        assertEquals(
            VaccineStatus.ADMINISTERED,
            vaccineStatusFor(dueAt = 500L, status = VaccineStatus.ADMINISTERED, now = 1_000L),
        )
    }

    @Test
    fun overduePassesThrough() {
        assertEquals(
            VaccineStatus.OVERDUE,
            vaccineStatusFor(dueAt = null, status = VaccineStatus.OVERDUE, now = 1_000L),
        )
    }

    @Test
    fun waivedPassesThrough() {
        assertEquals(
            VaccineStatus.WAIVED,
            vaccineStatusFor(dueAt = 500L, status = VaccineStatus.WAIVED, now = 1_000L),
        )
    }

    @Test
    fun dueWithNullDateStaysDue() {
        assertEquals(
            VaccineStatus.DUE,
            vaccineStatusFor(dueAt = null, status = VaccineStatus.DUE, now = 1_000L),
        )
    }

    // --- vaccineStatusFor (string overload) ---

    @Test
    fun stringOverloadDuePastBecomesOverdue() {
        assertEquals(
            VaccineStatus.OVERDUE,
            vaccineStatusFor(dueAt = 500L, status = "due", now = 1_000L),
        )
    }

    @Test
    fun stringOverloadUnknownDefaultsToDue() {
        // Unknown strings fall back to DUE, then due-date logic applies.
        assertEquals(
            VaccineStatus.OVERDUE,
            vaccineStatusFor(dueAt = 500L, status = "bogus", now = 1_000L),
        )
        assertEquals(
            VaccineStatus.DUE,
            vaccineStatusFor(dueAt = null, status = "bogus", now = 1_000L),
        )
    }

    @Test
    fun stringOverloadNullDefaultsToDue() {
        assertEquals(
            VaccineStatus.DUE,
            vaccineStatusFor(dueAt = null, status = null, now = 1_000L),
        )
    }

    // --- maskChip ---

    @Test
    fun maskChipKeepsLastFour() {
        assertEquals("••••5678", maskChip("985141012345678"))
    }

    @Test
    fun maskChipBlankIsEmpty() {
        assertEquals("", maskChip(""))
        assertEquals("", maskChip("   "))
    }

    @Test
    fun maskChipShortInput() {
        assertEquals("••••123", maskChip("123"))
    }

    // --- DocCategory / VaccineStatus mappings ---

    @Test
    fun docCategoryFromValueKnown() {
        assertEquals(DocCategory.VACCINE_RECORD, DocCategory.fromValue("vaccine_record"))
        assertEquals(DocCategory.PHOTO, DocCategory.fromValue("photo"))
    }

    @Test
    fun docCategoryFromValueUnknownIsNull() {
        // NOTE: Models.kt returns null (not OTHER) for unknown values.
        assertNull(DocCategory.fromValue("carrier_pigeon"))
    }

    @Test
    fun docCategoryFromValueNullIsNull() {
        assertNull(DocCategory.fromValue(null))
    }

    @Test
    fun vaccineStatusFromValue() {
        assertEquals(VaccineStatus.DUE, VaccineStatus.fromValue("due"))
        assertNull(VaccineStatus.fromValue("expired"))
        assertNull(VaccineStatus.fromValue(null))
    }
}
