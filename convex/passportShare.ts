/**
 * Passport email sharing from the dashboard share tool (#39).
 *
 * Flow: owner enters recipient email + optional note → this action
 *   1. validates input + enforces a 60s per (pet, recipient) cooldown,
 *   2. REUSES the owner's most recent live passport-scope link for the pet,
 *      or mints a fresh one via shareLinks.createToken,
 *   3. renders the branded share email (summary card + big link + QR image
 *      pointing at the hosted route /api/passport/[token]/qr.svg — see
 *      convex/passportHttp.ts), and
 *   4. sends it via the shared Resend sender (internal.resend.sendEmail),
 *   5. records every attempt in `shareEmails` (schema.ts) — the owner-facing
 *      send history. mailAccounts/mailThreads/mailMessages are the STAFF
 *      inbox, deliberately not reused as an outbox.
 *
 * NOTE (#35): Resend quota/rate limiting from issue #35 is NOT merged yet on
 * this branch — sends go out blind. If RESEND_* is unconfigured or the daily
 * quota is exhausted, the attempt is recorded as `failed` with Resend's
 * short error and the UI surfaces it honestly. Real-send verification was
 * pending at implementation time (daily quota exhausted until UTC midnight).
 */
import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { resolveBaseUrl } from "./magicLink";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 email per (pet, recipient) per minute
const MAX_NOTE_CHARS = 500;
const NEW_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // emailed links live 30 days
const HISTORY_LIMIT = 50;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Absolute URL of the Convex HTTP surface (`*.convex.site`) so email
 * clients can load the hosted QR image. Falls back to deriving the site
 * host from CONVEX_CLOUD_URL; returns null when neither is available.
 */
export function convexSiteUrl(): string | null {
  const direct = process.env.CONVEX_SITE_URL?.trim();
  if (direct) return direct.replace(/\/+$/, "");
  const cloud = process.env.CONVEX_CLOUD_URL?.trim() || "";
  if (cloud.includes(".convex.cloud")) {
    return cloud.replace(".convex.cloud", ".convex.site").replace(/\/+$/, "");
  }
  return null;
}

/** Mirrors shareLinks.tokenIsLive (kept local to avoid coupling). */
function linkIsLive(link: {
  isActive: boolean;
  expiresAt?: number;
  maxViews?: number;
  viewCount: number;
}): boolean {
  if (!link.isActive) return false;
  if (link.expiresAt !== undefined && Date.now() >= link.expiresAt) return false;
  if (link.maxViews !== undefined && link.viewCount >= link.maxViews) return false;
  return true;
}

/**
 * Branded passport-share email (#39). Pure function, exported for tests:
 * the HTML must always contain the passport link and the hosted QR image,
 * and user-controlled fields (pet name, breed, note) must be escaped.
 */
