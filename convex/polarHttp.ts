/**
 * Polar.sh webhook receiver (server-only).
 *
 * Lives in its own file because convex/http.ts is owned by the android
 * agent — http.ts registers THIS file's httpAction with a clearly-marked
 * 3-line block; all Polar logic stays here.
 *
 * Polar adheres to the Standard Webhooks spec: HMAC-SHA256 over
 * `${webhook-id}.${webhook-timestamp}.${rawBody}`, base64-encoded, secret
 * passed as `whsec_…` (prefix + base64). Signatures arrive in the
 * `webhook-signature` header as space-separated `v1,<digest>` entries.
 * Same scheme as the Svix verification in http.ts, reimplemented here so
 * the two webhook surfaces stay independently revertible.
 *
 * Endpoint: POST /polar/webhook (register in the Polar dashboard as
 * https://<deployment>.convex.site/polar/webhook — see docs/billing.md).
 *
 * Security posture:
 * - Fail CLOSED: if POLAR_WEBHOOK_SECRET is unset, every webhook is
 *   rejected (unlike the Resend receiver, money gates real entitlements).
 * - Constant-time digest comparison + 5-minute timestamp tolerance.
 * - POLAR_ORG_ID (optional) rejects payloads from other organizations.
 * - Handler errors are caught + logged and ack'd 200 so a permanent
 *   local failure (e.g. malformed metadata id) cannot put Polar into an
 *   infinite retry loop; genuine auth failures return 4xx.
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

export const POLAR_WEBHOOK_PATH = "/polar/webhook";

const SIGNATURE_TOLERANCE_SECONDS = 300;

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Standard Webhooks signature verification (Polar-compatible). Pure and
 * dependency-free; `nowSeconds` injectable for tests.
 */
export async function verifyStandardWebhookSignature(input: {
  id: string;
  timestamp: string;
  payload: string;
  signatureHeader: string;
  secret: string;
  nowSeconds?: number;
}): Promise<boolean> {
  try {
    const timestamp = Number.parseInt(input.timestamp, 10);
    if (!Number.isFinite(timestamp)) return false;
    const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
    // Standard Webhooks secrets are base64, conventionally prefixed whsec_.
    const secretPart = input.secret.startsWith("whsec_")
      ? input.secret.slice("whsec_".length)
      : input.secret;
    const keyBytes = base64ToBytes(secretPart);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes as unknown as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signedContent = `${input.id}.${input.timestamp}.${input.payload}`;
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedContent),
    );
    const expected = bytesToBase64(new Uint8Array(signature));
    return input.signatureHeader.split(" ").some((entry) => {
      const parts = entry.split(",");
      if (parts.length !== 2) return false;
      const [version, digest] = parts;
      if (version !== "v1" || !digest) return false;
      return timingSafeEqual(digest, expected);
    });
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asObjectString(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string" || typeof entry === "number") {
      out[key] = String(entry);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** ISO 8601 → epoch ms (Polar sends current_period_end as an ISO string). */
function isoToEpochMs(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** `sub_xxx`-style Polar ids look like Convex ids but are not — validate any
 * metadata ownerId before it can reach v.id("owners") (throws otherwise). */
function isConvexIdShape(value: string): boolean {
  return /^[0-9a-z]{10,40}$/.test(value);
}

/**
 * The Polar webhook httpAction. Registered in convex/http.ts with a
 * marked 3-line block. See the file header for the security posture.
 */
export const polarWebhook = httpAction(async (ctx, req) => {
  const secret = process.env.POLAR_WEBHOOK_SECRET?.trim() || "";
  if (!secret) {
    console.error("[polar] POLAR_WEBHOOK_SECRET not set; rejecting webhook");
    return jsonResponse({ error: "Webhook not configured" }, 503);
  }

  const payload = await req.text();
  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const signatureHeader = req.headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) {
    return new Response("Missing webhook signature headers", { status: 401 });
  }
  const valid = await verifyStandardWebhookSignature({
    id,
    timestamp,
    payload,
    signatureHeader,
    secret,
  });
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const root = asRecord(body);
  if (!root) return new Response("Invalid JSON", { status: 400 });

  const type = asString(root.type);
  const data = asRecord(root.data);
  if (!type || !data) {
    return jsonResponse({ received: true, ignored: true }, 200);
  }

  // Optional defense-in-depth: drop events for other Polar organizations.
  const orgId = process.env.POLAR_ORG_ID?.trim() || "";
  const eventOrg = asString(data.organization_id);
  if (orgId && eventOrg && eventOrg !== orgId) {
    console.warn(`[polar] dropped ${type} for foreign organization`);
    return jsonResponse({ received: true, ignored: true }, 200);
  }

  const customer = asRecord(data.customer);
  const customerId = asString(data.customer_id) ?? asString(customer?.id);
  const customerEmail = asString(customer?.email);
  const metadata = asObjectString(data.metadata);
  const rawMetaOwner = metadata?.ownerId;
  // Shape-checked here; the receiving mutation's v.id("owners") validator is
  // the real gate — a forged id throws there and is caught + ack'd below.
  const metadataOwnerId =
    rawMetaOwner && isConvexIdShape(rawMetaOwner)
      ? (rawMetaOwner as Id<"owners">)
      : undefined;

  try {
    if (type.startsWith("subscription.")) {
      await ctx.runMutation(internal.polar.syncSubscription, {
        polarSubId: asString(data.id) ?? "unknown",
        status: asString(data.status) ?? "unknown",
        ...(customerId ? { customerId } : {}),
        ...(customerEmail ? { customerEmail } : {}),
        ...(asString(data.product_id) ? { productId: asString(data.product_id) } : {}),
        ...(metadata?.tier ? { tierHint: metadata.tier } : {}),
        ...(isoToEpochMs(data.current_period_end) !== undefined
          ? { currentPeriodEnd: isoToEpochMs(data.current_period_end)! }
          : {}),
        ...(metadataOwnerId ? { metadataOwnerId } : {}),
      });
    } else if (type === "checkout.confirmed") {
      await ctx.runMutation(internal.polar.linkCheckoutCustomer, {
        ...(customerId ? { customerId } : {}),
        ...(customerEmail ? { customerEmail } : {}),
        ...(metadataOwnerId ? { metadataOwnerId } : {}),
      });
    } else if (type === "customer.deleted") {
      if (customerId) {
        await ctx.runMutation(internal.polar.detachCustomer, { customerId });
      }
    }
    // Everything else (order.*, refund.*, benefit.*, …) is ack'd and ignored.
  } catch (error) {
    // Ack so Polar does not retry a permanently-failing local handler;
    // details land in Convex function logs for ops.
    console.error(`[polar] handler error for ${type}:`, error);
    return jsonResponse({ received: true, error: "handler" }, 200);
  }

  return jsonResponse({ received: true }, 200);
});

/**
 * Standalone router for this surface. Convex 1.44 HttpRouter has no
 * `.use()`, so convex/http.ts registers `polarWebhook` directly; this
 * default export exists so the module is a valid router file if ownership
 * of http.ts changes.
 */
const http = httpRouter();
http.route({
  path: POLAR_WEBHOOK_PATH,
  method: "POST",
  handler: polarWebhook,
});
export default http;
