import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Helper: resolve the calling owner from auth identity.
 * TODO(auth): wire to Convex auth (ctx.auth.getUserIdentity) + magic link.
 * Until then every function takes an explicit ownerId validated client-side
 * and re-checked against the pet row server-side.
 */
export const listByOwner = query({
  args: {
    ownerId: v.id("owners"),
    status: v.optional(
      v.union(v.literal("active"), v.literal("deceased"), v.literal("archived")),
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("pets")
        .withIndex("by_ownerId_and_status", (q) =>
          q.eq("ownerId", args.ownerId).eq("status", args.status!),
        )
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("pets")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { ownerId: v.id("owners"), petId: v.id("pets") },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) return null;
    return pet;
  },
});

export const create = mutation({
  args: {
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
    birthdate: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    microchipId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new Error("Pet name is required");
    return await ctx.db.insert("pets", {
      ownerId: args.ownerId,
      name,
      species: args.species,
      breed: args.breed,
      birthdate: args.birthdate,
      weightKg: args.weightKg,
      microchipId: args.microchipId,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    name: v.optional(v.string()),
    breed: v.optional(v.string()),
    weightKg: v.optional(v.number()),
    microchipId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) throw new Error("Pet not found");
    if (pet.locked) throw new Error("Seed record is locked");
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      if (!args.name.trim()) throw new Error("Pet name cannot be empty");
      patch.name = args.name.trim();
    }
    if (args.breed !== undefined) patch.breed = args.breed;
    if (args.weightKg !== undefined) patch.weightKg = args.weightKg;
    if (args.microchipId !== undefined) patch.microchipId = args.microchipId;
    await ctx.db.patch(args.petId, patch);
    return args.petId;
  },
});

export const archive = mutation({
  args: { ownerId: v.id("owners"), petId: v.id("pets") },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) throw new Error("Pet not found");
    await ctx.db.patch(args.petId, { status: "archived" });
    return args.petId;
  },
});
