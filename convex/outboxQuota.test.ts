/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { dailyLimitFromEnv, todayUtc } from "./outboxQuota";

const modules = import.meta.glob("./**/*.ts");

describe("outboxQuota day keys", () => {
  test("rolls over exactly at UTC midnight", () => {
    // 2026-09-15 23:59:59.999Z vs 2026-09-16 00:00:00.000Z
    expect(todayUtc(Date.UTC(2026, 8, 15, 23, 59, 59, 999))).toBe("2026-09-15");
    expect(todayUtc(Date.UTC(2026, 8, 16, 0, 0, 0, 0))).toBe("2026-09-16");
  });

  test("keys on UTC, not local time", () => {
    // 2026-09-15 20:00:00Z is already the next day in e.g. UTC+8.
    expect(todayUtc(Date.UTC(2026, 8, 15, 20, 0, 0))).toBe("2026-09-15");
    expect(todayUtc(Date.UTC(2026, 0, 1, 0, 0, 0))).toBe("2026-01-01");
  });
});

describe("dailyLimitFromEnv", () => {
  const ORIGINAL = process.env.RESEND_DAILY_LIMIT;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.RESEND_DAILY_LIMIT;
    else process.env.RESEND_DAILY_LIMIT = ORIGINAL;
  });

  test("falls back to 100 when unset or junk", () => {
    expect(dailyLimitFromEnv(undefined)).toBe(100);
    expect(dailyLimitFromEnv(null)).toBe(100);
    expect(dailyLimitFromEnv("")).toBe(100);
    expect(dailyLimitFromEnv("not-a-number")).toBe(100);
    expect(dailyLimitFromEnv("0")).toBe(100);
    expect(dailyLimitFromEnv("-5")).toBe(100);
  });

  test("parses a configured positive limit", () => {
    process.env.RESEND_DAILY_LIMIT = "250";
    expect(dailyLimitFromEnv(process.env.RESEND_DAILY_LIMIT)).toBe(250);
    expect(dailyLimitFromEnv(" 300 ")).toBe(300);
  });
});

