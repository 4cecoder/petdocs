/**
 * Passwordless magic-link sign-in for petdocs (server-only — never import
 * from src/).
 *
 * Flow:
 *   1. requestMagicLink({ email }) — public action. Normalizes the email,
 *      enforces a 60s resend cooldown per email, mints a 32-byte hex token,
 *      stores ONLY its SHA-256 hash (15-min expiry, single-use), then emails
 *      `${SITE_URL}/sign-in?token=...&email=...` via the shared Resend sender
 *      (convex/resend.ts). Always returns { ok: true } — even when the email
 *      is invalid or unsent — to avoid account enumeration.
 *   2. verifyMagicLink({ email, token }) — public mutation. Hashes + looks up
 *      the token scoped to the email, rejects unknown/expired/already-used
 *      links (honest state — no instant-access fallback), consumes the token
 *      (single-use), then find-or-creates the owners row (externalId =
 *      email) and returns its ownerId. Server-side superadmin allowlist
 *      (convex/admin.ts) persists the superadmin tier on first sign-in.
 *
 * There is deliberately NO direct sign-in mutation (#17): signing in
 * REQUIRES a valid, unused, unexpired token tied to the email — mailbox
 * ownership must be proven, never assumed.
 *
 * Table note: tokens live in a `magicTokens` table that does NOT exist in
 * convex/schema.ts yet — see convex/README.md for the exact block to add on
 * the first codegen run (`bunx convex dev`). Only the `by_email` index is
 * required: request scopes cooldown lookups by email, and verify scopes the
 * hash compare by email (no by_tokenHash index needed).
 */
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { isSuperadminAllowlisted } from "./admin";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 request per email per minute
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Fallback base URL for emailed links. Override per deployment with the
 * `SITE_URL` Convex env var (`bunx convex env set SITE_URL …`) — Netlify /
 * local env files do NOT reach the Convex runtime.
 */
const DEFAULT_SITE_URL = "https://petdocs.seridian.dev";

/**
 * Resolves the base URL for sign-in links against an allowlist:
 * localhost/127.0.0.1, *.seridian.dev, or exact SITE_URL match.
 */
export function resolveBaseUrl(requestedOrigin?: string): string {
  const configuredSiteUrl = (
    process.env.SITE_URL?.trim() || DEFAULT_SITE_URL
  ).replace(/\/+$/, "");

  if (!requestedOrigin) {
    return configuredSiteUrl;
  }

  try {
    const url = new URL(requestedOrigin.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return configuredSiteUrl;
    }

    const hostname = url.hostname.toLowerCase();
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";
    const isSeridian =
      hostname === "seridian.dev" || hostname.endsWith(".seridian.dev");

    let matchesSite = false;
    try {
      matchesSite =
        url.origin.toLowerCase() ===
        new URL(configuredSiteUrl).origin.toLowerCase();
    } catch {
      matchesSite = url.origin.toLowerCase() === configuredSiteUrl.toLowerCase();
    }

    if (isLocal || isSeridian || matchesSite) {
      return url.origin;
    }
  } catch {
    // Malformed URL, fall through
  }

  return configuredSiteUrl;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 32 random bytes as 64 lowercase hex chars — emailed, never stored. */
function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash of the emailed token — the ONLY form persisted in the DB. */
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Builds the branded magic-link email (#21). Every send carries:
 *   - a unique Message-ID (crypto.randomUUID) so Gmail treats each link
 *     email as its own conversation, and
 *   - a short request timestamp in the subject for the same reason.
 * In-Reply-To/References are never set — a sign-in email must never thread
 * as a reply. convex/resend.ts sanitizeHeaders additionally strips any
 * threading headers that could ever be passed through.
 */
export function buildMagicLinkEmail(
  loginUrl: string,
  now: Date = new Date(),
): {
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
} {
  // Short timestamp: "2026-09-15 14:03 UTC".
  const stamp = `${now.toISOString().slice(0, 10)} ${now.toISOString().slice(11, 16)} UTC`;
  const subject = `Sign in to PetDocs (${stamp})`;

  // Message-ID domain should be the sending domain when known.
  const fromDomain =
    process.env.RESEND_FROM?.trim().split("@")[1]?.toLowerCase() ||
    "petdocs.seridian.dev";
  const headers: Record<string, string> = {
    "Message-ID": `<${crypto.randomUUID()}@${fromDomain}>`,
  };

  const text = `Hi there,

Sign in to petdocs with this link (15 minutes, one use):

${loginUrl}

If you didn't ask, ignore this.`;

  // Warm PetDocs card: inline CSS only, no external assets.
  const safeUrl = loginUrl.replace(/&/g, "&amp;");
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#FFFBF5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFBF5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border:1px solid #F0E2D3;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <div style="font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#0D9488;">PetDocs</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0 32px;">
                <h1 style="margin:0;font-size:20px;line-height:1.4;color:#1C1917;">Sign in to petdocs</h1>
                <p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#57534E;">Use the button below. It expires in 15 minutes, one use.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;">
                <a href="${safeUrl}" style="display:inline-block;background-color:#0D9488;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:999px;">Sign in</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#78716C;word-break:break-all;">Or paste this link into your browser:<br/><span style="color:#57534E;">${safeUrl}</span></p>
                <p style="margin:16px 0 0 0;font-size:12px;line-height:1.6;color:#78716C;">If you didn't ask, ignore this.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html, headers };
}

export const latestTokenForEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("magicTokens")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .order("desc")
      .first();
  },
});

