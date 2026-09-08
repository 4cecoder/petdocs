import Foundation

// Thin Convex HTTP client. Same function surface as the web app and the
// Android PetdocsApi. Transport: POST {convexUrl}/api/query|mutation with
// { path, args, format: "json" }, unwrapping the { value } envelope.
enum PetdocsError: Error, LocalizedError {
    case http(Int, String)
    case convex(String)
    case uploadFailed
    case badURL

    var errorDescription: String? {
        switch self {
        case .http(let status, let message):
            return "Request failed (HTTP \(status)): \(message)"
        case .convex(let message):
            return message
        case .uploadFailed:
            return "Document upload failed. Check your connection and try again."
        case .badURL:
            return "The server address looks wrong. Check it in Settings."
        }
    }
}

// Return of shareLinks:createToken. The token is a capability, never log it.
struct ShareToken: Equatable {
    let linkId: String
    let token: String
}

final class ConvexAPI {
    static let petsList = "pets:listByOwner"
    static let petsGet = "pets:get"
    static let petsCreate = "pets:create"

    static let documentsGenerateUploadUrl = "documents:generateUploadUrl"
    static let documentsCreate = "documents:create"
    static let documentsListByPet = "documents:listByPet"
    static let documentsGetUrl = "documents:getUrl"

    static let vaccinationsListByPet = "vaccinations:listByPet"
    static let vaccinationsDueSoon = "vaccinations:dueSoon"

    static let medicationsListByPet = "medications:listByPet"
    static let vetVisitsListByPet = "vetVisits:listByPet"

    static let remindersListByOwner = "reminders:listByOwner"
    static let remindersSetStatus = "reminders:setStatus"

    static let shareLinksCreateToken = "shareLinks:createToken"
    static let shareLinksListByPet = "shareLinks:listByPet"
    static let shareLinksRevoke = "shareLinks:revoke"
    static let shareLinksResolve = "shareLinks:resolve"
    static let shareLinksRecordView = "shareLinks:recordView"

    let convexUrl: String
    let session: URLSession

    init(convexUrl: String, session: URLSession = .shared) {
        self.convexUrl = convexUrl
        self.session = session
    }

    private var base: String {
        var url = convexUrl
        while url.hasSuffix("/") { url.removeLast() }
        return url
    }

    private func args(_ pairs: [(String, Any?)]) -> [String: Any] {
        var out: [String: Any] = [:]
        for (key, value) in pairs {
            if let value { out[key] = value }
        }
        return out
    }

    private func query(_ path: String, args: [String: Any] = [:]) async throws -> Any? {
        try await post(endpoint: "api/query", path: path, args: args)
    }

    private func mutation(_ path: String, args: [String: Any] = [:]) async throws -> Any? {
        try await post(endpoint: "api/mutation", path: path, args: args)
    }

    private func post(endpoint: String, path: String, args: [String: Any]) async throws -> Any? {
        guard let url = URL(string: "\(base)/\(endpoint)") else {
            throw PetdocsError.badURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["path": path, "args": args, "format": "json"]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw PetdocsError.http(-1, "No response from server")
        }
        guard (200..<300).contains(http.statusCode) else {
            let snippet = String(data: data, encoding: .utf8).map { String($0.prefix(300)) } ?? ""
            throw PetdocsError.http(
                http.statusCode,
                "Convex \(path) failed: HTTP \(http.statusCode) \(snippet)".trimmingCharacters(in: .whitespaces)
            )
        }
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        if let message = (json["errorMessage"] as? String) ?? (json["error"] as? String) {
            throw PetdocsError.convex(message)
        }
        if json["value"] is NSNull { return nil }
        return json["value"]
    }

    private func decodeList<T: Decodable>(_ value: Any?) throws -> [T] {
        guard let value, !(value is NSNull) else { return [] }
        let data = try JSONSerialization.data(withJSONObject: value)
        return try JSONDecoder().decode([T].self, from: data)
    }