export function buildPassportShareEmail(input: {
  petName: string;
  species?: string;
  breed?: string;
  note?: string;
  shareUrl: string;
  qrUrl?: string;
  now?: Date;
}): {
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
} {
  const now = input.now ?? new Date();
  const petName = escapeHtml(input.petName);
  const subtitleBits = [input.species, input.breed].filter(
    (b): b is string => typeof b === "string" && b.trim().length > 0,
  );
  const shareUrl = escapeHtml(input.shareUrl);
  const note = input.note?.trim();

  // Unique Message-ID so every share email is its own conversation (#21
  // convention); threading headers are never set.
  const fromDomain =
    process.env.RESEND_FROM?.trim().split("@")[1]?.toLowerCase() ||
    "petdocs.seridian.dev";
  const headers: Record<string, string> = {
    "Message-ID": `<${crypto.randomUUID()}@${fromDomain}>`,
  };

  const subject = `${input.petName}'s passport — shared via petdocs`;

  const text = `Hi there,

${input.petName}'s owner shared their petdocs passport with you${
    note ? `:\n\n"${note}"` : "."
  }

View it here (read-only link):

${input.shareUrl}
${
  input.qrUrl
    ? `\nScanning on paper? A QR code is embedded in the HTML version of this email.`
    : ""
}
If you weren't expecting this, you can safely ignore it.`;

  const noteBlock = note
    ? `<tr><td style="padding:0 32px 8px 32px;"><blockquote style="margin:0;padding:12px 16px;border-left:3px solid #0D9488;background-color:#FFFBF5;border-radius:8px;font-size:14px;line-height:1.6;color:#1C1917;">${escapeHtml(note)}</blockquote></td></tr>`
    : "";

  const qrBlock = input.qrUrl
    ? `<tr><td style="padding:8px 32px 24px 32px;" align="center"><img src="${escapeHtml(input.qrUrl)}" width="160" height="160" alt="QR code linking to ${petName}'s passport" style="display:block;border:1px solid #F0E2D3;border-radius:12px;"/><p style="margin:10px 0 0 0;font-size:12px;color:#78716C;">Scan to open the passport</p></td></tr>`
    : "";

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
                <h1 style="margin:0;font-size:20px;line-height:1.4;color:#1C1917;">A passport for ${petName}</h1>
                <p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#57534E;">${petName}'s owner shared a read-only pet passport with you${subtitleBits.length > 0 ? ` (${escapeHtml(subtitleBits.join(" · "))})` : ""}.</p>
              </td>
            </tr>
            ${noteBlock}
            <tr>
              <td style="padding:16px 32px 4px 32px;">
                <a href="${shareUrl}" style="display:inline-block;background-color:#0D9488;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:13px 28px;border-radius:999px;">View ${petName}&#39;s passport</a>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 8px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#78716C;word-break:break-all;">Or paste this link into your browser:<br/><span style="color:#57534E;">${shareUrl}</span></p>
              </td>
            </tr>
            ${qrBlock}
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#78716C;">Read-only link. It may expire or be revoked by the owner. If you weren&#39;t expecting this email, you can safely ignore it.</p>
                <p style="margin:16px 0 0 0;font-size:12px;line-height:1.6;color:#78716C;">Sent ${now.toISOString().slice(0, 10)} via <span style="color:#0D9488;font-weight:600;">petdocs</span></p>
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

// ---------------------------------------------------------------------------
// Internal helpers (queries/mutations used by the action and the QR route)
// ---------------------------------------------------------------------------

/** Ownership check + pet fields for the email card. */
export const petForOwner = internalQuery({
  args: { ownerId: v.id("owners"), petId: v.id("pets") },
  handler: async (ctx, args) => {
    const pet = await ctx.db.get(args.petId);
    if (!pet || pet.ownerId !== args.ownerId) return null;
    return { name: pet.name, species: pet.species, breed: pet.breed };
  },
});

/**
 * Most recent LIVE passport-scope link for the pet (token reuse): emailing
 * twice reuses the same capability instead of minting a new token per send.
 */
export const latestLivePassportLink = internalQuery({
  args: { petId: v.id("pets") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("shareLinks")
      .withIndex("by_petId", (q) => q.eq("petId", args.petId))
      .order("desc")
      .take(50);
    return (
      rows.find(
        (r) => r.scope === "passport" && linkIsLive(r),
      ) ?? null
    );
  },
});

/** Latest send attempt for (pet, recipient) — cooldown compared in the action. */
export const latestSendForRecipient = internalQuery({
  args: { petId: v.id("pets"), recipientEmail: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shareEmails")
      .withIndex("by_petId_and_recipient", (q) =>
        q.eq("petId", args.petId).eq("recipientEmail", args.recipientEmail),
      )
      .order("desc")
      .first();
  },
});

/**
 * Liveness check for the hosted QR route — NO auth (it backs a public
 * image URL), returns only a boolean. Unknown/revoked/expired tokens get
 * a 404 at the route so dead QR images never render.
 */
export const isTokenLive = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("shareLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    return link !== null && linkIsLive(link);
  },
});

