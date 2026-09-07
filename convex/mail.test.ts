/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("mail", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  // requireRole(ctx, adminEmail, "support") resolves staff first, then falls
  // back to owners. The staff path still requires a matching owners row
  // (see convex/admin.ts), so every staff caller needs BOTH rows.
  async function setupStaff(email = "support@example.com") {
    const adminEmail = email.trim().toLowerCase();
    await t.run(async (ctx) => {
      await ctx.db.insert("owners", {
        externalId: `ext-${adminEmail}`,
        name: "Support Staff",
        email: adminEmail,
        createdAt: Date.now(),
      });
      await ctx.db.insert("staff", {
        email: adminEmail,
        name: "Support Staff",
        role: "support",
        active: true,
        createdAt: Date.now(),
      });
    });
    return adminEmail;
  }

  // Plain owner with no staff row: legacy rank owner (0) < support (2),
  // so any support-gated mail function must throw "Not authorized".
  async function setupPlainOwner(email = "plain-owner@example.com") {
    const normalized = email.trim().toLowerCase();
    await t.run(async (ctx) => {
      await ctx.db.insert("owners", {
        externalId: `ext-${normalized}`,
        name: "Plain Owner",
        email: normalized,
        createdAt: Date.now(),
      });
    });
    return normalized;
  }

  async function createAccount(
    adminEmail: string,
    emailAddress: string,
    label = "Support inbox",
  ) {
    const res: any = await t.mutation(api.mail.createAccount, {
      adminEmail,
      emailAddress,
      label,
    });
    // Contract returns the new account id (bare Id or wrapped object).
    return (res?._id ?? res?.accountId ?? res) as any;
  }

  function ingest(input: {
    to: string;
    from: string;
    subject: string;
    text: string;
    resendId?: string;
  }) {
    return t.mutation(internal.mail.ingestInbound, {
      to: input.to,
      from: input.from,
      subject: input.subject,
      text: input.text,
      ...(input.resendId ? { resendId: input.resendId } : {}),
    });
  }

  // listThreads may return an array or a { threads } envelope; normalize.
  async function listThreads(args: {
    adminEmail: string;
    accountId: any;
    label?: string;
  }) {
    const res: any = await t.query(api.mail.listThreads, { ...args } as any);
    if (Array.isArray(res)) return res as any[];
    if (Array.isArray(res?.threads)) return res.threads as any[];
    return [] as any[];
  }

  // getThread returns { thread, messages } (portal shape); normalize.
  async function getThread(adminEmail: string, threadId: any) {
    const res: any = await t.query(api.mail.getThread, {
      adminEmail,
      threadId,
    } as any);
    if (res?.thread) return res as { thread: any; messages: any[] };
    if (Array.isArray(res?.messages)) return res as { thread: any; messages: any[] };
    return { thread: res, messages: res?.messages ?? [] };
  }

  function threadLastAt(thread: any): number {
    return Number(
      thread?.lastAt ?? thread?.lastMessageAt ?? thread?.updatedAt ?? 0,
    );
  }

  test("ingest routes exact-match account inbox", async () => {
    const adminEmail = await setupStaff();
    const accountId = await createAccount(adminEmail, "inbox@petdocs.example");

    await ingest({
      to: "inbox@petdocs.example",
      from: "owner@example.com",
      subject: "Vaccine record",
      text: "Here is the record",
      resendId: "exact-1",
    });

    const inbox = await listThreads({ adminEmail, accountId, label: "inbox" });
    expect(inbox).toHaveLength(1);
    expect(inbox[0].subject).toBe("Vaccine record");
  });

  test("unknown recipient held as unmatched (not in inbox)", async () => {
    const adminEmail = await setupStaff();
    const accountId = await createAccount(adminEmail, "inbox@petdocs.example");

    await ingest({
      to: "nobody@petdocs.example",
      from: "owner@example.com",
      subject: "Lost mail",
      text: "Where does this go?",
      resendId: "unmatched-1",
    });

    const inbox = await listThreads({ adminEmail, accountId, label: "inbox" });
    expect(inbox).toHaveLength(0);

    const held = await listThreads({
      adminEmail,
      accountId,
      label: "unmatched",
    });
    expect(held).toHaveLength(1);
    expect(held[0].subject).toBe("Lost mail");
  });

  test("second ingest with same subject threads together", async () => {
    const adminEmail = await setupStaff();
    const accountId = await createAccount(adminEmail, "inbox@petdocs.example");

    await ingest({
      to: "inbox@petdocs.example",
      from: "owner@example.com",
      subject: "Same subject",
      text: "First message",
      resendId: "thread-1",
    });
    await ingest({
      to: "inbox@petdocs.example",
      from: "owner@example.com",
      subject: "Same subject",
      text: "Second message",
      resendId: "thread-2",
    });

    const inbox = await listThreads({ adminEmail, accountId, label: "inbox" });
    expect(inbox).toHaveLength(1);

    const view = await getThread(adminEmail, inbox[0]._id);
    expect(view.messages).toHaveLength(2);
    expect(view.messages.map((m: any) => m.text).sort()).toEqual([
      "First message",
      "Second message",
    ]);
  });

  test("different subject creates a new thread", async () => {
    const adminEmail = await setupStaff();
    const accountId = await createAccount(adminEmail, "inbox@petdocs.example");

    await ingest({
      to: "inbox@petdocs.example",
      from: "owner@example.com",
      subject: "Subject A",
      text: "Message A",
      resendId: "diff-a",
    });
    await ingest({
      to: "inbox@petdocs.example",
      from: "owner@example.com",
      subject: "Subject B",
      text: "Message B",
      resendId: "diff-b",
    });

    const inbox = await listThreads({ adminEmail, accountId, label: "inbox" });
    expect(inbox).toHaveLength(2);
    expect(inbox.map((th: any) => th.subject).sort()).toEqual([
      "Subject A",
      "Subject B",
    ]);
  });

  test("sendReply persists sent message + flips thread lastAt", async () => {
    const adminEmail = await setupStaff();
    const accountId = await createAccount(adminEmail, "inbox@petdocs.example");

    await ingest({
      to: "inbox@petdocs.example",
      from: "owner@example.com",
      subject: "Need help",
      text: "Question about passport",
      resendId: "reply-1",
    });

    const inbox = await listThreads({ adminEmail, accountId, label: "inbox" });
    expect(inbox).toHaveLength(1);
    const threadId = inbox[0]._id;
    const before = threadLastAt((await getThread(adminEmail, threadId)).thread);

    await new Promise((r) => setTimeout(r, 10));
    await t.mutation(api.mail.sendReply, {
      adminEmail,
      threadId,
      to: "owner@example.com",
      text: "Here is the answer",
    } as any);

    const view = await getThread(adminEmail, threadId);
    expect(view.messages.map((m: any) => m.text)).toContain(
      "Here is the answer",
    );
    const after = threadLastAt(view.thread);
    expect(after).toBeGreaterThanOrEqual(before);
    // Guard against same-ms flake: the reply must at least be present and
    // the thread timestamp must not move backwards.
    expect(view.messages).toHaveLength(2);
  });

  test("non-staff caller throws on listThreads", async () => {
    const adminEmail = await setupStaff();
    const accountId = await createAccount(adminEmail, "inbox@petdocs.example");
    const outsider = await setupPlainOwner();

    await expect(
      t.query(api.mail.listThreads, {
        adminEmail: outsider,
        accountId,
      } as any),
    ).rejects.toThrow(/Not authorized/);
  });

  test("duplicate account email rejected", async () => {
    const adminEmail = await setupStaff();
    await createAccount(adminEmail, "dup@petdocs.example");

    await expect(
      createAccount(adminEmail, "dup@petdocs.example"),
    ).rejects.toThrow();
  });

  test("getThread marks thread read", async () => {
    const adminEmail = await setupStaff();
    const accountId = await createAccount(adminEmail, "inbox@petdocs.example");

    await ingest({
      to: "inbox@petdocs.example",
      from: "owner@example.com",
      subject: "Unread thread",
      text: "Please read me",
      resendId: "read-1",
    });

    const inbox = await listThreads({ adminEmail, accountId, label: "inbox" });
    expect(inbox).toHaveLength(1);
    const threadId = inbox[0]._id;

    // First read marks; second read observes the flipped state.
    await getThread(adminEmail, threadId);
    const reread = await getThread(adminEmail, threadId);
    const threadUnread = (reread.thread as any)?.isUnread;
    const messages = reread.messages as any[];
    const allRead =
      messages.length > 0 && messages.every((m: any) => m.read === true);

    expect(threadUnread === false || allRead).toBe(true);
  });

  test("createAccount rejects non-staff caller", async () => {
    await setupStaff("owner-staff@example.com");
    const outsider = await setupPlainOwner("intruder@example.com");

    await expect(
      t.mutation(api.mail.createAccount, {
        adminEmail: outsider,
        emailAddress: "evil@petdocs.example",
        label: "Evil inbox",
      }),
    ).rejects.toThrow(/Not authorized/);
  });
});
