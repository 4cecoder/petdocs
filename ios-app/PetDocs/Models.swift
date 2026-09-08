import Foundation

// Shared petdocs models. Mirrors Android data/Models.kt, web
// src/lib/validators.ts, and the Convex schema. Decoding is lenient:
// missing keys fall back to defaults so older payloads keep parsing.

// MIME types the vault accepts (mirrors web ALLOWED_DOC_MIME).
let ALLOWED_DOC_MIME: Set<String> = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic"
]

// Max accepted doc upload size: 10MB (mirrors web MAX_DOC_BYTES).
let MAX_DOC_BYTES: Int64 = 10 * 1024 * 1024

// Mirrors the docCategory union in convex/schema.ts.
enum DocCategory: String, Codable, CaseIterable {
    case vaccineRecord = "vaccine_record"
    case labResult = "lab_result"
    case prescription
    case insurance
    case microchip
    case travelCertificate = "travel_certificate"
    case photo
    case other
}

// Mirrors the status union in convex/vaccinations.ts.
enum VaccineStatus: String, Codable {
    case due
    case administered
    case overdue
    case waived
}

// Lenient decode helpers: missing or null keys yield the fallback.
extension KeyedDecodingContainer {
    func string(_ key: Key, or fallback: String = "") -> String {
        guard let outer = try? decodeIfPresent(String.self, forKey: key) else { return fallback }
        return outer
    }

    func optString(_ key: Key) -> String? {
        (try? decodeIfPresent(String.self, forKey: key)) ?? nil
    }

    func bool(_ key: Key, or fallback: Bool = false) -> Bool {
        guard let outer = try? decodeIfPresent(Bool.self, forKey: key) else { return fallback }
        return outer
    }

    func int(_ key: Key, or fallback: Int = 0) -> Int {
        guard let outer = try? decodeIfPresent(Int.self, forKey: key) else { return fallback }
        return outer
    }

    func optInt(_ key: Key) -> Int? {
        (try? decodeIfPresent(Int.self, forKey: key)) ?? nil
    }

    func int64(_ key: Key, or fallback: Int64 = 0) -> Int64 {
        guard let outer = try? decodeIfPresent(Int64.self, forKey: key) else { return fallback }
        return outer
    }

    func optInt64(_ key: Key) -> Int64? {
        (try? decodeIfPresent(Int64.self, forKey: key)) ?? nil
    }

    func optDouble(_ key: Key) -> Double? {
        (try? decodeIfPresent(Double.self, forKey: key)) ?? nil
    }

    func stringArray(_ key: Key) -> [String] {
        guard let outer = try? decodeIfPresent([String].self, forKey: key) else { return [] }
        return outer
    }
}

struct Pet: Codable, Identifiable, Equatable {
    var id: String
    var ownerId: String
    var name: String
    var species: String
    var breed: String?
    var sex: String?
    var birthdate: Int64?
    var weightKg: Double?
    var microchipId: String?
    var color: String?
    var avatarStorageId: String?
    var status: String
    var isFavorite: Bool
    var locked: Bool
    var createdAt: Int64

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case ownerId, name, species, breed, sex, birthdate, weightKg
        case microchipId, color, avatarStorageId, status, isFavorite, locked, createdAt
    }

    init(
        id: String = "", ownerId: String = "", name: String = "", species: String = "dog",
        breed: String? = nil, sex: String? = nil, birthdate: Int64? = nil,
        weightKg: Double? = nil, microchipId: String? = nil, color: String? = nil,
        avatarStorageId: String? = nil, status: String = "active",
        isFavorite: Bool = false, locked: Bool = false, createdAt: Int64 = 0
    ) {
        self.id = id
        self.ownerId = ownerId
        self.name = name
        self.species = species
        self.breed = breed
        self.sex = sex
        self.birthdate = birthdate
        self.weightKg = weightKg
        self.microchipId = microchipId
        self.color = color
        self.avatarStorageId = avatarStorageId
        self.status = status
        self.isFavorite = isFavorite
        self.locked = locked
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: c.string(.id), ownerId: c.string(.ownerId), name: c.string(.name),
            species: c.string(.species, or: "dog"), breed: c.optString(.breed),
            sex: c.optString(.sex), birthdate: c.optInt64(.birthdate),
            weightKg: c.optDouble(.weightKg), microchipId: c.optString(.microchipId),
            color: c.optString(.color), avatarStorageId: c.optString(.avatarStorageId),
            status: c.string(.status, or: "active"),
            isFavorite: c.bool(.isFavorite), locked: c.bool(.locked),
            createdAt: c.int64(.createdAt)
        )
    }
}

