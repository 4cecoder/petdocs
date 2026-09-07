import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const status = v.union(
  v.literal("due"),
  v.literal("administered"),
  v.literal("overdue"),
  v.literal("waived"),
);

export const listByPet = query({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    status: v.optional(status),
  },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) return [];
    if (args.status) {
      return await ctx.db
        .query("vaccinations")
        .withIndex("by_petId_and_status", (q) =>
          q.eq("petId", args.petId).eq("status", args.status!),
        )
        .collect();
    }
    return await ctx.db
      .query("vaccinations")
      .withIndex("by_petId", (q) => q.eq("petId", args.petId))
      .collect();
  },
});

export const dueSoon = query({
  args: { ownerId: v.id("owners"), daysAhead: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() + (args.daysAhead ?? 30) * 24 * 60 * 60 * 1000;
    const all = await ctx.db
      .query("vaccinations")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    return all.filter(
      (vac) =>
        (vac.status === "due" || vac.status === "overdue") &&
        vac.dueAt !== undefined &&
        vac.dueAt <= cutoff,
    );
  },
});

export const create = mutation({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    vaccineName: v.string(),
    dueAt: v.optional(v.number()),
    provider: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) throw new Error("Pet not found");
    return await ctx.db.insert("vaccinations", {
      ownerId: args.ownerId,
      petId: args.petId,
      vaccineName: args.vaccineName,
      status: "due",
      dueAt: args.dueAt,
      provider: args.provider,
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

export const markAdministered = mutation({
  args: {
    ownerId: v.id("owners"),
    vaccinationId: v.id("vaccinations"),
    administeredAt: v.optional(v.number()),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const vac = await ctx.db.get(args.vaccinationId);
    if (!vac || vac.ownerId !== args.ownerId) throw new Error("Vaccination not found");
    await ctx.db.patch(args.vaccinationId, {
      status: "administered",
      administeredAt: args.administeredAt ?? Date.now(),
      documentId: args.documentId,
    });
    return args.vaccinationId;
  },
});

export const flipOverdue = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("vaccinations")
      .filter((q) => q.eq(q.field("status"), "due"))
      .collect();
    let flipped = 0;
    for (const vac of due) {
      if (vac.dueAt !== undefined && vac.dueAt < now) {
        await ctx.db.patch(vac._id, { status: "overdue" });
        flipped += 1;
      }
    }
    return flipped;
  },
});