describe("outboxQuota counters", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  test("increment accumulates and status reports the remaining budget", async () => {
    await t.mutation(internal.outboxQuota.increment, { day: "2026-09-15" });
    await t.mutation(internal.outboxQuota.increment, { day: "2026-09-15" });

    const status = await t.query(api.outboxQuota.status, {
      day: "2026-09-15",
    });
    expect(status).toEqual({
      day: "2026-09-15",
      sent: 2,
      limit: 100,
      remaining: 98,
      exhausted: false,
    });
  });

  test("midnight day-rollover starts a fresh counter", async () => {
    for (let i = 0; i < 3; i += 1) {
      await t.mutation(internal.outboxQuota.increment, { day: "2026-09-15" });
    }

    // Previous day still holds its count...
    const before = await t.query(api.outboxQuota.status, {
      day: "2026-09-15",
    });
    expect(before.sent).toBe(3);

    // ...while the next UTC day is untouched until its first send.
    const nextDayBefore = await t.query(api.outboxQuota.status, {
      day: "2026-09-16",
    });
    expect(nextDayBefore).toEqual({
      day: "2026-09-16",
      sent: 0,
      limit: 100,
      remaining: 100,
      exhausted: false,
    });

    await t.mutation(internal.outboxQuota.increment, { day: "2026-09-16" });
    const nextDay = await t.query(api.outboxQuota.status, {
      day: "2026-09-16",
    });
    expect(nextDay.sent).toBe(1);
    expect(nextDay.remaining).toBe(99);
  });

  test("reaching the limit exhausts the day without a 429", async () => {
    process.env.RESEND_DAILY_LIMIT = "2";
    try {
      await t.mutation(internal.outboxQuota.increment, { day: "2026-09-15" });
      const oneLeft = await t.query(api.outboxQuota.status, {
        day: "2026-09-15",
      });
      expect(oneLeft.exhausted).toBe(false);
      expect(oneLeft.remaining).toBe(1);

      await t.mutation(internal.outboxQuota.increment, { day: "2026-09-15" });
      const spent = await t.query(api.outboxQuota.status, {
        day: "2026-09-15",
      });
      expect(spent.exhausted).toBe(true);
      expect(spent.remaining).toBe(0);
    } finally {
      delete process.env.RESEND_DAILY_LIMIT;
    }
  });

  test("markExhausted flags the day even under the limit", async () => {
    await t.mutation(internal.outboxQuota.markExhausted, {
      day: "2026-09-15",
    });
    const status = await t.query(api.outboxQuota.status, {
      day: "2026-09-15",
    });
    expect(status.exhausted).toBe(true);
    expect(status.sent).toBe(0);

    // The flag is day-scoped: tomorrow is unaffected.
    const tomorrow = await t.query(api.outboxQuota.status, {
      day: "2026-09-16",
    });
    expect(tomorrow.exhausted).toBe(false);
  });

  test("status returns the exact documented shape", async () => {
    const status = await t.query(api.outboxQuota.status, {
      day: "2026-09-15",
    });
    expect(Object.keys(status).sort()).toEqual([
      "day",
      "exhausted",
      "limit",
      "remaining",
      "sent",
    ]);
    expect(typeof status.sent).toBe("number");
    expect(typeof status.limit).toBe("number");
    expect(typeof status.remaining).toBe("number");
    expect(typeof status.exhausted).toBe("boolean");
  });

  test("cleanupOld prunes rows older than the cutoff and keeps recent days", async () => {
    // Seed an old row directly (60+ days back) and a current one.
    await t.run(async (ctx) => {
      await ctx.db.insert("outboxQuota", {
        day: "2026-06-01",
        sent: 7,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("outboxQuota", {
        day: todayUtc(Date.now()),
        sent: 1,
        updatedAt: Date.now(),
      });
    });

    const deleted = await t.mutation(internal.outboxQuota.cleanupOld, {});
    expect(deleted).toBe(1);

    const oldDay = await t.query(api.outboxQuota.status, { day: "2026-06-01" });
    expect(oldDay.sent).toBe(0); // row gone → fresh zero state
    const today = await t.query(api.outboxQuota.status, {
      day: todayUtc(Date.now()),
    });
    expect(today.sent).toBe(1);
  });
});

describe("resend.sendEmail quota handling", () => {
  let t: ReturnType<typeof convexTest>;
  const ORIGINAL_KEY = process.env.RESEND_API_KEY;
  const ORIGINAL_FROM = process.env.RESEND_FROM;

  beforeEach(() => {
    t = convexTest({ schema, modules });
    process.env.RESEND_API_KEY = "re_test_key_placeholder";
    process.env.RESEND_FROM = "PetDocs <test@example.com>";
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = ORIGINAL_KEY;
    if (ORIGINAL_FROM === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = ORIGINAL_FROM;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const send = () =>
    t.action(internal.resend.sendEmail, {
      to: "reader@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    });

  test("successful send increments the day's counter", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await send();
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const status = await t.query(api.outboxQuota.status, {
      day: todayUtc(Date.now()),
    });
    expect(status.sent).toBe(1);
    expect(status.exhausted).toBe(false);
  });

  test("429 marks the day exhausted and returns { ok:false, error:'quota' }", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: "Too many requests" }), {
        status: 429,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await send();
    expect(result).toEqual({ ok: false, error: "quota" });

    const status = await t.query(api.outboxQuota.status, {
      day: todayUtc(Date.now()),
    });
    expect(status.exhausted).toBe(true);
  });

  test("exhausted day short-circuits without calling Resend", async () => {
    await t.mutation(internal.outboxQuota.markExhausted, {
      day: todayUtc(Date.now()),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await send();
    expect(result).toEqual({ ok: false, error: "quota" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("spent limit short-circuits at remaining <= 0", async () => {
    process.env.RESEND_DAILY_LIMIT = "1";
    try {
      await t.mutation(internal.outboxQuota.increment, {
        day: todayUtc(Date.now()),
      });
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await send();
      expect(result).toEqual({ ok: false, error: "quota" });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      delete process.env.RESEND_DAILY_LIMIT;
    }
  });

  test("non-quota failures keep the detailed error and do not count", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: "Invalid from address" }), {
        status: 403,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await send();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("403");
    expect(result.error).not.toBe("quota");

    const status = await t.query(api.outboxQuota.status, {
      day: todayUtc(Date.now()),
    });
    expect(status.sent).toBe(0);
    expect(status.exhausted).toBe(false);
  });
});

describe("resend.status quota surface", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  test("omits quota when no day is passed (back-compat shape)", async () => {
    const status = await t.query(api.resend.status, {});
    expect(Object.keys(status).sort()).toEqual(["fromSet", "keySet"]);
  });

  test("includes the quota snapshot when a day is passed", async () => {
    await t.mutation(internal.outboxQuota.increment, { day: "2026-09-15" });
    const status = await t.query(api.resend.status, { day: "2026-09-15" });
    expect(status.quota).toEqual({
      day: "2026-09-15",
      sent: 1,
      limit: 100,
      remaining: 99,
      exhausted: false,
    });
  });
});
