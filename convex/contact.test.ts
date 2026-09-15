/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("contact:submit", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  const base = {
    name: "Jamie Rivera",
    email: "jamie@example.com",
    message: "Hello, can I move my rabbit's records over from another app?",
  };

  async function storedCount() {
    return t.run(async (ctx) => {
      const rows = await ctx.db.query("contactMessages").collect();
      return rows.length;
    });
  }

  // --- validation ----------------------------------------------------------

  test("rejects an empty name", async () => {
    await expect(
      t.mutation(api.contact.submit, { ...base, name: "   " }),
    ).rejects.toThrow("Name is required");
  });

  test("rejects an invalid email", async () => {
    await expect(
      t.mutation(api.contact.submit, { ...base, email: "not-an-email" }),
    ).rejects.toThrow("Enter a valid email address");
  });

  test("rejects an empty message", async () => {
    await expect(
      t.mutation(api.contact.submit, { ...base, message: "" }),
    ).rejects.toThrow("Message is required");
  });

  test("rejects an over-long message", async () => {
    await expect(
      t.mutation(api.contact.submit, { ...base, message: "x".repeat(5001) }),
    ).rejects.toThrow("Message is too long");
  });

  // --- storage -------------------------------------------------------------

  test("stores an accepted submission (store-only when no inbox exists)", async () => {
    const res = await t.mutation(api.contact.submit, base);
    expect(res).toEqual({ ok: true });
    const rows = await t.run(async (ctx) =>
      ctx.db.query("contactMessages").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Jamie Rivera",
      email: "jamie@example.com",
      status: "new",
      forwarded: false,
    });
  });

  test("normalizes the email for storage", async () => {
    await t.mutation(api.contact.submit, {
      ...base,
      email: "  Jamie@Example.COM ",
    });
    const rows = await t.run(async (ctx) =>
      ctx.db.query("contactMessages").collect(),
    );
    expect(rows[0]?.email).toBe("jamie@example.com");
  });

  // --- honeypot ------------------------------------------------------------

  test("honeypot submissions report success but store nothing", async () => {
    const res = await t.mutation(api.contact.submit, {
      ...base,
      website: "http://spam.example",
    });
    expect(res).toEqual({ ok: true });
    expect(await storedCount()).toBe(0);
  });

  // --- rate caps -----------------------------------------------------------

  test("caps submissions at 3 per email per day", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await t.mutation(api.contact.submit, base);
      expect(res).toEqual({ ok: true });
    }
    const fourth = await t.mutation(api.contact.submit, base);
    expect(fourth).toEqual({ ok: false, reason: "rate_limited" });
    expect(await storedCount()).toBe(3);
  });

  test("the per-email cap does not block a different email", async () => {
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.contact.submit, base);
    }
    const res = await t.mutation(api.contact.submit, {
      ...base,
      email: "someone-else@example.com",
    });
    expect(res).toEqual({ ok: true });
  });

  test("enforces the global daily cap", async () => {
    // Fill the global budget for "today" directly (other senders).
    await t.run(async (ctx) => {
      for (let i = 0; i < 200; i++) {
        await ctx.db.insert("contactMessages", {
          name: `Bulk ${i}`,
          email: `bulk-${i}@example.com`,
          message: "bulk",
          status: "new",
          forwarded: false,
          createdAt: Date.now() - 1000,
        });
      }
    });
    const res = await t.mutation(api.contact.submit, base);
    expect(res).toEqual({ ok: false, reason: "rate_limited" });
  });

  // --- staff-inbox forward ---------------------------------------------------

  test("forwards into an active staff inbox and marks forwarded", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("mailAccounts", {
        emailAddress: "support@petdocs.app",
        label: "Support inbox",
        active: true,
        createdAt: Date.now(),
      });
    });

    const res = await t.mutation(api.contact.submit, base);
    expect(res).toEqual({ ok: true });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("contactMessages").collect(),
    );
    expect(rows[0]?.forwarded).toBe(true);

    const threads = await t.run(async (ctx) =>
      ctx.db.query("mailThreads").collect(),
    );
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      subject: "Contact form: Jamie Rivera",
      labels: ["inbox"],
    });

    const messages = await t.run(async (ctx) =>
      ctx.db.query("mailMessages").collect(),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      from: "jamie@example.com",
      text: base.message,
    });
  });

  test("forward failure keeps the stored message with forwarded:false", async () => {
    // No mailAccounts: ingestInbound throws "No mail account available".
    const res = await t.mutation(api.contact.submit, base);
    expect(res).toEqual({ ok: true });
    const rows = await t.run(async (ctx) =>
      ctx.db.query("contactMessages").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.forwarded).toBe(false);
  });
});
