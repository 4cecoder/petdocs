import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;

const DEMO_EMAILS = ["maya@demo.pet", "sam@demo.pet"] as const;

// NOTE on `locked`: the schema defines `locked` ONLY on `owners` and `pets`.
// vaccinations / medications / vetVisits / reminders / shareLinks have no such
// field, so passing `locked` there would fail validation. We set it wherever
// the schema allows (owners + pets); the rest are demo-curated by association.
//
// NOTE on `documents`: that table requires a real `storageId` (an `_storage`
// id) which cannot be fabricated from a mutation. So this seed creates ZERO
// document rows — upload docs via the UI after seeding (generateUploadUrl ->
// POST -> create), then link them back via `documentId` / `linkedVaccinationId`.
// For the same reason, all `documentId` / `documentIds` refs below are left
// unset.

function token(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

async function findDemoOwners(ctx: MutationCtx) {
  const found = [];
  for (const email of DEMO_EMAILS) {
    const owner = await ctx.db
      .query("owners")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (owner) found.push(owner);
  }
  return found;
}

async function wipeOwner(
  ctx: MutationCtx,
  ownerId: Id<"owners">,
): Promise<void> {
  const pets = await ctx.db
    .query("pets")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .collect();

  for (const pet of pets) {
    const vaccinations = await ctx.db
      .query("vaccinations")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const row of vaccinations) await ctx.db.delete(row._id);

    const medications = await ctx.db
      .query("medications")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const row of medications) await ctx.db.delete(row._id);

    const visits = await ctx.db
      .query("vetVisits")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const row of visits) await ctx.db.delete(row._id);

    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const row of reminders) await ctx.db.delete(row._id);

    const links = await ctx.db
      .query("shareLinks")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const row of links) await ctx.db.delete(row._id);

    // Docs are never created by this seed, but a reset after UI uploads
    // should clean those up too (rows + backing storage blobs).
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_petId", (q) => q.eq("petId", pet._id))
      .collect();
    for (const doc of docs) {
      try {
        await ctx.storage.delete(doc.storageId);
      } catch {
        // Blob already gone — still delete the row.
      }
      await ctx.db.delete(doc._id);
    }

    await ctx.db.delete(pet._id);
  }

  // Belt-and-braces: owner-level rows not tied to a pet (none today, but
  // keeps reset correct if the schema grows owner-scoped rows).
  const ownerTables = [
    "vaccinations",
    "medications",
    "vetVisits",
    "reminders",
    "shareLinks",
    "documents",
  ] as const;
  for (const table of ownerTables) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .collect();
    for (const row of rows) {
      if (table === "documents") {
        // `row` is a union over all owner tables, so narrow via cast.
        const storageId = (row as unknown as { storageId: Id<"_storage"> })
          .storageId;
        try {
          await ctx.storage.delete(storageId);
        } catch {
          // Blob already gone — still delete the row.
        }
      }
      await ctx.db.delete(row._id);
    }
  }

  await ctx.db.delete(ownerId);
}

