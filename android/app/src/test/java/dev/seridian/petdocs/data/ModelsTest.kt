package dev.seridian.petdocs.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.serialization.builtins.ListSerializer

/**
 * Parsing tests for the DTO shapes served by convex/http.ts (#24). The JSON
 * fixtures here are the contract — convex-side tests assert the same shapes.
 */
class ModelsTest {

    private fun parseAuthRequest(body: String): AuthRequestResponse =
        petdocsJson.decodeFromString(AuthRequestResponse.serializer(), body)

    private fun parseVerify(body: String): VerifyResponse =
        petdocsJson.decodeFromString(VerifyResponse.serializer(), body)

    @Test
    fun `auth request with quota exhaustion parses honestly`() {
        val res = parseAuthRequest(
            """
            {"ok":true,"attempted":true,"delivered":false,
             "quotaExceeded":true,"retryAfterUtc":"2026-09-16T00:00:00.000Z"}
            """.trimIndent(),
        )
        assertTrue(res.ok)
        assertTrue(res.quotaExceeded)
        assertFalse(res.delivered)
        assertEquals("2026-09-16T00:00:00.000Z", res.retryAfterUtc)
    }

    @Test
    fun `auth request quiet state (cooldown or invalid email)`() {
        val res = parseAuthRequest(
            """{"ok":true,"attempted":false,"delivered":false,"quotaExceeded":false}""",
        )
        assertFalse(res.attempted)
        assertFalse(res.quotaExceeded)
        assertNull(res.retryAfterUtc)
    }

    @Test
    fun `verify success parses session token and expiry`() {
        val res = parseVerify(
            """
            {"ok":true,"sessionToken":"cafe1234","ownerId":"owner_1",
             "expiresAt":1790000000000}
            """.trimIndent(),
        )
        assertTrue(res.ok)
        assertEquals("cafe1234", res.sessionToken)
        assertEquals("owner_1", res.ownerId)
        assertEquals(1790000000000L, res.expiresAt)
        assertNull(res.error)
    }

    @Test
    fun `verify single-use failure keeps the honest error message`() {
        val res = parseVerify(
            """{"ok":false,"error":"This sign-in link has already been used."}""",
        )
        assertFalse(res.ok)
        assertEquals("This sign-in link has already been used.", res.error)
        assertNull(res.sessionToken)
    }

    @Test
    fun `me response maps _id to pet id and ignores unknown fields`() {
        val me = petdocsJson.decodeFromString(
            MeResponse.serializer(),
            """
            {"ownerId":"owner_1","email":"owner@example.com",
             "pets":[
               {"_id":"pet_1","name":"Rex","species":"dog","breed":"Shiba",
                "sex":"male","weightKg":12.5,"microchipId":"9001",
                "status":"active","futureField":true}
             ]}
            """.trimIndent(),
        )
        assertEquals("owner@example.com", me.email)
        assertEquals(1, me.pets.size)
        val rex = me.pets.first()
        assertEquals("pet_1", rex.id)
        assertEquals("Rex", rex.name)
        assertEquals(12.5, rex.weightKg)
        assertNull(rex.color)
    }

    @Test
    fun `pet summary parses vitals plus recent records`() {
        val summary = petdocsJson.decodeFromString(
            PetSummaryResponse.serializer(),
            """
            {"pet":{"_id":"pet_1","name":"Rex","species":"dog","status":"active"},
             "vaccinations":[
               {"_id":"v_1","vaccineName":"Rabies","status":"administered",
                "administeredAt":1757000000000,"provider":"Dr. Woo"}
             ],
             "visits":[
               {"_id":"vi_1","visitedAt":1756900000000,"reason":"Annual checkup",
                "clinicName":"Woo Clinic"}
             ],
             "documents":[
               {"_id":"d_1","name":"vaccine-card.pdf","category":"vaccine_record",
                "mime":"application/pdf","size":1024,"createdAt":1756800000000}
             ]}
            """.trimIndent(),
        )
        assertEquals("Rex", summary.pet.name)
        assertEquals("Rabies", summary.vaccinations.first().vaccineName)
        assertEquals("Annual checkup", summary.visits.first().reason)
        assertEquals("vaccine-card.pdf", summary.documents.first().name)
    }

    @Test
    fun `pets list survives an empty array`() {
        val me = petdocsJson.decodeFromString(
            MeResponse.serializer(),
            """{"ownerId":"owner_1","email":"x@example.com","pets":[]}""",
        )
        assertTrue(me.pets.isEmpty())
    }

    @Test
    fun `pet list serializer round trip keeps ids`() {
        val pet = Pet(id = "p1", name = "Mia", species = "cat", status = "active")
        val encoded = petdocsJson.encodeToString(
            ListSerializer(Pet.serializer()),
            listOf(pet),
        )
        assertTrue(encoded.contains("\"_id\":\"p1\""))
    }
}