struct VaultDoc: Codable, Identifiable, Equatable {
    var id: String
    var ownerId: String
    var petId: String
    var name: String
    var storageId: String
    var mime: String
    var size: Int64
    var category: DocCategory
    var tags: [String]
    var notes: String?
    var extractedText: String?
    var linkedVaccinationId: String?
    var linkedVisitId: String?
    var uploadedBy: String
    var createdAt: Int64
    var isFavorite: Bool
    var isTrash: Bool
    var deletedAt: Int64?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case ownerId, petId, name, storageId, mime, size, category, tags, notes
        case extractedText, linkedVaccinationId, linkedVisitId, uploadedBy
        case createdAt, isFavorite, isTrash, deletedAt
    }

    init(
        id: String = "", ownerId: String = "", petId: String = "", name: String = "",
        storageId: String = "", mime: String = "application/pdf", size: Int64 = 0,
        category: DocCategory = .other, tags: [String] = [], notes: String? = nil,
        extractedText: String? = nil, linkedVaccinationId: String? = nil,
        linkedVisitId: String? = nil, uploadedBy: String = "", createdAt: Int64 = 0,
        isFavorite: Bool = false, isTrash: Bool = false, deletedAt: Int64? = nil
    ) {
        self.id = id
        self.ownerId = ownerId
        self.petId = petId
        self.name = name
        self.storageId = storageId
        self.mime = mime
        self.size = size
        self.category = category
        self.tags = tags
        self.notes = notes
        self.extractedText = extractedText
        self.linkedVaccinationId = linkedVaccinationId
        self.linkedVisitId = linkedVisitId
        self.uploadedBy = uploadedBy
        self.createdAt = createdAt
        self.isFavorite = isFavorite
        self.isTrash = isTrash
        self.deletedAt = deletedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: c.string(.id), ownerId: c.string(.ownerId), petId: c.string(.petId),
            name: c.string(.name), storageId: c.string(.storageId),
            mime: c.string(.mime, or: "application/pdf"), size: c.int64(.size),
            category: DocCategory(rawValue: c.string(.category, or: "other")) ?? .other,
            tags: c.stringArray(.tags), notes: c.optString(.notes),
            extractedText: c.optString(.extractedText),
            linkedVaccinationId: c.optString(.linkedVaccinationId),
            linkedVisitId: c.optString(.linkedVisitId),
            uploadedBy: c.string(.uploadedBy), createdAt: c.int64(.createdAt),
            isFavorite: c.bool(.isFavorite), isTrash: c.bool(.isTrash),
            deletedAt: c.optInt64(.deletedAt)
        )
    }
}

