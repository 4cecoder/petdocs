import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * GDPR-style data rights for petdocs (server-only, never import from src/).
 *
 * exportData: one JSONable snapshot of everything owned by an owner.
 * deleteAccount: full wipe after exact email confirm, in dependency order.
 */
export const exportData = query({
  args: { ownerId: v.id("owners") },
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) throw new Error("Owner not found");

    const [pets, documents, vaccinations, medications, vetVisits, reminders, links] =
      await Promise.all([
        ctx.db
          .query("pets")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
          .collect(),
        ctx.db
          .query("documents")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
          .collect(),
        ctx.db
          .query("vaccinations")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
          .collect(),
        ctx.db
          .query("medications")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
          .collect(),
        ctx.db
          .query("vetVisits")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
          .collect(),
        ctx.db
          .query("reminders")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
          .collect(),
        ctx.db
          .query("shareLinks")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
          .collect(),
      ]);

    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.storageId),
      })),
    );

    // Never include raw token strings. Label, scope, and viewCount stay
    // so the owner can see what was shared without leaking capability URLs.
    const shareLinks = links.map((link) => ({
      _id: link._id,
      _creationTime: link._creationTime,
      ownerId: link.ownerId,
      petId: link.petId,
      label: link.label,
      scope: link.scope,
      expiresAt: link.expiresAt,
      maxViews: link.maxViews,
      viewCount: link.viewCount,
      isActive: link.isActive,
      revokedAt: link.revokedAt,
      createdAt: link.createdAt,
    }));

    return {
      owner,
      pets,
      documents: documentsWithUrls,
      vaccinations,
      medications,
      vetVisits,
      reminders,
      shareLinks,
    };
  },
});

export const deleteAccount = mutation({
  args: { ownerId: v.id("owners"), confirmEmail: v.string() },
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) throw new Error("Owner not found");
    if (owner.email !== args.confirmEmail) {
      throw new Error("Email does not match");
    }

    const shareLinks = await ctx.db
      .query("shareLinks")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    for (const row of shareLinks) {
      await ctx.db.delete(row._id);
    }

    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    for (const row of reminders) {
      await ctx.db.delete(row._id);
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    for (const doc of documents) {
      try {
        await ctx.storage.delete(doc.storageId);
      } catch {
        // Best effort: blob may already be gone, still delete the row.
      }
      await ctx.db.delete(doc._id);
    }

    const vaccinations = await ctx.db
      .query("vaccinations")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    for (const row of vaccinations) {
      await ctx.db.delete(row._id);
    }

    const medications = await ctx.db
      .query("medications")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    for (const row of medications) {
      await ctx.db.delete(row._id);
    }

    const vetVisits = await ctx.db
      .query("vetVisits")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    for (const row of vetVisits) {
      await ctx.db.delete(row._id);
    }

    const pets = await ctx.db
      .query("pets")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    for (const row of pets) {
      await ctx.db.delete(row._id);
    }

    const magicTokens = await ctx.db
      .query("magicTokens")
      .withIndex("by_email", (q) => q.eq("email", owner.email))
      .collect();
    for (const row of magicTokens) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(owner._id);

    return {
      deleted: {
        shareLinks: shareLinks.length,
        reminders: reminders.length,
        documents: documents.length,
        vaccinations: vaccinations.length,
        medications: medications.length,
        vetVisits: vetVisits.length,
        pets: pets.length,
        magicTokens: magicTokens.length,
        owners: 1,
      },
    };
  },
});
