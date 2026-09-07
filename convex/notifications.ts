import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const notificationKind = v.union(
  v.literal("passport_view"),
  v.literal("reminder_sent"),
  v.literal("claim_filed"),
  v.literal("inbound_mail"),
  v.literal("transfer_redeemed"),
);

// Note: schema also allows team_invite but it stays unwired (no emission path).

/**
 * Internal emit only. Never called from the client.
 * Callers pass ownerId from the verified session; body is capped at 280 chars.
 */
export const emit = internalMutation({
  args: {
    ownerId: v.id("owners"),
    kind: notificationKind,
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const body = args.body.slice(0, 280);
    return await ctx.db.insert("notifications", {
      ownerId: args.ownerId,
      kind: args.kind,
      title: args.title,
      body,
      ...(args.link ? { link: args.link } : {}),
      createdAt: Date.now(),
    });
  },
});

/** Latest notifications, newest first. Light check: owner row must exist. */
export const list = query({
  args: {
    ownerId: v.id("owners"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) throw new Error("Owner not found");
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 50);
    return await ctx.db
      .query("notifications")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .take(limit);
  },
});

/** Count of unread rows (readAt undefined). */
export const unreadCount = query({
  args: {
    ownerId: v.id("owners"),
  },
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) throw new Error("Owner not found");
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    return rows.filter((r) => r.readAt === undefined).length;
  },
});

/** Mark one row read. Verifies row.ownerId matches the caller. */
export const markRead = mutation({
  args: {
    ownerId: v.id("owners"),
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.ownerId !== args.ownerId) {
      throw new Error("Notification not found");
    }
    if (row.readAt === undefined) {
      await ctx.db.patch(args.notificationId, { readAt: Date.now() });
    }
    return args.notificationId;
  },
});

/** Mark every row for this owner read. Returns the patched count. */
export const markAllRead = mutation({
  args: {
    ownerId: v.id("owners"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    const now = Date.now();
    let count = 0;
    for (const row of rows) {
      if (row.ownerId !== args.ownerId) continue;
      if (row.readAt === undefined) {
        await ctx.db.patch(row._id, { readAt: now });
        count += 1;
      }
    }
    return count;
  },
});
