import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const frequency = v.union(
  v.literal("once_daily"),
  v.literal("twice_daily"),
  v.literal("weekly"),
  v.literal("monthly"),
  v.literal("as_needed"),
);

const medStatus = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("paused"),
);

export const listByPet = query({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    status: v.optional(medStatus),
  },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) return [];
    if (args.status) {
      return await ctx.db
        .query("medications")
        .withIndex("by_petId_and_status", (q) =>
          q.eq("petId", args.petId).eq("status", args.status!),
        )
        .collect();
    }
    return await ctx.db
      .query("medications")
      .withIndex("by_petId", (q) => q.eq("petId", args.petId))
      .collect();
  },
});

export const create = mutation({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    name: v.string(),
    dosage: v.string(),
    frequency,
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
    instructions: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) throw new Error("Pet not found");
    return await ctx.db.insert("medications", {
      ownerId: args.ownerId,
      petId: args.petId,
      name: args.name,
      dosage: args.dosage,
      frequency: args.frequency,
      startAt: args.startAt ?? Date.now(),
      endAt: args.endAt,
      status: "active",
      instructions: args.instructions,
      documentId: args.documentId,
      createdAt: Date.now(),
    });
  },
});

export const setStatus = mutation({
  args: {
    ownerId: v.id("owners"),
    medicationId: v.id("medications"),
    status: medStatus,
  },
  handler: async (ctx, args) => {
    const med = await ctx.db.get(args.medicationId);
    if (!med || med.ownerId !== args.ownerId) throw new Error("Medication not found");
    await ctx.db.patch(args.medicationId, { status: args.status });
    return args.medicationId;
  },
});
