/**
 * Billing entitlements + tier gating for PetDocs (Polar.sh backed).
 *
 * Server-only (never import from src/). Entitlement state lives on the
 * owners row: billingTier / polarCustomerId / polarSubId / currentPeriodEnd
 * (see convex/schema.ts). Only verified Polar webhooks (convex/polarHttp.ts →
 * internal.polar.* mutations) may write those fields — never client args.
 *
 * Tiers (mirrors src/app/(marketing)/pricing):
 *   free   — 1 pet, 25 documents, 1 active share link
 *   plus   — 5 pets, unlimited documents, unlimited share links
 *   family — 10 pets, unlimited documents, unlimited share links (+ co-owners)
 *
 * A paid tier is "active" until its currentPeriodEnd passes (grace for
 * scheduled cancellations and past_due — access runs to the end of the paid
 * period). After that activeTierOf() collapses the tier back to free, so no
 * cron sweeper is needed.
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export type Tier = "free" | "plus" | "family";

export type OwnerId = Id<"owners">;

export const TIER_VALIDATOR = v.union(
  v.literal("free"),
  v.literal("plus"),
  v.literal("family"),
);

/** Higher rank = more entitlements. requireTier allows rank >= min. */
export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  plus: 1,
  family: 2,
};

/**
 * Free tier limits are product policy (docs/billing.md + pricing page).
 * null = unlimited. Pets count active pets only (archiving frees a slot);
 * share links count active (non-revoked, live) links.
 */
export const TIER_LIMITS: Record<
  Tier,
  { pets: number | null; documents: number | null; shareLinks: number | null }
> = {
  free: { pets: 1, documents: 25, shareLinks: 1 },
  plus: { pets: 5, documents: null, shareLinks: null },
  family: { pets: 10, documents: null, shareLinks: null },
};

type BillingFields = {
  billingTier?: Tier;
  currentPeriodEnd?: number;
};/**
 * The tier an owner can actually use right now. Paid tiers expire once
 * currentPeriodEnd is in the past; expired/absent state resolves to free.
 */
export function activeTierOf(billing: BillingFields, now: number): Tier {
  const tier = billing.billingTier ?? "free";
  if (tier === "free") return "free";
  if (
    billing.currentPeriodEnd !== undefined &&
    billing.currentPeriodEnd <= now
  ) {
    return "free";
  }
  return tier;
}

/**
 * Resolve the owner's current billing snapshot. Missing owner throws —
 * callers already require a valid ownerId.
 */
export async function getBilling(
  ctx: QueryCtx,
  ownerId: OwnerId,
  now = Date.now(),
): Promise<{
  tier: Tier;
  limits: { pets: number | null; documents: number | null; shareLinks: number | null };
  currentPeriodEnd?: number;
}> {
  const owner = await ctx.db.get(ownerId);
  const tier = activeTierOf(owner ?? {}, now);
  return {
    tier,
    limits: TIER_LIMITS[tier],
    ...(owner?.currentPeriodEnd !== undefined
      ? { currentPeriodEnd: owner.currentPeriodEnd }
      : {}),
  };
}

/**
 * Gate a premium surface by minimum tier. Throws with an upgrade-oriented
 * message when the owner's active tier ranks below `min`.
 */
export async function requireTier(
  ctx: QueryCtx,
  ownerId: OwnerId,
  min: Tier,
  now = Date.now(),
): Promise<Tier> {
  const owner = await ctx.db.get(ownerId);
  if (!owner) throw new Error("Owner not found");
  const tier = activeTierOf(owner, now);
  if (TIER_RANK[tier] < TIER_RANK[min]) {
    throw new Error(
      `Upgrade required: this feature needs the ${min} plan (current: ${tier}).`,
    );
  }
  return tier;
}

/**
 * Gate a resource creation against the owner's plan limit for `resource`.
 * Throws with an upgrade-oriented message when the owner is at their limit.
 * Returns the owner's active tier so callers can reuse it.
 */
export async function requireWithinLimit(
  ctx: QueryCtx,
  ownerId: OwnerId,
  resource: "pets" | "shareLinks",
  now = Date.now(),
): Promise<Tier> {
  const owner = await ctx.db.get(ownerId);
  if (!owner) throw new Error("Owner not found");
  const tier = activeTierOf(owner, now);
  const limit = TIER_LIMITS[tier][resource];
  if (limit === null) return tier;

  let current = 0;
  if (resource === "pets") {
    // Active pets only — archived pets free up a slot (docs/billing.md).
    const rows = await ctx.db
      .query("pets")
      .withIndex("by_ownerId_and_status", (q) =>
        q.eq("ownerId", ownerId).eq("status", "active"),
      )
      .collect();
    current = rows.length;
  } else {
    const rows = await ctx.db
      .query("shareLinks")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .collect();
    current = rows.filter((l) => l.isActive).length;
  }
  if (current >= limit) {
    throw new Error(
      `Upgrade required: the ${tier} plan allows up to ${limit} active ${
        resource === "pets" ? "pets" : "share links"
      }.`,
    );
  }
  return tier;
}

/** Dashboard-facing snapshot: tier + effective limits, no secrets. */
export const billingStatus = query({
  args: { ownerId: v.id("owners") },
  returns: v.object({
    tier: TIER_VALIDATOR,
    limits: v.object({
      pets: v.union(v.number(), v.null()),
      documents: v.union(v.number(), v.null()),
      shareLinks: v.union(v.number(), v.null()),
    }),
    currentPeriodEnd: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    return await getBilling(ctx, args.ownerId);
  },
});
