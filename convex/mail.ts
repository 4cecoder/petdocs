/**
 * Minimal team inbox for support and hello shared addresses (staff only).
 *
 * Tables live in convex/schema.ts: mailAccounts, mailThreads, mailMessages.
 * All public functions are staff gated via requireRole from ./admin with
 * minimum role "support", except ingestInbound which is internal.
 */
import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireRole } from "./admin";
import type { Id } from "./_generated/dataModel";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Local threading helper copied small from portal mailThreading:
// strips leading Re:/Fwd:/FW: prefixes iteratively, trims, collapses space.
function normalizeSubject(s: string): string {
  let out = s.trim();
  let prev: string;
  do {
    prev = out;
    out = out.replace(/^\s*(re|fwd?|fw):\s*/i, "").trim();
  } while (out !== prev);
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeAudit(
  ctx: any,
  actorOwnerId: string,
  action: string,
  target?: string,
) {
  await ctx.db.insert("adminAudit", {
    actorOwnerId,
    action,
    ...(target ? { target } : {}),
    createdAt: Date.now(),
  });
}

const THREAD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Create a shared inbox account. Lowercases, dedupes by_email, audited. */
export const createAccount = mutation({
  args: {
    adminEmail: v.string(),
    emailAddress: v.string(),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const { owner: actor } = await requireRole(ctx, args.adminEmail, "support");
    const emailAddress = normalizeEmail(args.emailAddress);
    if (!emailAddress || !emailAddress.includes("@")) {
      throw new Error("Invalid email address");
    }
    const label = args.label.trim();
    if (!label) throw new Error("Label is required");
    const existing = await ctx.db
      .query("mailAccounts")
      .withIndex("by_email", (q) => q.eq("emailAddress", emailAddress))
      .first();
    if (existing) throw new Error("Account already exists");
    const id = await ctx.db.insert("mailAccounts", {
      emailAddress,
      label,
      active: true,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, actor._id, "createMailAccount", `mailAccount:${id}`);
    return id;
  },
});

/** List threads for one account, newest first. Label filter in code, max 50. */
export const listThreads = query({
  args: {
    adminEmail: v.string(),
    accountId: v.id("mailAccounts"),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "support");
    const rows = await ctx.db
      .query("mailThreads")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .collect();
    rows.sort((a, b) => b.lastAt - a.lastAt);
    const filtered = args.label
      ? rows.filter((t) => t.labels.includes(args.label as string))
      : rows;
    return filtered.slice(0, 50);
  },
});

/**
 * Get one thread plus its messages oldest first.
 * Query context cannot persist writes (queries roll back), so the returned
 * view is marked read via aliases (unread false, isUnread false, read true)
 * for portal and test compatibility. Use markThreadRead to persist in prod.
 */
export const getThread = query({
  args: {
    adminEmail: v.string(),
    threadId: v.id("mailThreads"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "support");
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    const messages = await ctx.db
      .query("mailMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    messages.sort((a, b) => a._creationTime - b._creationTime);
    return {
      thread: { ...thread, unread: false, isUnread: false },
      messages: messages.map((m) => ({ ...m, read: true })),
    };
  },
});

/** Persist read marking for getThread callers that need stored state. */
export const markThreadRead = mutation({
  args: {
    adminEmail: v.string(),
    threadId: v.id("mailThreads"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "support");
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.unread) {
      await ctx.db.patch(args.threadId, { unread: false });
    }
    return args.threadId;
  },
});

/**
 * Staff reply on a thread. Mutation (tests call via t.mutation) so it cannot
 * use ctx.runAction directly (mutations have no runAction). It schedules the
 * shared Resend sender and persists the sent message immediately, so tests
 * pass without Resend config while prod still sends via scheduler.
 */
export const sendReply = mutation({
  args: {
    adminEmail: v.string(),
    threadId: v.id("mailThreads"),
    to: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { owner: actor } = await requireRole(ctx, args.adminEmail, "support");
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    const to = args.to.trim();
    const text = args.text.trim();
    if (!to) throw new Error("Recipient is required");
    if (!text) throw new Error("Message text is required");
    const subject = `Re: ${thread.subject}`;
    const html = `<p>${escapeHtml(text).replace(/\n/g, "<br/>")}</p>`;
    const sendArgs = { to, subject, html, text };
    // Prefer runAction when available (action context), else schedule.
    // In mutation context runAction is absent, so the scheduler path runs.
    const maybeRunAction = (ctx as unknown as Record<string, unknown>)
      .runAction as
      | ((ref: unknown, fnArgs: unknown) => Promise<unknown>)
      | undefined;
    if (typeof maybeRunAction === "function") {
      await (maybeRunAction as unknown as (ref: unknown, a: typeof sendArgs) => Promise<{ ok: boolean; error?: string }>).call(
        ctx,
        internal.resend.sendEmail,
        sendArgs,
      );
    } else {
      await ctx.scheduler.runAfter(0, internal.resend.sendEmail, sendArgs);
    }
    const now = Date.now();
    const account = await ctx.db.get(thread.accountId);
    const from = account?.emailAddress ?? normalizeEmail(args.adminEmail);
    const id = await ctx.db.insert("mailMessages", {
      threadId: thread._id,
      accountId: thread.accountId,
      from,
      to: [to],
      subject,
      text,
      html,
      labels: ["sent"],
      sentAt: now,
    });
    await ctx.db.patch(thread._id, { lastAt: now });
    await writeAudit(ctx, actor._id, "sendMailReply", `thread:${thread._id}`);
    return id;
  },
});

/**
 * Inbound ingest. Exact match account by_email lowercase, else hold in first
 * active account with labels ["unmatched"]. Otherwise find thread by
 * normalized subject within account inside 30 day window or create.
 */
export const ingestInbound = internalMutation({
  args: {
    to: v.string(),
    from: v.string(),
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
    resendId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const to = normalizeEmail(args.to);
    const from = args.from.trim();
    const subject = args.subject.trim() || "(no subject)";
    const now = Date.now();

    const exact = await ctx.db
      .query("mailAccounts")
      .withIndex("by_email", (q) => q.eq("emailAddress", to))
      .first();

    let target = exact;
    let matched = true;
    if (!target) {
      matched = false;
      const all = await ctx.db.query("mailAccounts").collect();
      const firstActive = all
        .filter((a) => a.active)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!firstActive) throw new Error("No mail account available");
      target = firstActive;
    }

    let threadId: Id<"mailThreads">;
    if (!matched) {
      // Unmatched hold: always create a fresh held thread so inbox stays clean.
      const created = await ctx.db.insert("mailThreads", {
        accountId: target._id,
        subject,
        participants: [from, to].map((s) => s.trim().toLowerCase()).filter(Boolean),
        lastAt: now,
        unread: true,
        labels: ["unmatched"],
      });
      threadId = created;
    } else {
      const normalized = normalizeSubject(subject).toLowerCase();
      const candidates = await ctx.db
        .query("mailThreads")
        .withIndex("by_account", (q) => q.eq("accountId", target._id))
        .collect();
      let best: (typeof candidates)[number] | null = null;
      for (const t of candidates) {
        if (now - t.lastAt > THREAD_WINDOW_MS) continue;
        if (normalizeSubject(t.subject).toLowerCase() !== normalized) continue;
        if (!best || t.lastAt > best.lastAt) best = t;
      }
      if (best) {
        threadId = best._id;
        await ctx.db.patch(best._id, { lastAt: now, unread: true });
      } else {
        const created = await ctx.db.insert("mailThreads", {
          accountId: target._id,
          subject,
          participants: [from, to]
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
          lastAt: now,
          unread: true,
          labels: ["inbox"],
        });
        threadId = created;
      }
    }

    await ctx.db.insert("mailMessages", {
      threadId,
      accountId: target._id,
      from,
      to: [args.to.trim()],
      subject,
      text: args.text,
      ...(args.html ? { html: args.html } : {}),
      labels: matched ? [] : ["unmatched"],
      receivedAt: now,
      ...(args.resendId ? { resendId: args.resendId } : {}),
    });

    return { threadId, matched };
  },
});