export const storeToken = internalMutation({
  args: {
    email: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("magicTokens", {
      email: args.email,
      tokenHash: args.tokenHash,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const requestMagicLink = action({
  args: {
    email: v.string(),
    origin: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    previewUrl: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; previewUrl?: string }> => {
    const email = normalizeEmail(args.email);
    // Anti-enumeration: invalid addresses get the same { ok: true } shape,
    // we just skip minting/sending for them.
    if (!EMAIL_RE.test(email)) {
      return { ok: true };
    }

    const latest = await ctx.runQuery(
      internal.magicLink.latestTokenForEmail,
      { email },
    );
    if (latest && Date.now() - latest.createdAt < RESEND_COOLDOWN_MS) {
      return { ok: true };
    }

    const token = randomToken();
    const tokenHash = await hashToken(token);
    await ctx.runMutation(internal.magicLink.storeToken, {
      email,
      tokenHash,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });

    const siteUrl = resolveBaseUrl(args.origin);
    const loginUrl = `${siteUrl}/sign-in?token=${token}&email=${encodeURIComponent(email)}`;
    const { subject, text, html, headers } = buildMagicLinkEmail(loginUrl);

    let emailSent = false;
    try {
      const emailResult: { ok: boolean; error?: string } = await ctx.runAction(
        internal.resend.sendEmail,
        {
          to: email,
          subject,
          html,
          text,
          // Unique Message-ID per send; never In-Reply-To/References (#21).
          headers,
        },
      );
      if (emailResult && !emailResult.ok) {
        console.warn("Failed to send magic link email:", emailResult.error);
      } else if (emailResult?.ok) {
        emailSent = true;
      }
    } catch (err) {
      console.warn(
        "Failed to send magic link email:",
        err instanceof Error ? err.message : String(err),
      );
    }

    const isDevOrLocal =
      siteUrl.includes("localhost") ||
      siteUrl.includes("127.0.0.1") ||
      process.env.NODE_ENV !== "production" ||
      !emailSent;

    return {
      ok: true,
      ...(isDevOrLocal ? { previewUrl: loginUrl } : {}),
    };
  },
});

export const verifyMagicLink = mutation({
  args: { email: v.string(), token: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), ownerId: v.id("owners") }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!EMAIL_RE.test(email) || !args.token) {
      return { ok: false as const, error: "This sign-in link is invalid." };
    }

    const tokenHash = await hashToken(args.token);
    // Scoped to the email so only the `by_email` index is required.
    const rows = await ctx.db
      .query("magicTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const row = rows.find((r) => r.tokenHash === tokenHash) ?? null;

    if (!row) {
      return { ok: false as const, error: "This sign-in link is invalid." };
    }
    if (row.usedAt !== undefined) {
      return {
        ok: false as const,
        error: "This sign-in link has already been used.",
      };
    }
    if (row.expiresAt < Date.now()) {
      return {
        ok: false as const,
        error: "This sign-in link has expired.",
      };
    }

    // Single-use: consume the token exactly once inside this transaction.
    await ctx.db.patch(row._id, { usedAt: Date.now() });

    const existing = await ctx.db
      .query("owners")
      .withIndex("by_externalId", (q) => q.eq("externalId", email))
      .first();

    let ownerId: Id<"owners">;
    if (existing) {
      ownerId = existing._id;
    } else {
      const prefix = email.split("@")[0]?.trim();
      const name = prefix ? prefix : email;
      ownerId = await ctx.db.insert("owners", {
        externalId: email,
        email,
        name,
        createdAt: Date.now(),
      });
    }

    // Server-side superadmin allowlist (#22): the allowlisted email gets
    // the superadmin tier on first sign-in. The allowlist is derived from
    // Convex env / a server constant only — never from a client argument.
    if (existing?.role !== "superadmin" && isSuperadminAllowlisted(email)) {
      await ctx.db.patch(ownerId, { role: "superadmin" });
    }

    return { ok: true as const, ownerId };
  },
});
