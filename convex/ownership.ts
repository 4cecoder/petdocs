import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRole } from "./admin";

const claimMethod = v.union(
  v.literal("microchip"),
  v.literal("vet_record"),
  v.literal("transfer_code"),
);

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

// Deterministic chip check: strip non-digits from both sides, require at
// least 9 digits on each side, then require the shorter value to equal the
// suffix of the longer value. This covers full 15-digit entry plus short
// 9-digit suffix entry without any fuzzy matching.
function chipMatches(
  stored: string | undefined,
  evidence: string,
): boolean {
  if (!stored) return false;
  const a = digitsOnly(stored);
  const b = digitsOnly(evidence);
  if (a.length < 9 || b.length < 9) return false;
  const n = Math.min(a.length, b.length);
  return a.slice(-n) === b.slice(-n);
}

const TRANSFER_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TRANSFER_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function randomTransferCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) {
    out += TRANSFER_CHARSET[byte % TRANSFER_CHARSET.length];
  }
  return out;
}

/**
 * File a proof-of-ownership claim. Always creates a pending claim first,
 * then auto-approves only when method is microchip and the digit suffix
 * matches pet.microchipId. Approval is recorded on the claim status only,
 * the pet row is never patched here.
 */
export const claimPet = mutation({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    method: claimMethod,
    evidence: v.string(),
  },
  handler: async (ctx, args) => {
    const evidence = args.evidence.trim();
    if (!evidence) throw new Error("Evidence is required");
    if (evidence.length > 1000) throw new Error("Evidence is too long");
    const pet = await ctx.db.get(args.petId);
    if (!pet) throw new Error("Pet not found");
    const claimant = await ctx.db.get(args.ownerId);
    if (!claimant) throw new Error("Owner not found");

    const autoApproved =
      args.method === "microchip" && chipMatches(pet.microchipId, evidence);
    const status = autoApproved ? "approved" : "pending";

    const claimId = await ctx.db.insert("ownershipClaims", {
      petId: args.petId,
      claimantOwnerId: args.ownerId,
      method: args.method,
      evidence,
      status,
      createdAt: Date.now(),
    });
    return { claimId, status };
  },
});

/**
 * Support review for manual methods (vet_record, transfer_code, and
 * non-matching microchip). Requires support role or above.
 */
export const reviewClaim = mutation({
  args: {
    adminEmail: v.string(),
    claimId: v.id("ownershipClaims"),
    approve: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { owner: actor } = await requireRole(ctx, args.adminEmail, "support");
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    const status = args.approve ? "approved" : "rejected";
    await ctx.db.patch(args.claimId, { status, reviewedBy: actor._id });
    await ctx.db.insert("adminAudit", {
      actorOwnerId: actor._id,
      action: args.approve ? "reviewClaim approved" : "reviewClaim rejected",
      target: `claim:${claim._id}`,
      createdAt: Date.now(),
    });
    return { claimId: args.claimId, status };
  },
});

/**
 * Owner-only handoff code. 6-char code from crypto, expires in 7 days.
 */
export const createTransfer = mutation({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
  },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) throw new Error("Pet not found");

    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomTransferCode();
      const existing = await ctx.db
        .query("transfers")
        .withIndex("by_code", (q) => q.eq("code", candidate))
        .unique();
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not create transfer code");

    const expiresAt = Date.now() + TRANSFER_DAYS_MS;
    const transferId = await ctx.db.insert("transfers", {
      petId: args.petId,
      fromOwnerId: args.ownerId,
      code,
      expiresAt,
      createdAt: Date.now(),
    });
    return { transferId, code, expiresAt };
  },
});

/**
 * Redeem a transfer code as a different owner. Moves the pet row plus all
 * child rows scoped by petId to the new owner, revokes old share links,
 * marks the transfer used, and writes one adminAudit row with the new
 * owner as actor. Returns the petId.
 */
export const redeemTransfer = mutation({
  args: {
    ownerId: v.id("owners"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase();
    if (!code) throw new Error("Transfer code is required");
    const transfer = await ctx.db
      .query("transfers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!transfer) throw new Error("Invalid transfer code");
    if (transfer.claimedBy) throw new Error("Transfer code already used");
    if (Date.now() >= transfer.expiresAt)
      throw new Error("Transfer code expired");

    const pet = await ctx.db.get(transfer.petId);
    if (!pet) throw new Error("Pet not found");
    if (pet.ownerId === args.ownerId) throw new Error("Already the owner");
    const nextOwner = await ctx.db.get(args.ownerId);
    if (!nextOwner) throw new Error("Owner not found");

    const now = Date.now();
    await ctx.db.patch(pet._id, { ownerId: args.ownerId });

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const doc of docs) {
      await ctx.db.patch(doc._id, { ownerId: args.ownerId });
    }

    const vaccines = await ctx.db
      .query("vaccinations")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const row of vaccines) {
      await ctx.db.patch(row._id, { ownerId: args.ownerId });
    }

    const meds = await ctx.db
      .query("medications")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const row of meds) {
      await ctx.db.patch(row._id, { ownerId: args.ownerId });
    }

    const visits = await ctx.db
      .query("vetVisits")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const row of visits) {
      await ctx.db.patch(row._id, { ownerId: args.ownerId });
    }

    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const row of reminders) {
      await ctx.db.patch(row._id, { ownerId: args.ownerId });
    }

    const links = await ctx.db
      .query("shareLinks")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const link of links) {
      await ctx.db.patch(link._id, {
        ownerId: args.ownerId,
        isActive: false,
        revokedAt: now,
      });
    }

    await ctx.db.patch(transfer._id, { claimedBy: args.ownerId });
    await ctx.db.insert("adminAudit", {
      actorOwnerId: args.ownerId,
      action: "redeemTransfer",
      target: `pet:${pet._id}`,
      createdAt: now,
    });

    return { petId: pet._id };
  },
});