export const seedDemo = mutation({
  args: { reset: v.optional(v.boolean()) },
  handler: async (ctx, { reset }) => {
    const existing = await findDemoOwners(ctx);
    if (existing.length > 0 && reset !== true) {
      throw new Error("already seeded (pass {reset:true})");
    }
    for (const owner of existing) {
      await wipeOwner(ctx, owner._id);
    }

    const now = Date.now();
    const dhppDueAt = now + 20 * DAY_MS;

    // ---- Owners ----
    const mayaId = await ctx.db.insert("owners", {
      externalId: "demo-maya-chen",
      name: "Maya Chen",
      email: "maya@demo.pet",
      locked: true,
      createdAt: now,
    });
    const samId = await ctx.db.insert("owners", {
      externalId: "demo-sam-reyes",
      name: "Sam Reyes",
      email: "sam@demo.pet",
      locked: true,
      createdAt: now,
    });

    // ---- Pets ----
    const mochiId = await ctx.db.insert("pets", {
      ownerId: mayaId,
      name: "Mochi",
      species: "dog",
      breed: "Shiba Inu",
      sex: "female",
      birthdate: Date.UTC(2021, 3, 2),
      weightKg: 9.5,
      microchipId: "985141012345678",
      color: "cream",
      status: "active",
      locked: true,
      createdAt: now,
    });
    const udonId = await ctx.db.insert("pets", {
      ownerId: mayaId,
      name: "Udon",
      species: "cat",
      breed: "British Shorthair",
      sex: "male",
      birthdate: Date.UTC(2023, 5, 15),
      weightKg: 5.2,
      status: "active",
      locked: true,
      createdAt: now,
    });
    const pickleId = await ctx.db.insert("pets", {
      ownerId: samId,
      name: "Pickle",
      species: "dog",
      breed: "Corgi",
      sex: "male",
      birthdate: Date.UTC(2020, 8, 10),
      weightKg: 12,
      status: "active",
      locked: true,
      createdAt: now,
    });

    // ---- Vaccinations (documentId left unset — see note above) ----
    await ctx.db.insert("vaccinations", {
      ownerId: mayaId,
      petId: mochiId,
      vaccineName: "Rabies",
      status: "administered",
      administeredAt: Date.UTC(2025, 2, 10),
      createdAt: now,
    });
    const dhppId = await ctx.db.insert("vaccinations", {
      ownerId: mayaId,
      petId: mochiId,
      vaccineName: "DHPP",
      status: "due",
      dueAt: dhppDueAt,
      notes: "Booster due — drives the reminder demo",
      createdAt: now,
    });
    await ctx.db.insert("vaccinations", {
      ownerId: mayaId,
      petId: udonId,
      vaccineName: "FVRCP",
      status: "administered",
      administeredAt: Date.UTC(2025, 6, 12),
      createdAt: now,
    });
    await ctx.db.insert("vaccinations", {
      ownerId: samId,
      petId: pickleId,
      vaccineName: "Bordetella",
      status: "administered",
      administeredAt: Date.UTC(2025, 8, 5),
      createdAt: now,
    });

    // ---- Medications ----
    await ctx.db.insert("medications", {
      ownerId: mayaId,
      petId: mochiId,
      name: "Apoquel",
      dosage: "16mg",
      frequency: "once_daily",
      startAt: Date.UTC(2026, 2, 1),
      status: "active",
      instructions: "Give 16mg by mouth once daily with food.",
      createdAt: now,
    });

    // ---- Vet visits ----
    await ctx.db.insert("vetVisits", {
      ownerId: mayaId,
      petId: mochiId,
      visitedAt: Date.UTC(2026, 2, 1),
      clinicName: "Maple St Vet",
      reason: "Annual wellness exam",
      diagnosis: "Healthy",
      weightKg: 9.5,
      createdAt: now,
    });
    await ctx.db.insert("vetVisits", {
      ownerId: samId,
      petId: pickleId,
      visitedAt: Date.UTC(2026, 7, 20),
      reason: "Pre-flight health check",
      diagnosis: "Fit to fly",
      weightKg: 12,
      createdAt: now,
    });

    // ---- Reminders ----
    await ctx.db.insert("reminders", {
      ownerId: mayaId,
      petId: mochiId,
      kind: "vaccination",
      title: "Mochi DHPP booster",
      dueAt: dhppDueAt,
      status: "scheduled",
      relatedVaccinationId: dhppId,
      createdAt: now,
    });
    await ctx.db.insert("reminders", {
      ownerId: samId,
      petId: pickleId,
      kind: "vet_visit",
      title: "Pickle annual exam",
      dueAt: now + 30 * DAY_MS,
      status: "scheduled",
      createdAt: now,
    });

    // ---- Share links ----
    await ctx.db.insert("shareLinks", {
      ownerId: mayaId,
      petId: mochiId,
      token: token("demo_mochi_groomer"),
      scope: "passport",
      label: "Groomer",
      viewCount: 0,
      isActive: true,
      createdAt: now,
    });
    await ctx.db.insert("shareLinks", {
      ownerId: samId,
      petId: pickleId,
      token: token("demo_pickle_airline"),
      scope: "full_vault",
      label: "Airline",
      expiresAt: now + 7 * DAY_MS,
      viewCount: 0,
      isActive: true,
      createdAt: now,
    });

    return {
      owners: 2,
      pets: 3,
      vaccinations: 4,
      medications: 1,
      vetVisits: 2,
      reminders: 2,
      shareLinks: 2,
      documents: 0,
      reset: reset === true && existing.length > 0,
    };
  },
});
