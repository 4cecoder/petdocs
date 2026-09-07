/**
 * Superadmin integrations surface (server-only, never import from src/).
 *
 * status() reports boolean presence for keys plus public sender and site
 * values. No secret values ever leave the server.
 * sendTestEmail() queues a tiny test message via the shared Resend sender.
 * Both are superadmin only via requireRole from ./admin.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireRole } from "./admin";

const DEFAULT_SITE_URL = "http://localhost:3000";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resendStatusValidator = v.object({
  keySet: v.boolean(),
  fromSet: v.boolean(),
  from: v.optional(v.string()),
});

function testEmailTemplate(): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "PetDocs test email";
  const text =
    "Hi from PetDocs. This is a test email from the integrations page. " +
    "If you got this, Resend sending works.";
  const html =
    "<!doctype html><html><body style=\"margin:0;padding:0;background-color:#FFFBF5;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;\">" +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" " +
    "style=\"background-color:#FFFBF5;padding:32px 16px;\"><tr><td align=\"center\">" +
    "<table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" " +
    "style=\"max-width:480px;width:100%;background-color:#ffffff;" +
    "border:1px solid #F0E2D3;border-radius:16px;overflow:hidden;\">" +
    "<tr><td style=\"padding:32px 32px 8px 32px;\">" +
    "<div style=\"font-size:13px;font-weight:600;letter-spacing:0.05em;" +
    "text-transform:uppercase;color:#0D9488;\">PetDocs</div></td></tr>" +
    "<tr><td style=\"padding:8px 32px 0 32px;\">" +
    "<h1 style=\"margin:0;font-size:20px;color:#1C1917;\">PetDocs test email</h1>" +
    "<p style=\"margin:12px 0 0 0;font-size:14px;color:#57534E;\">" +
    "If you got this, Resend sending works.</p></td></tr>" +
    "<tr><td style=\"padding:0 32px 32px 32px;\">" +
    "<p style=\"margin:16px 0 0 0;font-size:12px;color:#78716C;\">" +
    "Sent from the superadmin integrations page.</p></td></tr>" +
    "</table></td></tr></table></body></html>";
  return { subject, html, text };
}

/**
 * Integration status for the superadmin page. Booleans plus public sender
 * and site values only. Never returns keys or secrets.
 */
export const status = query({
  args: { adminEmail: v.string() },
  returns: v.object({
    resend: resendStatusValidator,
    stripe: v.object({
      keySet: v.boolean(),
      webhookSecretSet: v.boolean(),
    }),
    site: v.object({
      siteUrl: v.string(),
      convexDeployment: v.string(),
    }),
    email: resendStatusValidator,
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "superadmin");
    const from = process.env.RESEND_FROM?.trim() || "";
    const resend = {
      keySet: (process.env.RESEND_API_KEY?.trim() || "") !== "",
      fromSet: from !== "",
      from: from || undefined,
    };
    const stripe = {
      keySet: (process.env.STRIPE_SECRET_KEY?.trim() || "") !== "",
      webhookSecretSet:
        (process.env.STRIPE_WEBHOOK_SECRET?.trim() || "") !== "",
    };
    const siteUrl =
      (process.env.SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, "") ||
      DEFAULT_SITE_URL;
    const rawDeployment = process.env.CONVEX_DEPLOYMENT?.trim() || "";
    const convexDeployment = rawDeployment.includes("dev")
      ? "dev"
      : "prod-like";
    return {
      resend,
      stripe,
      site: { siteUrl, convexDeployment },
      email: { ...resend },
    };
  },
});

/**
 * Queue a tiny test email. Superadmin only. Validates the address, then
 * schedules the shared Resend sender. Returns { ok } when queued.
 */
export const sendTestEmail = mutation({
  args: { adminEmail: v.string(), to: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "superadmin");
    const to = args.to.trim();
    if (!EMAIL_RE.test(to)) {
      throw new Error("Enter a valid email address");
    }
    const { subject, html, text } = testEmailTemplate();
    await ctx.scheduler.runAfter(0, internal.resend.sendEmail, {
      to,
      subject,
      html,
      text,
    });
    return { ok: true };
  },
});
