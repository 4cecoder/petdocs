import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";

const kind = v.union(
  v.literal("vaccination"),
  v.literal("medication"),
  v.literal("vet_visit"),
  v.literal("custom"),
);

const reminderStatus = v.union(
  v.literal("scheduled"),
  v.literal("sent"),
  v.literal("done"),
  v.literal("dismissed"),
);

export const listByOwner = query({
  args: { ownerId: v.id("owners"), upcomingOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("reminders")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    const list = args.upcomingOnly
      ? all.filter((r) => r.status === "scheduled" || r.status === "sent")
      : all;
    return list.sort((a, b) => a.dueAt - b.dueAt);
  },
});

export const listByPet = query({
  args: { ownerId: v.id("owners"), petId: v.id("pets") },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) return [];
    return await ctx.db
      .query("reminders")
      .withIndex("by_petId", (q) => q.eq("petId", args.petId))
      .collect();
  },
});

export const create = mutation({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    kind,
    title: v.string(),
    dueAt: v.number(),
    relatedVaccinationId: v.optional(v.id("vaccinations")),
    relatedMedicationId: v.optional(v.id("medications")),
  },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) throw new Error("Pet not found");
    return await ctx.db.insert("reminders", {
      ownerId: args.ownerId,
      petId: args.petId,
      kind: args.kind,
      title: args.title,
      dueAt: args.dueAt,
      status: "scheduled",
      relatedVaccinationId: args.relatedVaccinationId,
      relatedMedicationId: args.relatedMedicationId,
      createdAt: Date.now(),
    });
  },
});

export const setStatus = mutation({
  args: {
    ownerId: v.id("owners"),
    reminderId: v.id("reminders"),
    status: v.union(v.literal("done"), v.literal("dismissed")),
  },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || reminder.ownerId !== args.ownerId) {
      throw new Error("Reminder not found");
    }
    await ctx.db.patch(args.reminderId, { status: args.status });
    return args.reminderId;
  },
});

// --- Reminder tick (driven hourly by crons.ts "reminder tick") ---

export const dueForTick = internalQuery({
  args: { now: v.number(), horizon: v.number() },
  handler: async (ctx, args) => {
    // Range on the leading index field (dueAt <= horizon covers both upcoming
    // and already-past-due rows); status narrowed via post-filter so the
    // compound-index query stays valid. `now` documents the tick time and lets
    // callers bound the window (horizon = now + 24h).
    const inWindow = await ctx.db
      .query("reminders")
      .withIndex("by_dueAt_and_status", (q) => q.lte("dueAt", args.horizon))
      .collect();
    return inWindow.filter((r) => r.status === "scheduled");
  },
});

export const markSent = internalMutation({
  args: { reminderId: v.id("reminders") },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    // Idempotent: only flip scheduled → sent (skip done/dismissed/already-sent).
    if (!reminder || reminder.status !== "scheduled") return null;
    await ctx.db.patch(args.reminderId, { status: "sent" });
    return args.reminderId;
  },
});

export const sendDue = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const now = Date.now();
    const horizon = now + 24 * 60 * 60 * 1000; // now + 24h
    const due = await ctx.runQuery(internal.reminders.dueForTick, {
      now,
      horizon,
    });
    let marked = 0;
    for (const reminder of due) {
      // TODO: actually send before marking — via resend (owner email, e.g.
      // ctx.runAction(internal.resend.sendEmail, {...}) once the owner email
      // is resolved) / FCM (push). Skipped for now with zero logging by
      // design (no console.* — a secret must never reach logs); only the
      // status flip runs, so the tick pipeline is exercised end-to-end and
      // markSent stays idempotent once the real send lands.
      const id = await ctx.runMutation(internal.reminders.markSent, {
        reminderId: reminder._id,
      });
      if (id) marked += 1;
    }
    return marked;
  },
});
