/**
 * Shared Resend sender for petdocs (server-only — never import from src/).
 *
 * Reads RESEND_API_KEY + RESEND_FROM from Convex env (process.env in actions).
 * Returns { ok: false, error } cleanly when config is missing or sending
 * fails — never throws for missing config, so login must not crash.
 * Zero console.* calls by design: a secret must never reach logs.
 */
import { internalAction } from "./_generated/server";
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
      return { ok: false, error: "No recipients" };
    }

    const subject = args.subject.slice(0, 998);
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
        return {
          ok: false,
          error: body.message || body.name || `Resend HTTP ${res.status}`,
        };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Failed to send the email." };
    }
  },
});