struct Vaccination: Codable, Identifiable, Equatable {
    var id: String
    var ownerId: String
    var petId: String
    var vaccineName: String
    var status: VaccineStatus
    var dueAt: Int64?
    var administeredAt: Int64?
    var provider: String?
    var documentId: String?
    var notes: String?
    var createdAt: Int64

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case ownerId, petId, vaccineName, status, dueAt, administeredAt
        case provider, documentId, notes, createdAt
    }

    init(
        id: String = "", ownerId: String = "", petId: String = "", vaccineName: String = "",
        status: VaccineStatus = .due, dueAt: Int64? = nil, administeredAt: Int64? = nil,
        provider: String? = nil, documentId: String? = nil, notes: String? = nil,
        createdAt: Int64 = 0
    ) {
        self.id = id
        self.ownerId = ownerId
        self.petId = petId
        self.vaccineName = vaccineName
        self.status = status
        self.dueAt = dueAt
        self.administeredAt = administeredAt
        self.provider = provider
        self.documentId = documentId
        self.notes = notes
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: c.string(.id), ownerId: c.string(.ownerId), petId: c.string(.petId),
            vaccineName: c.string(.vaccineName),
            status: VaccineStatus(rawValue: c.string(.status, or: "due")) ?? .due,
            dueAt: c.optInt64(.dueAt), administeredAt: c.optInt64(.administeredAt),
            provider: c.optString(.provider), documentId: c.optString(.documentId),
            notes: c.optString(.notes), createdAt: c.int64(.createdAt)
        )
    }
}

struct Medication: Codable, Identifiable, Equatable {
    var id: String
    var ownerId: String
    var petId: String
    var name: String
    var dosage: String
    var frequency: String
    var startAt: Int64
    var endAt: Int64?
    var status: String
    var instructions: String?
    var documentId: String?
    var createdAt: Int64

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case ownerId, petId, name, dosage, frequency, startAt, endAt
        case status, instructions, documentId, createdAt
    }

    init(
        id: String = "", ownerId: String = "", petId: String = "", name: String = "",
        dosage: String = "", frequency: String = "", startAt: Int64 = 0,
        endAt: Int64? = nil, status: String = "active", instructions: String? = nil,
        documentId: String? = nil, createdAt: Int64 = 0
    ) {
        self.id = id
        self.ownerId = ownerId
        self.petId = petId
        self.name = name
        self.dosage = dosage
        self.frequency = frequency
        self.startAt = startAt
        self.endAt = endAt
        self.status = status
        self.instructions = instructions
        self.documentId = documentId
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: c.string(.id), ownerId: c.string(.ownerId), petId: c.string(.petId),
            name: c.string(.name), dosage: c.string(.dosage),
            frequency: c.string(.frequency), startAt: c.int64(.startAt),
            endAt: c.optInt64(.endAt), status: c.string(.status, or: "active"),
            instructions: c.optString(.instructions),
            documentId: c.optString(.documentId), createdAt: c.int64(.createdAt)
        )
    }
}

struct VetVisit: Codable, Identifiable, Equatable {
    var id: String
    var ownerId: String
    var petId: String
    var visitedAt: Int64
    var clinicName: String?
    var vetName: String?
    var reason: String
    var diagnosis: String?
    var notes: String?
    var weightKg: Double?
    var documentIds: [String]
    var createdAt: Int64

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case ownerId, petId, visitedAt, clinicName, vetName, reason
        case diagnosis, notes, weightKg, documentIds, createdAt
    }

    init(
        id: String = "", ownerId: String = "", petId: String = "", visitedAt: Int64 = 0,
        clinicName: String? = nil, vetName: String? = nil, reason: String = "",
        diagnosis: String? = nil, notes: String? = nil, weightKg: Double? = nil,
        documentIds: [String] = [], createdAt: Int64 = 0
    ) {
        self.id = id
        self.ownerId = ownerId
        self.petId = petId
        self.visitedAt = visitedAt
        self.clinicName = clinicName
        self.vetName = vetName
        self.reason = reason
        self.diagnosis = diagnosis
        self.notes = notes
        self.weightKg = weightKg
        self.documentIds = documentIds
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: c.string(.id), ownerId: c.string(.ownerId), petId: c.string(.petId),
            visitedAt: c.int64(.visitedAt), clinicName: c.optString(.clinicName),
            vetName: c.optString(.vetName), reason: c.string(.reason),
            diagnosis: c.optString(.diagnosis), notes: c.optString(.notes),
            weightKg: c.optDouble(.weightKg), documentIds: c.stringArray(.documentIds),
            createdAt: c.int64(.createdAt)
        )
    }
}

