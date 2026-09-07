import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const scope = v.union(
  v.literal("passport"),
  v.literal("vaccines_only"),
  v.literal("full_vault"),
);

function tokenIsLive(link: { isActive: boolean; expiresAt?: number; maxViews?: number; viewCount: number }) {
  if (!link.isActive) return false;
  if (link.expiresAt !== undefined && Date.now() >= link.expiresAt) return false;
  if (link.maxViews !== undefined && link.viewCount >= link.maxViews) return false;
  return true;
}

export const createToken = mutation({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    scope,
    label: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    maxViews: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) throw new Error("Pet not found");
    // 256-bit random token, hex-encoded. Store a prefix for lookup safety;
    // full token is the capability — never log it.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const linkId = await ctx.db.insert("shareLinks", {
      ownerId: args.ownerId,
      petId: args.petId,
      token,
      scope: args.scope,
      label: args.label,
      expiresAt: args.expiresAt,
      maxViews: args.maxViews,
      viewCount: 0,
      isActive: true,
      createdAt: Date.now(),
    });
    return { linkId, token };
  },
});

export const listByPet = query({
  args: { ownerId: v.id("owners"), petId: v.id("pets") },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) return [];
    return await ctx.db
      .query("shareLinks")
      .withIndex("by_petId", (q) => q.eq("petId", args.petId))
      .order("desc")
      .collect();
  },
});

export const revoke = mutation({
  args: { ownerId: v.id("owners"), linkId: v.id("shareLinks") },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link || link.ownerId !== args.ownerId) throw new Error("Link not found");
    await ctx.db.patch(args.linkId, { isActive: false, revokedAt: Date.now() });
    return args.linkId;
  },
});

/**
 * Public resolver for `/p/[token]` — NO auth. Returns a shaped projection
 * per scope. Never returns owner email, storageIds, or other pets.
 */
export const resolve = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("shareLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!link || !tokenIsLive(link)) return null;

    const pet = await ctx.db.get(link.petId);
    if (!pet) return null;

    const vaccinations = await ctx.db
      .query("vaccinations")
      .withIndex("by_petId", (q) => q.eq("petId", link.petId))
      .collect();

    if (link.scope === "passport" || link.scope === "vaccines_only") {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_petId_and_category", (q) =>
          q.eq("petId", link.petId).eq("category", "vaccine_record"),
        )
        .collect();
      const travel =
        link.scope === "passport"
          ? await ctx.db
              .query("documents")
              .withIndex("by_petId_and_category", (q) =>
                q.eq("petId", link.petId).eq("category", "travel_certificate"),
              )
              .collect()
          : [];
      const visible = [...docs, ...travel].filter((d) => !d.isTrash);
      const urls = await Promise.all(
        visible.map(async (d) => ({
          id: d._id,
          name: d.name,
          category: d.category,
          url: await ctx.storage.getUrl(d.storageId),
        })),
      );
      return {
        scope: link.scope,
        pet: {
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          birthdate: pet.birthdate,
        },
        vaccinations: vaccinations.map((vac) => ({
          vaccineName: vac.vaccineName,
          status: vac.status,
          administeredAt: vac.administeredAt,
          dueAt: vac.dueAt,
        })),
        documents: urls,
      };
    }

    // full_vault — every non-trash doc, resolved to short-lived URLs.
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_petId", (q) => q.eq("petId", link.petId))
      .collect();
    const visible = docs.filter((d) => !d.isTrash);
    const urls = await Promise.all(
      visible.map(async (d) => ({
        id: d._id,
        name: d.name,
        category: d.category,
        url: await ctx.storage.getUrl(d.storageId),
      })),
    );
    return {
      scope: link.scope,
      pet: {
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        birthdate: pet.birthdate,
      },
      vaccinations: vaccinations.map((vac) => ({
        vaccineName: vac.vaccineName,
        status: vac.status,
        administeredAt: vac.administeredAt,
        dueAt: vac.dueAt,
      })),
      documents: urls,
    };
  },
});

export const recordView = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("shareLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!link || !tokenIsLive(link)) return null;
    await ctx.db.patch(link._id, { viewCount: link.viewCount + 1 });
    const nextCount = link.viewCount + 1;
    try {
      const pet = await ctx.db.get(link.petId);
      const petName = pet?.name ?? "Pet";
      await ctx.runMutation(internal.notifications.emit, {
        ownerId: link.ownerId,
        kind: "passport_view",
        title: `Someone viewed ${petName} passport`,
        body: `View #${nextCount} for ${petName}.`,
        link: "/dashboard/share",
      });
    } catch {
      // Notification failure must not break public view counting.
    }
    return nextCount;
  },
});
