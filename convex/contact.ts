/**
 * Public contact form backend (/contact).
 *
 * `submit` is a PUBLIC MUTATION (not an action) on purpose:
 *   - Validation, the rate-cap read, and the insert are all database work.
 *     A single mutation runs as one serializable transaction, so the daily
 *     cap cannot race (an action would need runQuery + runMutation and
 *     admit a check-then-insert gap).
 *   - The staff-inbox forward (internal.mail.ingestInbound) is itself an
 *     internal mutation, callable directly from here.
 *
 * Anti-abuse (basic, per issue #37): per-email daily cap + global daily cap,
 * both measured inside this one transaction, plus a client-side honeypot
 * field that silently drops bot submissions. IP-based limiting is not
 * possible from a plain mutation (no request headers); revisit if the form
 * is ever moved behind an httpAction.
 *
 * Store-first: every accepted submission is persisted in contactMessages
 * even when the inbox forward fails (forwarded: false), so nothing is lost
 * while email delivery is not configured.
 */
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";

/** Recipient used for the staff-inbox forward. ingestInbound matches this
 *  address exactly when a mailAccount exists for it, else holds the message
 *  in the first active account (labels ["unmatched"]) — either way staff see
 *  it in /dashboard/admin/mail. */
const CONTACT_INBOX_TO = "support@petdocs.app";

const MAX_PER_EMAIL_PER_DAY = 3;
const MAX_TOTAL_PER_DAY = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const NAME_MAX = 100;
const EMAIL_MAX = 254;
const MESSAGE_MAX = 5000;

export type ContactSubmitResult = { ok: true } | { ok: false; reason: "rate_limited" };

function validate(input: {
  name: string;
  email: string;
  message: string;
}): { name: string; email: string; message: string } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const message = input.message.trim();
  if (!name) throw new Error("Name is required");
  if (name.length > NAME_MAX) throw new Error("Name is too long");
  if (!email) throw new Error("Email is required");
  if (email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (!message) throw new Error("Message is required");
  if (message.length > MESSAGE_MAX) throw new Error("Message is too long");
  return { name, email, message };
}

export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
    /** Honeypot: real users never fill this; bots do. */
    website: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), reason: v.literal("rate_limited") }),
  ),
  handler: async (ctx, args): Promise<ContactSubmitResult> => {
    // Honeypot trip: pretend success, store nothing.
    if (args.website && args.website.trim().length > 0) {
      return { ok: true };
    }

    const clean = validate(args);
    const now = Date.now();
    const dayStart = now - DAY_MS;

    // Per-email daily cap (bounded read: one more than the cap suffices).
    const recentForEmail = await ctx.db
      .query("contactMessages")
      .withIndex("by_email", (q) => q.eq("email", clean.email))
      .take(MAX_PER_EMAIL_PER_DAY + 1);
    const sentToday = recentForEmail.filter((m) => m.createdAt >= dayStart);
    if (sentToday.length >= MAX_PER_EMAIL_PER_DAY) {
      return { ok: false, reason: "rate_limited" };
    }

    // Global daily cap, bounded the same way.
    const recentTotal = await ctx.db
      .query("contactMessages")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", dayStart))
      .take(MAX_TOTAL_PER_DAY + 1);
    if (recentTotal.length >= MAX_TOTAL_PER_DAY) {
      return { ok: false, reason: "rate_limited" };
    }

    // Store first — the message is never lost, forward or not.
    const contactId = await ctx.db.insert("contactMessages", {
      name: clean.name,
      email: clean.email,
      message: clean.message,
      status: "new",
      forwarded: false,
      createdAt: now,
    });

    // Forward into the staff inbox. A nested-mutation failure rolls back
    // only the forward's own writes; our insert above stays intact.
    let forwarded = false;
    try {
      await ctx.runMutation(internal.mail.ingestInbound, {
        to: CONTACT_INBOX_TO,
        from: clean.email,
        subject: `Contact form: ${clean.name}`,
        text: clean.message,
        html: `<p>${clean.message
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;")
          .replace(/\n/g, "<br/>")}</p>`,
      });
      forwarded = true;
    } catch {
      // Inbox not configured yet — keep the stored message, forwarded:false.
    }
    if (forwarded) {
      await ctx.db.patch(contactId, { forwarded: true });
    }

    return { ok: true };
  },
});
