/**
 * Shared Resend sender for petdocs (server-only — never import from src/).
 *
 * Reads RESEND_API_KEY + RESEND_FROM from Convex env (process.env in actions).
 * Returns { ok: false, error } cleanly when config is missing or sending
 * fails — never throws for missing config, so login must not crash.
 * Zero console.* calls by design: a secret must never reach logs.
 */
import { internalAction, query } from "./_generated/server";
import { v } from "convex/values";

const RESEND_API = "https://api.resend.com/emails";

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
  },
  returns: v.object({ ok: v.boolean(), error: v.optional(v.string()) }),
  handler: async (_ctx, args): Promise<{ ok: boolean; error?: string }> => {
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

    const subject = args.subject.slice(0, 998);
    // ~100KB guard: Resend rejects oversized payloads, so truncate early.
    const html = args.html.slice(0, 100_000);
    const text = (args.text?.trim() ? args.text : stripHtml(html)).slice(
      0,
      100_000,
    );

    try {
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
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
      };
      if (!res.ok) {
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
      return { ok: true };
    } catch {
      return { ok: false, error: "Failed to send the email." };
    }
  },
});

/**
 * Integration status for the admin dashboard. Returns booleans plus the
 * public sender address only. Never returns keys or secrets.
 */
export const status = query({
  args: {},
  returns: v.object({
    keySet: v.boolean(),
    fromSet: v.boolean(),
    from: v.optional(v.string()),
  }),
  handler: async () => {
    const from = process.env.RESEND_FROM?.trim() || "";
    return {
      keySet: (process.env.RESEND_API_KEY?.trim() || "") !== "",
      fromSet: from !== "",
      from: from || undefined,
    };
  },
});
