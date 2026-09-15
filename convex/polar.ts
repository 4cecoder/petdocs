/**
 * Polar.sh billing sync + checkout creation (server-only, never import
 * from src/).
 *
 * There is no official @polar-sh/convex component, so this module speaks to
 * the Polar REST API with raw `fetch` (available in the default Convex
 * runtime — no "use node" needed) and receives webhooks through
 * convex/polarHttp.ts (Standard Webhooks signature verification).
 *
 * Entitlement model: subscription webhooks upsert the owners billing block
 * (billingTier / polarCustomerId / polarSubId / currentPeriodEnd). Access
 * semantics live in convex/billing.ts (activeTierOf): a paid tier stays
 * active until currentPeriodEnd passes, so scheduled cancellations and
 * past_due keep access to the end of the paid period; revoked subscriptions
 * downgrade immediately.
 *
 * Tier mapping precedence (docs/billing.md):
 *   1. subscription metadata.tier ("plus" | "family") — set on the Polar
 *      product or passed at checkout creation
 *   2. product id match against POLAR_PRODUCT_ID_PLUS / POLAR_PRODUCT_ID_FAMILY
 *   3. fallback: "plus" (single-product setups work with zero config)
 *
 * Env (set with `bunx convex env set KEY value`, see docs/billing.md):
 *   POLAR_ACCESS_TOKEN      server token from polar.sh dashboard
 *   POLAR_WEBHOOK_SECRET    whsec_… secret of the Convex webhook endpoint
 *   POLAR_ORG_ID            optional: reject webhooks for other orgs
 *   POLAR_PRODUCT_ID_PLUS   optional: Polar product id for the Plus plan
 *   POLAR_PRODUCT_ID_FAMILY optional: Polar product id for the Family plan
 *   POLAR_API_BASE          optional: override for sandbox
 *                           (https://sandbox-api.polar.sh)
 */
import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_API_BASE = "https://api.polar.sh";

export function polarApiBase(): string {
  return (process.env.POLAR_API_BASE?.trim() || DEFAULT_API_BASE).replace(
    /\/+$/,
    "",
  );
}

/** Site URL used as the checkout success redirect (allowlisted like magic links). */
function siteUrl(): string {
  return (
    process.env.SITE_URL?.trim().replace(/\/+$/, "") ||
    "https://petdocs.seridian.dev"
  );
}

/** Resolve the Polar product id for a purchasable tier from env. */
export function productIdForTier(tier: "plus" | "family"): string {
  const id = (
    tier === "plus"
      ? process.env.POLAR_PRODUCT_ID_PLUS
      : process.env.POLAR_PRODUCT_ID_FAMILY
  )?.trim();
  if (!id) {
    throw new Error(
      `Billing is not configured: set POLAR_PRODUCT_ID_${tier.toUpperCase()} in Convex env (bunx convex env set, see docs/billing.md).`,
    );
  }
  return id;
}

/**
 * Tier from subscription metadata / product id. Falls back to "plus" so a
 * single-product Polar setup grants entitlements without extra env config.
 */
export function tierFromMetadata(
  tierHint: string | undefined,
  productId: string | undefined,
): "plus" | "family" {
  const hint = tierHint?.trim().toLowerCase();
  if (hint === "plus" || hint === "family") return hint;
  const plusId = process.env.POLAR_PRODUCT_ID_PLUS?.trim();
  const familyId = process.env.POLAR_PRODUCT_ID_FAMILY?.trim();
  if (productId && familyId && productId === familyId) return "family";
  if (productId && plusId && productId === plusId) return "plus";
  return "plus";
}

// ---------------------------------------------------------------------------
// Checkout creation
// ---------------------------------------------------------------------------

export type CheckoutRequest = {
  url: string;
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  };
};

/**
 * Pure request builder for POST /v1/checkouts/ — exported for tests so no
 * live Polar call is needed to verify checkout request construction.
 */
export function buildCreateCheckoutRequest(input: {
  accessToken: string;
  productId: string;
  successUrl: string;
  ownerId: string;
  customerEmail?: string;
  apiBase?: string;
}): CheckoutRequest {
  const base = (input.apiBase || polarApiBase()).replace(/\/+$/, "");
  const body: Record<string, unknown> = {
    products: [input.productId],
    success_url: input.successUrl,
    // Copied onto the resulting order/subscription by Polar; the webhook
    // handler uses it to attribute the entitlement to this owner.
    metadata: { ownerId: input.ownerId },
  };
  if (input.customerEmail) body.customer_email = input.customerEmail;
  return {
    url: `${base}/v1/checkouts/`,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  };
}

