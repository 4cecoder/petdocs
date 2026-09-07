import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByPet = query({
  args: { ownerId: v.id("owners"), petId: v.id("pets"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) return [];
    const visits = await ctx.db
      .query("vetVisits")
      .withIndex("by_petId", (q) => q.eq("petId", args.petId))
      .order("desc")
      .take(args.limit ?? 50);
    return visits;
  },
});

export const create = mutation({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    visitedAt: v.number(),
    reason: v.string(),
    clinicName: v.optional(v.string()),
    vetName: v.optional(v.string()),
    diagnosis: v.optional(v.string()),
    notes: v.optional(v.string()),
    weightKg: v.optional(v.number()),
    documentIds: v.optional(v.array(v.id("documents"))),
  },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) throw new Error("Pet not found");
    return await ctx.db.insert("vetVisits", {
      ownerId: args.ownerId,
      petId: args.petId,
      visitedAt: args.visitedAt,
      reason: args.reason,
      clinicName: args.clinicName,
      vetName: args.vetName,
      diagnosis: args.diagnosis,
      notes: args.notes,
      weightKg: args.weightKg,
      documentIds: args.documentIds,
      createdAt: Date.now(),
    });
  },
});

export const attachDocument = mutation({
  args: {
    ownerId: v.id("owners"),
    visitId: v.id("vetVisits"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const visit = await ctx.db.get(args.visitId);
    if (!visit || visit.ownerId !== args.ownerId) throw new Error("Visit not found");
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== args.ownerId) throw new Error("Document not found");
    const ids = visit.documentIds ?? [];
    if (!ids.includes(args.documentId)) ids.push(args.documentId);
    await ctx.db.patch(args.visitId, { documentIds: ids });
    await ctx.db.patch(args.documentId, { linkedVisitId: args.visitId });
    return args.visitId;
  },
});