struct ReminderItem: Codable, Identifiable, Equatable {
    var id: String
    var ownerId: String
    var petId: String
    var kind: String
    var title: String
    var dueAt: Int64
    var status: String
    var relatedVaccinationId: String?
    var relatedMedicationId: String?
    var relatedVisitId: String?
    var createdAt: Int64

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case ownerId, petId, kind, title, dueAt, status
        case relatedVaccinationId, relatedMedicationId, relatedVisitId, createdAt
    }

    init(
        id: String = "", ownerId: String = "", petId: String = "", kind: String = "custom",
        title: String = "", dueAt: Int64 = 0, status: String = "scheduled",
        relatedVaccinationId: String? = nil, relatedMedicationId: String? = nil,
        relatedVisitId: String? = nil, createdAt: Int64 = 0
    ) {
        self.id = id
        self.ownerId = ownerId
        self.petId = petId
        self.kind = kind
        self.title = title
        self.dueAt = dueAt
        self.status = status
        self.relatedVaccinationId = relatedVaccinationId
        self.relatedMedicationId = relatedMedicationId
        self.relatedVisitId = relatedVisitId
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: c.string(.id), ownerId: c.string(.ownerId), petId: c.string(.petId),
            kind: c.string(.kind, or: "custom"), title: c.string(.title),
            dueAt: c.int64(.dueAt), status: c.string(.status, or: "scheduled"),
            relatedVaccinationId: c.optString(.relatedVaccinationId),
            relatedMedicationId: c.optString(.relatedMedicationId),
            relatedVisitId: c.optString(.relatedVisitId),
            createdAt: c.int64(.createdAt)
        )
    }
}

struct ShareLink: Codable, Identifiable, Equatable {
    var id: String
    var ownerId: String
    var petId: String
    var token: String
    var scope: String
    var label: String?
    var expiresAt: Int64?
    var maxViews: Int?
    var viewCount: Int
    var isActive: Bool
    var revokedAt: Int64?
    var createdAt: Int64

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case ownerId, petId, token, scope, label, expiresAt, maxViews
        case viewCount, isActive, revokedAt, createdAt
    }

    init(
        id: String = "", ownerId: String = "", petId: String = "", token: String = "",
        scope: String = "passport", label: String? = nil, expiresAt: Int64? = nil,
        maxViews: Int? = nil, viewCount: Int = 0, isActive: Bool = true,
        revokedAt: Int64? = nil, createdAt: Int64 = 0
    ) {
        self.id = id
        self.ownerId = ownerId
        self.petId = petId
        self.token = token
        self.scope = scope
        self.label = label
        self.expiresAt = expiresAt
        self.maxViews = maxViews
        self.viewCount = viewCount
        self.isActive = isActive
        self.revokedAt = revokedAt
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: c.string(.id), ownerId: c.string(.ownerId), petId: c.string(.petId),
            token: c.string(.token), scope: c.string(.scope, or: "passport"),
            label: c.optString(.label), expiresAt: c.optInt64(.expiresAt),
            maxViews: c.optInt(.maxViews), viewCount: c.int(.viewCount),
            isActive: c.bool(.isActive, or: true), revokedAt: c.optInt64(.revokedAt),
            createdAt: c.int64(.createdAt)
        )
    }
}

// Public passport projection (shareLinks:resolve, no auth).
struct PassportPet: Codable, Equatable {
    var name: String
    var species: String
    var breed: String?
    var birthdate: Int64?

    init(name: String = "", species: String = "", breed: String? = nil, birthdate: Int64? = nil) {
        self.name = name
        self.species = species
        self.breed = breed
        self.birthdate = birthdate
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            name: c.string(.name), species: c.string(.species),
            breed: c.optString(.breed), birthdate: c.optInt64(.birthdate)
        )
    }

    private enum CodingKeys: String, CodingKey {
        case name, species, breed, birthdate
    }
}

