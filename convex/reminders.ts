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

export const ownerEmail = internalQuery({
  args: { ownerId: v.id("owners") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    return owner?.email ?? null;
  },
});

export const reminderContext = internalQuery({
  args: { reminderId: v.id("reminders") },
  returns: v.union(
    v.object({
      email: v.union(v.string(), v.null()),
      petName: v.string(),
      title: v.string(),
      dueAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) return null;
    const [owner, pet] = await Promise.all([
      ctx.db.get(reminder.ownerId),
      ctx.db.get(reminder.petId),
    ]);
    return {
      email: owner?.email ?? null,
      petName: pet?.name ?? "your pet",
      title: reminder.title,
      dueAt: reminder.dueAt,
    };
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const DEFAULT_SITE_URL = "http://localhost:3000";

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
    let sent = 0;
    for (const reminder of due) {
      const context = await ctx.runQuery(internal.reminders.reminderContext, {
        reminderId: reminder._id,
      });
      if (!context || !context.email) continue;
      const { email, petName, title, dueAt } = context;
      const subject = `Reminder: ${title} for ${petName}`;
      const safeTitle = escapeHtml(title);
      const safePet = escapeHtml(petName);
      const dueLabel = escapeHtml(new Date(dueAt).toLocaleDateString());
      const siteUrl = (
        process.env.SITE_URL?.trim() || DEFAULT_SITE_URL
      ).replace(/\/+$/, "");
      const safeSiteUrl = escapeHtml(siteUrl);
      const html =
        `<!doctype html><html><body style="margin:0;padding:0;background-color:#FFFBF5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFBF5;padding:32px 16px;"><tr><td align="center">` +
        `<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border:1px solid #F0E2D3;border-radius:16px;overflow:hidden;">` +
        `<tr><td style="padding:32px 32px 8px 32px;"><div style="font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#0D9488;">PetDocs</div></td></tr>` +
        `<tr><td style="padding:8px 32px 0 32px;">` +
        `<h2 style="margin:0;font-size:18px;line-height:1.4;color:#1C1917;">Reminder: ${safeTitle} for ${safePet}</h2>` +
        `<p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#57534E;">Due: ${dueLabel}</p>` +
        `</td></tr>` +
        `<tr><td style="padding:24px 32px;">` +
        `<a href="${safeSiteUrl}" style="display:inline-block;background-color:#0D9488;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:999px;">Open petdocs</a>` +
        `</td></tr>` +
        `<tr><td style="padding:0 32px 32px 32px;">` +
        `<p style="margin:0;font-size:12px;line-height:1.6;color:#78716C;">Manage this reminder in petdocs.</p>` +
        `</td></tr>` +
        `</table></td></tr></table></body></html>`;
      const text = `Reminder: ${title} for ${petName} (due ${new Date(dueAt).toLocaleDateString()}). Open petdocs: ${siteUrl}`;
      const result = await ctx.runAction(internal.resend.sendEmail, {
        to: email,
        subject,
        html,
        text,
      });
      // Only flip scheduled → sent on successful send; failures stay
      // scheduled so the next hourly tick retries them.
      if (result.ok) {
        const id = await ctx.runMutation(internal.reminders.markSent, {
          reminderId: reminder._id,
        });
        if (id) sent += 1;
      }
    }
    return sent;
  },
});