/** Record one send attempt. Defense-in-depth: link must match owner+pet. */
export const recordSend = internalMutation({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    linkId: v.id("shareLinks"),
    recipientEmail: v.string(),
    note: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link || link.ownerId !== args.ownerId || link.petId !== args.petId) {
      throw new Error("Link not found");
    }
    return await ctx.db.insert("shareEmails", {
      ownerId: args.ownerId,
      petId: args.petId,
      linkId: args.linkId,
      recipientEmail: args.recipientEmail,
      ...(args.note ? { note: args.note } : {}),
      status: args.status,
      ...(args.error ? { error: args.error } : {}),
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/** Owner-facing email history for the share tool: sent-to, when, status. */
export const listEmails = query({
  args: { ownerId: v.id("owners") },
  returns: v.array(
    v.object({
      _id: v.id("shareEmails"),
      petId: v.id("pets"),
      petName: v.string(),
      recipientEmail: v.string(),
      note: v.optional(v.string()),
      status: v.union(v.literal("sent"), v.literal("failed")),
      error: v.optional(v.string()),
      linkActive: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("shareEmails")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .take(HISTORY_LIMIT);
    return await Promise.all(
      rows.map(async (row) => {
        const [pet, link] = await Promise.all([
          ctx.db.get(row.petId),
          ctx.db.get(row.linkId),
        ]);
        return {
          _id: row._id,
          petId: row.petId,
          petName: pet?.name ?? "Pet",
          recipientEmail: row.recipientEmail,
          ...(row.note !== undefined ? { note: row.note } : {}),
          status: row.status,
          ...(row.error !== undefined ? { error: row.error } : {}),
          linkActive: link?.isActive ?? false,
          createdAt: row.createdAt,
        };
      }),
    );
  },
});

const emailResult = v.union(
  v.object({ ok: v.literal(false), error: v.string() }),
  v.object({
    ok: v.literal(true),
    reused: v.boolean(),
    token: v.string(),
    linkId: v.id("shareLinks"),
    delivered: v.boolean(),
    deliveryError: v.optional(v.string()),
  }),
);

/**
 * Email a pet passport. Public action (identity-from-arg, same as the rest
 * of the share surface) — ownership is enforced against the pets/shareLinks
 * rows, so only the owner can email their own pet's passport.
 */
export const emailPassport = action({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    recipientEmail: v.string(),
    note: v.optional(v.string()),
    origin: v.optional(v.string()),
  },
  returns: emailResult,
  handler: async (ctx, args) => {
    const recipientEmail = normalizeEmail(args.recipientEmail);
    if (!EMAIL_RE.test(recipientEmail)) {
      return { ok: false as const, error: "Enter a valid email address." };
    }
    const note = args.note?.trim() ?? "";
    if (note.length > MAX_NOTE_CHARS) {
      return { ok: false as const, error: `Note must be at most ${MAX_NOTE_CHARS} characters.` };
    }

    const pet = await ctx.runQuery(internal.passportShare.petForOwner, {
      ownerId: args.ownerId,
      petId: args.petId,
    });
    if (!pet) {
      return { ok: false as const, error: "Pet not found." };
    }

    // Cooldown: one send per (pet, recipient) per minute — protects the
    // Resend quota and stops accidental double-click sends.
    const latest = await ctx.runQuery(
      internal.passportShare.latestSendForRecipient,
      { petId: args.petId, recipientEmail },
    );
    if (latest && Date.now() - latest.createdAt < RESEND_COOLDOWN_MS) {
      return {
        ok: false as const,
        error: "Just sent. Wait a minute before emailing this recipient again.",
      };
    }

    // Reuse a live passport link, else mint a fresh 30-day one.
    const existing = await ctx.runQuery(
      internal.passportShare.latestLivePassportLink,
      { petId: args.petId },
    );
    let linkId: Id<"shareLinks">;
    let token: string;
    let reused: boolean;
    if (existing) {
      linkId = existing._id;
      token = existing.token;
      reused = true;
    } else {
      // shareLinks.createToken re-verifies ownership inside its transaction.
      const created = await ctx.runMutation(api.shareLinks.createToken, {
        ownerId: args.ownerId,
        petId: args.petId,
        scope: "passport",
        label: `Email to ${recipientEmail}`,
        expiresAt: Date.now() + NEW_LINK_TTL_MS,
      });
      linkId = created.linkId;
      token = created.token;
      reused = false;
    }

    const shareUrl = `${resolveBaseUrl(args.origin)}/p/${token}`;
    const siteUrl = convexSiteUrl();
    const qrUrl = siteUrl
      ? `${siteUrl}/api/passport/${token}/qr.svg`
      : undefined;
    const { subject, text, html, headers } = buildPassportShareEmail({
      petName: pet.name,
      species: pet.species,
      breed: pet.breed,
      ...(note ? { note } : {}),
      shareUrl,
      ...(qrUrl ? { qrUrl } : {}),
    });

    // Shared sender, called as-is (#39 guardrail: no resend.ts changes).
    // #35 quota gating is not on this branch, so the send is blind; any
    // failure (including daily-quota exhaustion) lands in the history row.
    let delivered = false;
    let deliveryError: string | undefined;
    try {
      const result: { ok: boolean; error?: string } = await ctx.runAction(
        internal.resend.sendEmail,
        { to: recipientEmail, subject, html, text, headers },
      );
      delivered = result?.ok === true;
      if (!delivered) deliveryError = result?.error ?? "Sending failed.";
    } catch (err) {
      deliveryError =
        err instanceof Error ? err.message : "Sending failed unexpectedly.";
    }

    await ctx.runMutation(internal.passportShare.recordSend, {
      ownerId: args.ownerId,
      petId: args.petId,
      linkId,
      recipientEmail,
      ...(note ? { note } : {}),
      status: delivered ? "sent" : "failed",
      ...(deliveryError ? { error: deliveryError } : {}),
    });

    return {
      ok: true as const,
      reused,
      token,
      linkId,
      delivered,
      ...(deliveryError ? { deliveryError } : {}),
    };
  },
});