struct VaccineLine: Codable, Equatable {
    var vaccineName: String
    var status: VaccineStatus
    var administeredAt: Int64?
    var dueAt: Int64?

    init(
        vaccineName: String = "", status: VaccineStatus = .due,
        administeredAt: Int64? = nil, dueAt: Int64? = nil
    ) {
        self.vaccineName = vaccineName
        self.status = status
        self.administeredAt = administeredAt
        self.dueAt = dueAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            vaccineName: c.string(.vaccineName),
            status: VaccineStatus(rawValue: c.string(.status, or: "due")) ?? .due,
            administeredAt: c.optInt64(.administeredAt), dueAt: c.optInt64(.dueAt)
        )
    }

    private enum CodingKeys: String, CodingKey {
        case vaccineName, status, administeredAt, dueAt
    }
}

struct DocUrl: Codable, Equatable {
    var id: String
    var name: String
    var category: DocCategory
    var url: String?

    init(id: String = "", name: String = "", category: DocCategory = .other, url: String? = nil) {
        self.id = id
        self.name = name
        self.category = category
        self.url = url
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: c.string(.id), name: c.string(.name),
            category: DocCategory(rawValue: c.string(.category, or: "other")) ?? .other,
            url: c.optString(.url)
        )
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, category, url
    }
}

struct PassportPayload: Codable, Equatable {
    var scope: String
    var pet: PassportPet
    var vaccinations: [VaccineLine]
    var documents: [DocUrl]

    init(
        scope: String = "passport", pet: PassportPet = PassportPet(),
        vaccinations: [VaccineLine] = [], documents: [DocUrl] = []
    ) {
        self.scope = scope
        self.pet = pet
        self.vaccinations = vaccinations
        self.documents = documents
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let pet = (try? c.decodeIfPresent(PassportPet.self, forKey: .pet)) ?? PassportPet()
        let vaccinations = (try? c.decodeIfPresent([VaccineLine].self, forKey: .vaccinations)) ?? []
        let documents = (try? c.decodeIfPresent([DocUrl].self, forKey: .documents)) ?? []
        self.init(
            scope: c.string(.scope, or: "passport"),
            pet: pet, vaccinations: vaccinations, documents: documents
        )
    }

    private enum CodingKeys: String, CodingKey {
        case scope, pet, vaccinations, documents
    }
}

// Display status for a vaccination: a row stored as due whose due date
// has passed shows as overdue. All other states pass through.
func vaccineStatus(
    dueAt: Int64?,
    status: VaccineStatus,
    nowMs: Int64 = Int64(Date().timeIntervalSince1970 * 1000)
) -> VaccineStatus {
    guard status == .due else { return status }
    if let dueAt, dueAt < nowMs { return .overdue }
    return .due
}

// Masks a microchip id, keeping only the last 4 visible.
func maskChip(_ full: String) -> String {
    guard !full.isEmpty else { return "" }
    return "••••" + String(full.suffix(4))
}

// Validates a doc upload. Returns nil when OK, else the user-facing
// message (same style as web validateDocUpload).
func validateDocUpload(mime: String, sizeBytes: Int64) -> String? {
    if !ALLOWED_DOC_MIME.contains(mime) {
        return "Unsupported file type: \(mime). Use PDF or a photo (JPG/PNG/WebP/HEIC)."
    }
    if sizeBytes <= 0 { return "File is empty." }
    if sizeBytes > MAX_DOC_BYTES {
        let mb = Int(round(Double(sizeBytes) / 1024.0 / 1024.0))
        return "File is too large (\(mb)MB). Max is 10MB."
    }
    return nil
}

// Validates a pet name (required, 60 chars max after trimming).
func validatePetName(_ name: String) -> String? {
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return "Pet name is required." }
    if trimmed.count > 60 { return "Pet name must be under 60 characters." }
    return nil
}