/** Narrow the checkout response down to its hosted checkout URL. */
export function parseCheckoutResponse(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const url = (payload as Record<string, unknown>).url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

/**
 * Owner lookup for checkout creation. Verifies the caller-supplied email
 * matches the owners row so a stray ownerId arg cannot start a checkout for
 * someone else's account.
 */
export const ownerForCheckout = internalQuery({
  args: { ownerId: v.id("owners"), email: v.string() },
  returns: v.union(
    v.object({ _id: v.id("owners"), email: v.string() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.ownerId);
    if (!owner) return null;
    if (owner.email.trim().toLowerCase() !== args.email.trim().toLowerCase()) {
      return null;
    }
    return { _id: owner._id, email: owner.email };
  },
});

/**
 * Create a Polar hosted checkout session and return its URL. No live Polar
 * call happens until Polar env keys are configured (fails with a clear
 * setup error instead).
 */
export const createCheckout = action({
  args: {
    ownerId: v.id("owners"),
    email: v.string(),
    tier: v.union(v.literal("plus"), v.literal("family")),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim() || "";
    if (!accessToken) {
      throw new Error(
        "Billing is not configured yet. Set POLAR_ACCESS_TOKEN in Convex env (see docs/billing.md).",
      );
    }
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new Error("Enter a valid email address");
    }
    const owner = await ctx.runQuery(internal.polar.ownerForCheckout, {
      ownerId: args.ownerId,
      email,
    });
    if (!owner) throw new Error("Owner not found");
    const productId = productIdForTier(args.tier);
    const request = buildCreateCheckoutRequest({
      accessToken,
      productId,
      successUrl: `${siteUrl()}/dashboard?billing=checkout_success`,
      ownerId: owner._id,
      customerEmail: owner.email,
    });
    const res = await fetch(request.url, request.init);
    if (!res.ok) {
      throw new Error(`Polar checkout failed (HTTP ${res.status})`);
    }
    const url = parseCheckoutResponse(await res.json());
    if (!url) throw new Error("Polar checkout response did not include a URL");
    return { url };
  },
});

// ---------------------------------------------------------------------------
// Webhook-triggered entitlement sync (called from convex/polarHttp.ts)
// ---------------------------------------------------------------------------

/** Subscription statuses that grant (or keep) a paid tier. */
const GRANTING_STATUSES = new Set(["active", "trialing"]);
/** Statuses that end access immediately (Polar: revoked = terminated now). */
const REVOKED_STATUSES = new Set(["revoked", "incomplete_expired"]);

/**
 * Upsert entitlement state from a subscription.* webhook. Idempotent: the
 * same event can arrive twice without changing the outcome.
 */
export const syncSubscription = internalMutation({
  args: {
    polarSubId: v.string(),
    status: v.string(),
    customerId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    productId: v.optional(v.string()),
    tierHint: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    metadataOwnerId: v.optional(v.id("owners")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await resolveOwnerForSync(ctx, args);
    if (!owner) {
      // Unknown customer: nothing to attribute. Ack'd so Polar does not
      // retry forever; operators can match the customer later via email.
      console.warn(
        `[polar] subscription ${args.polarSubId} (${args.status}) matched no owner`,
      );
      return null;
    }

    if (REVOKED_STATUSES.has(args.status)) {
      await ctx.db.patch(owner._id, { billingTier: "free" });
      return null;
    }

    // active / trialing / canceled (scheduled) / past_due / incomplete:
    // write the paid tier + period; activeTierOf() expires access once
    // currentPeriodEnd passes, so canceled keeps access to period end.
    if (GRANTING_STATUSES.has(args.status) || args.currentPeriodEnd) {
      const tier = tierFromMetadata(args.tierHint, args.productId);
      await ctx.db.patch(owner._id, {
        billingTier: tier,
        ...(args.customerId ? { polarCustomerId: args.customerId } : {}),
        polarSubId: args.polarSubId,
        ...(args.currentPeriodEnd !== undefined
          ? { currentPeriodEnd: args.currentPeriodEnd }
          : {}),
      });
      return null;
    }

    // Unknown status: leave entitlements untouched.
    console.warn(`[polar] unhandled subscription status ${args.status}`);
    return null;
  },
});

async function resolveOwnerForSync(
  ctx: MutationCtx,
  args: {
    customerId?: string;
    customerEmail?: string;
    metadataOwnerId?: Id<"owners">;
  },
) {
  if (args.customerId) {
    const byCustomer = await ctx.db
      .query("owners")
      .withIndex("by_polarCustomerId", (q) =>
        q.eq("polarCustomerId", args.customerId!),
      )
      .first();
    if (byCustomer) return byCustomer;
  }
  if (args.customerEmail) {
    const email = args.customerEmail.trim().toLowerCase();
    if (EMAIL_RE.test(email)) {
      const byEmail = await ctx.db
        .query("owners")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (byEmail) return byEmail;
    }
  }
  if (args.metadataOwnerId) {
    const byMeta = await ctx.db.get(args.metadataOwnerId);
    if (byMeta) return byMeta;
  }
  return null;
}

/**
 * checkout.confirmed: latch the Polar customer id onto the owner as soon as
 * we know it (before the first subscription event lands).
 */
export const linkCheckoutCustomer = internalMutation({
  args: {
    customerId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    metadataOwnerId: v.optional(v.id("owners")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.customerId) return null;
    if (args.metadataOwnerId) {
      const owner = await ctx.db.get(args.metadataOwnerId);
      if (owner && !owner.polarCustomerId) {
        await ctx.db.patch(owner._id, { polarCustomerId: args.customerId });
      }
      return null;
    }
    if (args.customerEmail) {
      const email = args.customerEmail.trim().toLowerCase();
      if (EMAIL_RE.test(email)) {
        const owner = await ctx.db
          .query("owners")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first();
        if (owner && !owner.polarCustomerId) {
          await ctx.db.patch(owner._id, { polarCustomerId: args.customerId });
        }
      }
    }
    return null;
  },
});

/** customer.deleted: end entitlements for that Polar customer immediately. */
export const detachCustomer = internalMutation({
  args: { customerId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await ctx.db
      .query("owners")
      .withIndex("by_polarCustomerId", (q) =>
        q.eq("polarCustomerId", args.customerId),
      )
      .first();
    if (owner) {
      await ctx.db.patch(owner._id, { billingTier: "free" });
    }
    return null;
  },
});
