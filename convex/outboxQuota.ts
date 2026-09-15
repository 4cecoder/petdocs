/**
 * Daily outbound email quota for petdocs (server-only — never import from src/).
 *
 * One `outboxQuota` row per UTC day (`day: "2026-09-15"`). `convex/resend.ts`
 * checks remaining before sending, increments after a successful send, and
 * marks the day exhausted when Resend answers 429. Reads/writes for a given
 * day happen inside single-transaction mutations, so concurrent sends
 * serialize via OCC — no lost updates.
 *
 * The limit comes from the `RESEND_DAILY_LIMIT` Convex env var (default 100,
 * Resend free tier). Rows roll over naturally at UTC midnight (a new day is a
 * new row starting at sent=0); a daily cron prunes rows older than 60 days.
 *
 * Status is exposed for UI via:
 *   - `outboxQuota:status` ({ day }) — public, sign-in page + meters
 *   - `resend:status` / `integrations:status` — optional `quota` field when
 *     the caller passes the current UTC day.
 *
 * Queries never read the wall clock: callers pass the day key (see
 * `todayUtc`, usable from mutations/actions, and `utcDayKey` in src/lib for
 * the client side).
 */
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

export const DEFAULT_DAILY_LIMIT = 100;

/** UTC day key ("YYYY-MM-DD") for a timestamp — pure, safe anywhere. */
export function todayUtc(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Parse RESEND_DAILY_LIMIT. Non-numeric, zero, or negative values fall back
 * to the default (100) instead of disabling sending entirely.
 */
export function dailyLimitFromEnv(raw: string | undefined | null): number {
  const parsed = Number.parseInt((raw ?? "").trim(), 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_DAILY_LIMIT;
}

/** Shared validator so resend:integrations status can embed the same shape. */
export const quotaStatusShape = v.object({
  day: v.string(),
  sent: v.number(),
  limit: v.number(),
  remaining: v.number(),
  exhausted: v.boolean(),
});

export type QuotaStatus = {
  day: string;
  sent: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
};

/** Read today's counter row (or null when the day has no sends yet). */
async function rowForDay(ctx: QueryCtx, day: string) {
  return await ctx.db
    .query("outboxQuota")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();
}

/** Compute the quota status for a day. Shared by every status surface. */
export async function quotaFor(
  ctx: QueryCtx,
  day: string,
): Promise<QuotaStatus> {
  const limit = dailyLimitFromEnv(process.env.RESEND_DAILY_LIMIT);
  const row = await rowForDay(ctx, day);
  const sent = row?.sent ?? 0;
  return {
    day,
    sent,
    limit,
    remaining: Math.max(0, limit - sent),
    exhausted: row?.exhaustedAt !== undefined || sent >= limit,
  };
}

/** Pre-send gate used by resend.sendEmail (internal — not public API). */
export const check = internalQuery({
  args: { day: v.string() },
  returns: v.object({ remaining: v.number(), exhausted: v.boolean() }),
  handler: async (ctx, args) => {
    const status = await quotaFor(ctx, args.day);
    return { remaining: status.remaining, exhausted: status.exhausted };
  },
});

/**
 * Public status for UI surfaces. The caller supplies the UTC day key
 * (`utcDayKey()` on the client) so this query stays wall-clock free.
 */
export const status = query({
  args: { day: v.string() },
  returns: quotaStatusShape,
  handler: async (ctx, args) => {
    return await quotaFor(ctx, args.day);
  },
});

/**
 * Atomic increment for one successful send. Single-transaction
 * read-modify-write with an upsert: the first send of a day inserts the row,
 * later sends patch `sent` in place. OCC serializes concurrent increments.
 */
export const increment = internalMutation({
  args: { day: v.string() },
  returns: v.object({ sent: v.number(), limit: v.number() }),
  handler: async (ctx, args) => {
    const limit = dailyLimitFromEnv(process.env.RESEND_DAILY_LIMIT);
    const row = await rowForDay(ctx, args.day);
    const sent = (row?.sent ?? 0) + 1;
    if (row) {
      await ctx.db.patch(row._id, { sent, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("outboxQuota", {
        day: args.day,
        sent,
        updatedAt: Date.now(),
      });
    }
    return { sent, limit };
  },
});

/**
 * Mark a day exhausted out-of-band — Resend answered 429 even though our
 * local counter had not hit `limit` yet (limits can drift from the real
 * plan). Sending stays blocked until the next day key rolls over.
 */
export const markExhausted = internalMutation({
  args: { day: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await rowForDay(ctx, args.day);
    if (row) {
      if (row.exhaustedAt === undefined) {
        await ctx.db.patch(row._id, { exhaustedAt: Date.now() });
      }
    } else {
      await ctx.db.insert("outboxQuota", {
        day: args.day,
        sent: 0,
        exhaustedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/**
 * Prune counter rows older than 60 days (called by the daily cron). Pure
 * housekeeping — old rows are harmless, just clutter.
 */
export const cleanupOld = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoffDay = todayUtc(Date.now() - 60 * 24 * 60 * 60 * 1000);
    let deleted = 0;
    const old = await ctx.db
      .query("outboxQuota")
      .withIndex("by_day", (q) => q.lt("day", cutoffDay))
      .collect();
    for (const row of old) {
      await ctx.db.delete("outboxQuota", row._id);
      deleted += 1;
    }
    return deleted;
  },
});