    private func decodeObject<T: Decodable>(_ value: Any?) throws -> T? {
        guard let value, !(value is NSNull) else { return nil }
        guard value is [String: Any] else { return nil }
        let data = try JSONSerialization.data(withJSONObject: value)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func decodeString(_ value: Any?) -> String? {
        value as? String
    }

    // MARK: - Pets (convex/pets.ts)

    func listPets(ownerId: String, status: String? = nil) async throws -> [Pet] {
        let value = try await query(Self.petsList, args: args([
            ("ownerId", ownerId), ("status", status)
        ]))
        return try decodeList(value)
    }

    func getPet(ownerId: String, petId: String) async throws -> Pet? {
        let value = try await query(Self.petsGet, args: args([
            ("ownerId", ownerId), ("petId", petId)
        ]))
        return try decodeObject(value)
    }

    func createPet(
        ownerId: String, name: String, species: String,
        breed: String? = nil, birthdate: Int64? = nil,
        weightKg: Double? = nil, microchipId: String? = nil
    ) async throws -> String {
        let value = try await mutation(Self.petsCreate, args: args([
            ("ownerId", ownerId), ("name", name), ("species", species),
            ("breed", breed), ("birthdate", birthdate),
            ("weightKg", weightKg), ("microchipId", microchipId)
        ]))
        guard let id = decodeString(value) else { throw PetdocsError.convex("Could not create pet") }
        return id
    }

    // MARK: - Documents (convex/documents.ts)

    // Three calls: documents:generateUploadUrl, raw PUT of the bytes to the
    // signed URL, then documents:create. Returns the new document id.
    func uploadDocument(
        ownerId: String, petId: String, name: String, doc: Data, mime: String,
        category: DocCategory? = nil, notes: String? = nil, uploadedBy: String
    ) async throws -> String {
        let urlValue = try await mutation(Self.documentsGenerateUploadUrl)
        guard let urlString = decodeString(urlValue), let uploadURL = URL(string: urlString) else {
            throw PetdocsError.uploadFailed
        }
        var put = URLRequest(url: uploadURL)
        put.httpMethod = "PUT"
        put.setValue(mime, forHTTPHeaderField: "Content-Type")
        put.httpBody = doc
        let (putData, putResponse) = try await session.data(for: put)
        guard let putHTTP = putResponse as? HTTPURLResponse,
              (200..<300).contains(putHTTP.statusCode) else {
            throw PetdocsError.uploadFailed
        }
        let putJson = (try? JSONSerialization.jsonObject(with: putData)) as? [String: Any]
        guard let storageId = putJson?["storageId"] as? String else {
            throw PetdocsError.uploadFailed
        }
        let created = try await mutation(Self.documentsCreate, args: args([
            ("ownerId", ownerId), ("petId", petId), ("name", name),
            ("storageId", storageId), ("mime", mime), ("size", doc.count),
            ("category", category?.rawValue), ("notes", notes),
            ("uploadedBy", uploadedBy)
        ]))
        guard let id = decodeString(created) else { throw PetdocsError.uploadFailed }
        return id
    }

    func listDocs(ownerId: String, petId: String, category: DocCategory? = nil) async throws -> [VaultDoc] {
        let value = try await query(Self.documentsListByPet, args: args([
            ("ownerId", ownerId), ("petId", petId), ("category", category?.rawValue)
        ]))
        return try decodeList(value)
    }

    func getDocUrl(ownerId: String, documentId: String) async throws -> String? {
        let value = try await query(Self.documentsGetUrl, args: args([
            ("ownerId", ownerId), ("documentId", documentId)
        ]))
        return decodeString(value)
    }

    // MARK: - Vaccinations (convex/vaccinations.ts)

    func listVaccinations(
        ownerId: String, petId: String, status: VaccineStatus? = nil
    ) async throws -> [Vaccination] {
        let value = try await query(Self.vaccinationsListByPet, args: args([
            ("ownerId", ownerId), ("petId", petId), ("status", status?.rawValue)
        ]))
        return try decodeList(value)
    }

    func dueSoon(ownerId: String, daysAhead: Int? = nil) async throws -> [Vaccination] {
        let value = try await query(Self.vaccinationsDueSoon, args: args([
            ("ownerId", ownerId), ("daysAhead", daysAhead)
        ]))
        return try decodeList(value)
    }

    // MARK: - Medications (convex/medications.ts)

    func listMedications(
        ownerId: String, petId: String, status: String? = nil
    ) async throws -> [Medication] {
        let value = try await query(Self.medicationsListByPet, args: args([
            ("ownerId", ownerId), ("petId", petId), ("status", status)
        ]))
        return try decodeList(value)
    }

    // MARK: - Vet visits (convex/vetVisits.ts)

    func listVisits(ownerId: String, petId: String, limit: Int? = nil) async throws -> [VetVisit] {
        let value = try await query(Self.vetVisitsListByPet, args: args([
            ("ownerId", ownerId), ("petId", petId), ("limit", limit)
        ]))
        return try decodeList(value)
    }

    // MARK: - Reminders (convex/reminders.ts)

    func listReminders(ownerId: String, upcomingOnly: Bool? = nil) async throws -> [ReminderItem] {
        let value = try await query(Self.remindersListByOwner, args: args([
            ("ownerId", ownerId), ("upcomingOnly", upcomingOnly)
        ]))
        return try decodeList(value)
    }

    // Status must be done or dismissed (backend-validated). Returns the id.
    func setReminder(ownerId: String, reminderId: String, status: String) async throws -> String {
        let value = try await mutation(Self.remindersSetStatus, args: args([
            ("ownerId", ownerId), ("reminderId", reminderId), ("status", status)
        ]))
        guard let id = decodeString(value) else { throw PetdocsError.convex("Could not update reminder") }
        return id
    }

    // MARK: - Share links (convex/shareLinks.ts)

    func createShareToken(
        ownerId: String, petId: String, scope: String,
        label: String? = nil, expiresAt: Int64? = nil, maxViews: Int? = nil
    ) async throws -> ShareToken {
        let value = try await mutation(Self.shareLinksCreateToken, args: args([
            ("ownerId", ownerId), ("petId", petId), ("scope", scope),
            ("label", label), ("expiresAt", expiresAt), ("maxViews", maxViews)
        ]))
        guard let obj = value as? [String: Any],
              let linkId = obj["linkId"] as? String,
              let token = obj["token"] as? String else {
            throw PetdocsError.convex("Could not create share link")
        }
        return ShareToken(linkId: linkId, token: token)
    }

    func listShareLinks(ownerId: String, petId: String) async throws -> [ShareLink] {
        let value = try await query(Self.shareLinksListByPet, args: args([
            ("ownerId", ownerId), ("petId", petId)
        ]))
        return try decodeList(value)
    }

    func revokeShareLink(ownerId: String, linkId: String) async throws -> String {
        let value = try await mutation(Self.shareLinksRevoke, args: args([
            ("ownerId", ownerId), ("linkId", linkId)
        ]))
        guard let id = decodeString(value) else { throw PetdocsError.convex("Could not revoke link") }
        return id
    }

    // Public resolver for shared passports. No auth, token only.
    // Returns nil when the link is expired or revoked.
    func resolvePassport(token: String) async throws -> PassportPayload? {
        let value = try await query(Self.shareLinksResolve, args: args([("token", token)]))
        return try decodeObject(value)
    }

    // Bumps the link view counter. Nil when the token is no longer live.
    func recordView(token: String) async throws -> Int? {
        let value = try await mutation(Self.shareLinksRecordView, args: args([("token", token)]))
        return value as? Int
    }
}
