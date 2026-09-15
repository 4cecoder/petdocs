/**
 * Shared Resend sender for petdocs (server-only — never import from src/).
 *
 * Reads RESEND_API_KEY + RESEND_FROM from Convex env (process.env in actions).
 * Returns { ok: false, error } cleanly when config is missing or sending
 * fails — never throws for missing config, so login must not crash.
 * Zero console.* calls by design: a secret must never reach logs.
 *
 * Daily quota: every send passes the `outboxQuota` counter (convex/
 * outboxQuota.ts). When the day's budget is spent — or Resend answers 429 —
 * sendEmail returns { ok: false, error: "quota" } and callers treat quota
 * failures as a distinct, retryable state. Callers surface that state via
 * the status queries here and in outboxQuota.ts.
 */
import { internalAction, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { quotaFor, quotaStatusShape, todayUtc } from "./outboxQuota";

const RESEND_API = "https://api.resend.com/emails";

/** Header names that would thread this email as a reply (#21). */
const THREADING_HEADERS = /^(in-reply-to|references)$/i;

/**
 * #21: keep each email a standalone conversation. Keeps safe custom
 * headers (e.g. a unique Message-ID), strips In-Reply-To/References even
 * if a caller ever passes them, and bounds count/value length.
 */
export function sanitizeHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(headers).slice(0, 10)) {
    const key = rawKey.trim();
    if (!key || THREADING_HEADERS.test(key)) continue;
    const value = rawValue.trim();
    if (!value) continue;
    out[key] = value.slice(0, 998);
  }
  return out;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
    headers: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.object({ ok: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    const apiKey = process.env.RESEND_API_KEY?.trim() || "";
    if (!apiKey) {
      return {
        ok: false,
        error: "Resend is not connected (set RESEND_API_KEY)",
      };
    }
    const from = process.env.RESEND_FROM?.trim() || "";
    if (!from) {
      return {
        ok: false,
        error: "Resend from-address is not configured (set RESEND_FROM)",
      };
    }

    const to = args.to.trim();
    if (!to) {
      return { ok: false, error: "No recipient address." };
    }
    if (!args.html.trim()) {
      return { ok: false, error: "No email content." };
    }

    // Quota gate: skip the API call entirely once today's budget is spent
    // (or Resend already told us we are over). Config errors above must not
    // touch the counter — only real send attempts do.
    const day = todayUtc(Date.now());
    const quota = await ctx.runQuery(internal.outboxQuota.check, { day });
    if (quota.exhausted || quota.remaining <= 0) {
      return { ok: false, error: "quota" };
    }

    const subject = args.subject.slice(0, 998);
    // ~100KB guard: Resend rejects oversized payloads, so truncate early.
    const html = args.html.slice(0, 100_000);
    const text = (args.text?.trim() ? args.text : stripHtml(html)).slice(
      0,
      100_000,
    );

    try {
      const cleanHeaders = args.headers ? sanitizeHeaders(args.headers) : {};
      const res: Response = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
          // Custom headers (e.g. unique Message-ID) — threading headers
          // never survive sanitizeHeaders (#21).
          ...(Object.keys(cleanHeaders).length > 0
            ? { headers: cleanHeaders }
            : {}),
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
      };
      if (!res.ok) {
        // 429: Resend's own daily cap. Mark the day exhausted so later
        // sends short-circuit, and report a stable "quota" error string.
        if (res.status === 429) {
          await ctx.runMutation(internal.outboxQuota.markExhausted, { day });
          return { ok: false, error: "quota" };
        }
        // Always include the HTTP status; only echo Resend's short
        // message/name fields (never headers, body, or the API key).
        const detail = (body.message || body.name || "").trim().slice(0, 300);
        return {
          ok: false,
          error: detail
            ? `Resend error ${res.status}: ${detail}`
            : `Resend HTTP ${res.status}`,
        };
      }
      // Count the send only after Resend accepted it.
      await ctx.runMutation(internal.outboxQuota.increment, { day });
      return { ok: true };
    } catch {
      return { ok: false, error: "Failed to send the email." };
    }
  },
});

/**
 * Integration status for the admin dashboard. Returns booleans plus the
 * public sender address only. Never returns keys or secrets.
 *
 * Pass `day` (UTC "YYYY-MM-DD", e.g. from the client's `utcDayKey()`) to
 * include the daily quota snapshot: { day, sent, limit, remaining, exhausted }.
 */
export const status = query({
  args: { day: v.optional(v.string()) },
  returns: v.object({
    keySet: v.boolean(),
    fromSet: v.boolean(),
    from: v.optional(v.string()),
    quota: v.optional(quotaStatusShape),
  }),
  handler: async (ctx, args) => {
    const from = process.env.RESEND_FROM?.trim() || "";
    return {
      keySet: (process.env.RESEND_API_KEY?.trim() || "") !== "",
      fromSet: from !== "",
      from: from || undefined,
      ...(args.day
        ? { quota: await quotaFor(ctx, args.day) }
        : {}),
    };
  },
});
