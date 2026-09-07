/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("notifications", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  async function createOwner(email = "owner@example.com") {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("owners", {
        externalId: `ext-${email}-${Date.now()}-${Math.random()}`,
        name: "Test Owner",
        email,
        createdAt: Date.now(),
      });
    });
  }

  function emit(args: {
    ownerId: any;
    kind:
      | "passport_view"
      | "reminder_sent"
      | "claim_filed"
      | "inbound_mail"
      | "transfer_redeemed";
    title: string;
    body: string;
    link?: string;
  }) {
    return t.mutation((internal as any).notifications.emit, args);
  }

  async function listNotifs(ownerId: any, limit?: number): Promise<any[]> {
    const fn = (api as any).notifications.list;
    const res: any =
      limit === undefined
        ? await t.query(fn, { ownerId })
        : await t.query(fn, { ownerId, limit });
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.notifications)) return res.notifications;
    if (Array.isArray(res?.items)) return res.items;
    return [];
  }

  async function getUnread(ownerId: any): Promise<number> {
    const res: any = await t.query((api as any).notifications.unreadCount, {
      ownerId,
    });
    if (typeof res === "number") return res;
    if (typeof res?.count === "number") return res.count;
    if (typeof res?.unreadCount === "number") return res.unreadCount;
    return Number(res);
  }

  function markRead(ownerId: any, notificationId: any) {
    return t.mutation((api as any).notifications.markRead, {
      ownerId,
      notificationId,
    });
  }

  function markAllRead(ownerId: any) {
    return t.mutation((api as any).notifications.markAllRead, { ownerId });
  }

  test("emit + list round trip", async () => {
    const ownerId = await createOwner("a@example.com");
    const id = await emit({
      ownerId,
      kind: "passport_view",
      title: "Someone viewed passport",
      body: "Mochi passport viewed",
      link: "/dashboard/share",
    });
    expect(id).toBeDefined();

    const items = await listNotifs(ownerId);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      ownerId,
      kind: "passport_view",
      title: "Someone viewed passport",
      body: "Mochi passport viewed",
      link: "/dashboard/share",
    });
  });

  test("unreadCount counts only unread", async () => {
    const ownerId = await createOwner("a@example.com");
    const first = await emit({
      ownerId,
      kind: "passport_view",
      title: "View 1",
      body: "body 1",
    });
    await emit({
      ownerId,
      kind: "reminder_sent",
      title: "Reminder 1",
      body: "body 2",
    });
    expect(await getUnread(ownerId)).toBe(2);

    await markRead(ownerId, first);
    expect(await getUnread(ownerId)).toBe(1);
  });

  test("markRead flips one notification to read", async () => {
    const ownerId = await createOwner("a@example.com");
    const first = await emit({
      ownerId,
      kind: "claim_filed",
      title: "Claim 1",
      body: "claim body",
    });
    await emit({
      ownerId,
      kind: "inbound_mail",
      title: "Mail 1",
      body: "mail body",
    });

    await markRead(ownerId, first);

    const items = await listNotifs(ownerId);
    expect(items).toHaveLength(2);
    const flipped = items.find((n: any) => String(n._id) === String(first));
    expect(flipped).toBeDefined();
    expect(flipped.readAt).toBeDefined();
    expect(await getUnread(ownerId)).toBe(1);
  });

  test("markAllRead zeroes unread count", async () => {
    const ownerId = await createOwner("a@example.com");
    await emit({
      ownerId,
      kind: "passport_view",
      title: "V1",
      body: "b1",
    });
    await emit({
      ownerId,
      kind: "reminder_sent",
      title: "V2",
      body: "b2",
    });
    await emit({
      ownerId,
      kind: "transfer_redeemed",
      title: "V3",
      body: "b3",
    });
    expect(await getUnread(ownerId)).toBe(3);

    await markAllRead(ownerId);
    expect(await getUnread(ownerId)).toBe(0);

    const items = await listNotifs(ownerId);
    expect(items).toHaveLength(3);
    for (const n of items) expect(n.readAt).toBeDefined();
  });

  test("list scoped per owner (second owner sees none)", async () => {
    const ownerA = await createOwner("a@example.com");
    const ownerB = await createOwner("b@example.com");
    await emit({
      ownerId: ownerA,
      kind: "passport_view",
      title: "A only",
      body: "secret",
    });

    expect(await listNotifs(ownerB)).toHaveLength(0);
    expect(await getUnread(ownerB)).toBe(0);
    expect(await listNotifs(ownerA)).toHaveLength(1);
  });

  test("body capped at 280 chars", async () => {
    const ownerId = await createOwner("a@example.com");
    const longBody = "x".repeat(500);
    await emit({
      ownerId,
      kind: "inbound_mail",
      title: "Long body",
      body: longBody,
    });

    const items = await listNotifs(ownerId);
    expect(items).toHaveLength(1);
    expect(items[0].body.length).toBeLessThanOrEqual(280);
    // Stored body must be a prefix of the input (truncated, not transformed).
    expect(longBody.startsWith(items[0].body)).toBe(true);
    expect(items[0].body.length).toBeGreaterThan(0);
  });

  test("wrong-owner markRead throws", async () => {
    const ownerA = await createOwner("a@example.com");
    const ownerB = await createOwner("b@example.com");
    const id = await emit({
      ownerId: ownerA,
      kind: "passport_view",
      title: "Private",
      body: "private body",
    });

    await expect(markRead(ownerB, id)).rejects.toThrow();
    // Original stays unread.
    expect(await getUnread(ownerA)).toBe(1);
  });

  test("limit respected", async () => {
    const ownerId = await createOwner("a@example.com");
    for (let i = 0; i < 5; i++) {
      await emit({
        ownerId,
        kind: "reminder_sent",
        title: `Reminder ${i}`,
        body: `body ${i}`,
      });
    }

    expect(await listNotifs(ownerId)).toHaveLength(5);
    expect(await listNotifs(ownerId, 2)).toHaveLength(2);
    expect(await listNotifs(ownerId, 3)).toHaveLength(3);
  });

  test("emit without link succeeds and stores no link", async () => {
    const ownerId = await createOwner("a@example.com");
    const id = await emit({
      ownerId,
      kind: "transfer_redeemed",
      title: "Transfer done",
      body: "transfer body",
    });
    expect(id).toBeDefined();

    const items = await listNotifs(ownerId);
    expect(items).toHaveLength(1);
    expect(items[0].link).toBeUndefined();
  });
});
