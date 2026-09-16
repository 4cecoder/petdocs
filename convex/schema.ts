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

/**
 * Doc pipeline status machine:
 * uploaded -> processing -> ready | needsReview | needsOcr | failed(error)
 * Rows created before the pipeline have no status (optional field); the UI
 * treats missing status as legacy "ready".
 */
export const docPipelineStatus = v.union(
  v.literal("uploaded"),
  v.literal("processing"),
  v.literal("ready"),
  v.literal("needsReview"),
  v.literal("needsOcr"),
  v.literal("failed"),
);

export const docPipelineType = v.union(
  v.literal("vaccination"),
  v.literal("vet_visit"),
  v.literal("medication"),
  v.literal("lab"),
  v.literal("other"),
);

export const extractedField = v.object({
  label: v.string(),
  value: v.string(),
});

export const docPipelineMetadata = v.object({
  type: docPipelineType,
  confidence: v.number(),
  fields: v.array(extractedField),
  needsReview: v.boolean(),
  ocrUsed: v.optional(v.boolean()),
  processedAt: v.number(),
});

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
        v.literal("superadmin"),
      ),
    ),
    // Billing block (Polar.sh entitlements, synced only from verified
    // webhooks in convex/polarHttp.ts — never from client args).
    // Kept as top-level fields (not a nested `billing` object) so
    // polarCustomerId can be indexed for O(log n) webhook lookups.
    // activeTierOf() in convex/billing.ts treats the tier as expired once
    // currentPeriodEnd is in the past.
    billingTier: v.optional(
      v.union(v.literal("free"), v.literal("plus"), v.literal("family")),
    ),
    polarCustomerId: v.optional(v.string()),
    polarSubId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"])
    .index("by_polarCustomerId", ["polarCustomerId"]),

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
    status: v.optional(docPipelineStatus),
    statusError: v.optional(v.string()),
    metadata: v.optional(docPipelineMetadata),
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
    .index("by_isFavorite", ["isFavorite"])
    .index("by_status", ["status"]),

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
    suggestionKey: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_petId", ["petId"])
    .index("by_ownerId", ["ownerId"])
    .index("by_petId_and_status", ["petId", "status"])
    .index("by_ownerId_and_petId_and_suggestionKey", [
      "ownerId",
      "petId",
      "suggestionKey",
    ])
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
    queuedNotifiedAt: v.optional(v.number()),
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

  // #39: one row per passport email send from the dashboard share tool.
  // Deliberately NOT in the staff mail tables (mailMessages is the team
  // inbox) — this is the owner-facing share-email history/outbox.
  shareEmails: defineTable({
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    linkId: v.id("shareLinks"),
    recipientEmail: v.string(),
    note: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_petId_and_recipient", ["petId", "recipientEmail"]),

  magicTokens: defineTable({
    email: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  ownershipClaims: defineTable({
    petId: v.id("pets"),
    claimantOwnerId: v.id("owners"),
    method: v.union(
      v.literal("microchip"),
      v.literal("vet_record"),
      v.literal("transfer_code"),
    ),
    evidence: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    reviewedBy: v.optional(v.id("owners")),
    createdAt: v.number(),
  })
    .index("by_petId", ["petId"])
    .index("by_status", ["status"]),

  transfers: defineTable({
    petId: v.id("pets"),
    fromOwnerId: v.id("owners"),
    code: v.string(),
    claimedBy: v.optional(v.id("owners")),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  staff: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("manager"),
      v.literal("support"),
      v.literal("auditor"),
      v.literal("superadmin"),
    ),
    active: v.boolean(),
    invitedBy: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  mailAccounts: defineTable({
    emailAddress: v.string(),
    label: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_email", ["emailAddress"]),

  mailThreads: defineTable({
    accountId: v.id("mailAccounts"),
    subject: v.string(),
    participants: v.array(v.string()),
    lastAt: v.number(),
    unread: v.boolean(),
    labels: v.array(v.string()),
  }).index("by_account", ["accountId"]),

  mailMessages: defineTable({
    threadId: v.id("mailThreads"),
    accountId: v.id("mailAccounts"),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
    labels: v.array(v.string()),
    sentAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
    resendId: v.optional(v.string()),
  }).index("by_thread", ["threadId"]),

  notifications: defineTable({
    ownerId: v.id("owners"),
    kind: v.union(
      v.literal("passport_view"),
      v.literal("reminder_sent"),
      v.literal("reminder_queued"),
      v.literal("claim_filed"),
      v.literal("inbound_mail"),
      v.literal("transfer_redeemed"),
      v.literal("team_invite"),
    ),
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_and_read", ["ownerId", "readAt"]),

  /**
   * Public contact-form submissions (/contact). Store-first: every accepted
   * message is persisted here even when the staff-inbox forward fails, so
   * nothing is lost if mail is not configured yet. Rate capped in
   * convex/contact.ts (per-email daily cap + global daily cap).
   */
  contactMessages: defineTable({
    name: v.string(),
    email: v.string(),
    message: v.string(),
    status: v.union(v.literal("new"), v.literal("handled")),
    forwarded: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),

  // Daily outbound email counter (one row per UTC day, e.g. day "2026-09-15").
  // Keyed by day so rollover at UTC midnight is just a fresh row at sent=0.
  outboxQuota: defineTable({
    day: v.string(),
    sent: v.number(),
    exhaustedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_day", ["day"]),

  // Mobile app sessions (#24): same hashed-token pattern as magicTokens —
  // only the SHA-256 of the session token is stored, never the token itself.
  mobileSessions: defineTable({
    ownerId: v.id("owners"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_ownerId", ["ownerId"]),

  // Mobile build hosting (#42): app packages published for the settings
  // "Mobile apps" panel + GET /api/builds/latest. Upload/finalize are
  // superadmin-only (convex/admin.ts allowlist); the download redirect is
  // public.
  apkBuilds: defineTable({
    platform: v.union(v.literal("android"), v.literal("ios")),
    version: v.string(),
    storageId: v.id("_storage"),
    sha256: v.string(),
    notes: v.optional(v.string()),
    uploadedBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_platform_and_createdAt", ["platform", "createdAt"])
    .index("by_platform", ["platform"]),
});
