import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const docCategory = v.union(
  v.literal("vaccine_record"),
  v.literal("lab_result"),
  v.literal("prescription"),
  v.literal("insurance"),
  v.literal("microchip"),
  v.literal("travel_certificate"),
  v.literal("photo"),
  v.literal("other"),
);

export default defineSchema({
  owners: defineTable({
    externalId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    locked: v.optional(v.boolean()),
    role: v.optional(
      v.union(
        v.literal("owner"),
        v.literal("support"),
        v.literal("admin"),
      ),
    ),
    createdAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"]),

  adminAudit: defineTable({
    actorOwnerId: v.id("owners"),
    action: v.string(),
    target: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_actor", ["actorOwnerId"]),

  pets: defineTable({
    ownerId: v.id("owners"),
    name: v.string(),
    species: v.union(
      v.literal("dog"),
      v.literal("cat"),
      v.literal("bird"),
      v.literal("rabbit"),
      v.literal("reptile"),
      v.literal("other"),
    ),
    breed: v.optional(v.string()),
    sex: v.optional(
      v.union(v.literal("male"), v.literal("female"), v.literal("unknown")),
    ),
    birthdate: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    microchipId: v.optional(v.string()),
    color: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("active"),
      v.literal("deceased"),
      v.literal("archived"),
    ),
    isFavorite: v.optional(v.boolean()),
    locked: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_ownerId_and_status", ["ownerId", "status"])
    .index("by_microchipId", ["microchipId"]),

  documents: defineTable({
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    name: v.string(),
    storageId: v.id("_storage"),
    mime: v.string(),
    size: v.number(),
    category: v.optional(docCategory),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    extractedText: v.optional(v.string()),
    linkedVaccinationId: v.optional(v.id("vaccinations")),
    linkedVisitId: v.optional(v.id("vetVisits")),
    uploadedBy: v.string(),
    createdAt: v.number(),
    isFavorite: v.optional(v.boolean()),
    isTrash: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_petId", ["petId"])
    .index("by_petId_and_category", ["petId", "category"])
    .index("by_isTrash", ["isTrash"])
    .index("by_isFavorite", ["isFavorite"]),

  vaccinations: defineTable({
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    vaccineName: v.string(),
    status: v.union(
      v.literal("due"),
      v.literal("administered"),
      v.literal("overdue"),
      v.literal("waived"),
    ),
    dueAt: v.optional(v.number()),
    administeredAt: v.optional(v.number()),
    provider: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_petId", ["petId"])
    .index("by_ownerId", ["ownerId"])
    .index("by_petId_and_status", ["petId", "status"])
    .index("by_dueAt", ["dueAt"]),

  medications: defineTable({
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    name: v.string(),
    dosage: v.string(),
    frequency: v.union(
      v.literal("once_daily"),
      v.literal("twice_daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("as_needed"),
    ),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("paused"),
    ),
    instructions: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
    createdAt: v.number(),
  })
    .index("by_petId", ["petId"])
    .index("by_ownerId", ["ownerId"])
    .index("by_petId_and_status", ["petId", "status"]),

  vetVisits: defineTable({
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    visitedAt: v.number(),
    clinicName: v.optional(v.string()),
    vetName: v.optional(v.string()),
    reason: v.string(),
    diagnosis: v.optional(v.string()),
    notes: v.optional(v.string()),
    weightKg: v.optional(v.number()),
    documentIds: v.optional(v.array(v.id("documents"))),
    createdAt: v.number(),
  })
    .index("by_petId", ["petId"])
    .index("by_ownerId", ["ownerId"]),

  reminders: defineTable({
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    kind: v.union(
      v.literal("vaccination"),
      v.literal("medication"),
      v.literal("vet_visit"),
      v.literal("custom"),
    ),
    title: v.string(),
    dueAt: v.number(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("done"),
      v.literal("dismissed"),
    ),
    relatedVaccinationId: v.optional(v.id("vaccinations")),
    relatedMedicationId: v.optional(v.id("medications")),
    relatedVisitId: v.optional(v.id("vetVisits")),
    createdAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_petId", ["petId"])
    .index("by_dueAt_and_status", ["dueAt", "status"])
    .index("by_petId_and_status", ["petId", "status"]),

  shareLinks: defineTable({
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    token: v.string(),
    scope: v.union(
      v.literal("passport"),
      v.literal("vaccines_only"),
      v.literal("full_vault"),
    ),
    label: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    maxViews: v.optional(v.number()),
    viewCount: v.number(),
    isActive: v.boolean(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_petId", ["petId"])
    .index("by_ownerId", ["ownerId"]),
});
