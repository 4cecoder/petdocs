/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { resolveBaseUrl } from "./magicLink";
import {
  classifySendError,
  nextUtcMidnightIso,
  tokenHashOf,
} from "./mobileAuth";

const modules = import.meta.glob("./**/*.ts");

async function sha256Hex(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("mobileAuth deep-link origin (#24)", () => {
  test("the app scheme resolves to the fixed signin deep link", () => {
    expect(resolveBaseUrl("petdocs://signin")).toBe("petdocs://signin");
  });

  test("unknown app hosts are pinned back to signin (no open scheme)", () => {
    expect(resolveBaseUrl("petdocs://evil")).toBe("petdocs://signin");
    expect(resolveBaseUrl("petdocs://")).toBe("petdocs://signin");
  });

  test("web origins still resolve as before", () => {
    expect(resolveBaseUrl("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(resolveBaseUrl("https://petdocs.seridian.dev")).toBe(
      "https://petdocs.seridian.dev",
    );
    expect(resolveBaseUrl("https://malicious.com")).toBe(
      "https://petdocs.seridian.dev",
    );
    expect(resolveBaseUrl("javascript:alert(1)")).toBe(
      "https://petdocs.seridian.dev",
    );
  });
});

describe("mobileAuth helpers", () => {
  test("classifySendError maps Resend 429/quota wording to quotaExceeded", () => {
    expect(classifySendError("Resend error 429: Too many requests").quotaExceeded).toBe(true);
    expect(classifySendError("Resend error 429: rate_limited").quotaExceeded).toBe(true);
    expect(
      classifySendError("Resend is not connected (set RESEND_API_KEY)")
        .quotaExceeded,
    ).toBe(false);
    expect(classifySendError("Resend HTTP 500").quotaExceeded).toBe(false);
    expect(classifySendError(undefined).quotaExceeded).toBe(false);
  });

  test("nextUtcMidnightIso lands on the next 00:00 UTC", () => {
    expect(nextUtcMidnightIso(new Date("2026-09-15T14:03:00Z"))).toBe(
      "2026-09-16T00:00:00.000Z",
    );
    expect(nextUtcMidnightIso(new Date("2026-09-15T23:59:59Z"))).toBe(
      "2026-09-16T00:00:00.000Z",
    );
    expect(nextUtcMidnightIso(new Date("2026-12-31T10:00:00Z"))).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});

describe("mobileAuth database flows (#24)", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  test("requestAuthCode mints a magic token and reports honest delivery state", async () => {
    const result = await t.action(internal.mobileAuth.requestAuthCode, {
      email: "mobile.owner@example.com",
    });
    // No RESEND_API_KEY in tests → send attempted, not delivered, no quota.
    expect(result).toEqual({
      ok: true,
      attempted: true,
      delivered: false,
      quotaExceeded: false,
    });

    const latest = await t.query(internal.magicLink.latestTokenForEmail, {
      email: "mobile.owner@example.com",
    });
    expect(latest).not.toBeNull();
    expect(latest?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(latest?.usedAt).toBeUndefined();
  });

  test("requestAuthCode enforces the per-email cooldown with the quiet shape", async () => {
    const email = "cooldown@example.com";
    const first = await t.action(internal.mobileAuth.requestAuthCode, {
      email,
    });
    expect(first.attempted).toBe(true);

    const second = await t.action(internal.mobileAuth.requestAuthCode, {
      email,
    });
    // Cooldown hit — identical quiet shape to invalid emails.
    expect(second).toEqual({
      ok: true,
      attempted: false,
      delivered: false,
      quotaExceeded: false,
    });

    // Only one token row exists for the email.
    const rows = await t.run(async (ctx) =>
      (await ctx.db.query("magicTokens").collect()).filter(
        (r) => r.email === email,
      ),
    );
    expect(rows).toHaveLength(1);
  });

  test("requestAuthCode stays silent for invalid emails (no enumeration)", async () => {
    const result = await t.action(internal.mobileAuth.requestAuthCode, {
      email: "not-an-email",
    });
    expect(result).toEqual({
      ok: true,
      attempted: false,
      delivered: false,
      quotaExceeded: false,
    });
    const rows = await t.run(async (ctx) =>
      (await ctx.db.query("magicTokens").collect()).filter(
        (r) => r.email === "not-an-email",
      ),
    );
    expect(rows).toHaveLength(0);
  });

  test("verifyAndCreateSession issues a hashed 30-day session and consumes the token once", async () => {
    const email = "session.owner@example.com";
    const rawToken = "a".repeat(64);
    await t.mutation(internal.magicLink.storeToken, {
      email,
      tokenHash: await sha256Hex(rawToken),
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const result = await t.mutation(internal.mobileAuth.verifyAndCreateSession, {
      email,
      token: rawToken,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result.expiresAt).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);

    // Only the hash of the session token is stored.
    const sessions = await t.run(async (ctx) =>
      ctx.db.query("mobileSessions").collect(),
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(await tokenHashOf(result.sessionToken));
    expect(sessions[0].tokenHash).not.toContain(result.sessionToken);

    // Magic token is single-use (web + mobile share the same store).
    const second = await t.mutation(internal.mobileAuth.verifyAndCreateSession, {
      email,
      token: rawToken,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toContain("already been used");
    }

    // GET /api/me resolves through the session hash.
    const me = await t.query(internal.mobileAuth.me, {
      tokenHash: await tokenHashOf(result.sessionToken),
    });
    expect(me).not.toBeNull();
    expect(me?.ownerId).toBe(result.ownerId);
    expect(me?.email).toBe(email);
    expect(me?.pets).toEqual([]);
  });

  test("verifyAndCreateSession rejects unknown and expired magic tokens", async () => {
    const unknown = await t.mutation(
      internal.mobileAuth.verifyAndCreateSession,
      { email: "nobody@example.com", token: "f".repeat(64) },
    );
    expect(unknown).toEqual({ ok: false, error: "This sign-in link is invalid." });

    const email = "expired@example.com";
    await t.mutation(internal.magicLink.storeToken, {
      email,
      tokenHash: await sha256Hex("e".repeat(64)),
      expiresAt: Date.now() - 1000,
    });
    const expired = await t.mutation(
      internal.mobileAuth.verifyAndCreateSession,
      { email, token: "e".repeat(64) },
    );
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.error).toContain("expired");
    }
  });

  test("me rejects expired and revoked sessions", async () => {
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert("owners", {
        externalId: "dead.session@example.com",
        email: "dead.session@example.com",
        name: "Dead Session",
        createdAt: Date.now(),
      }),
    );
    const expiredHash = await sha256Hex("expired-session");
    await t.run(async (ctx) =>
      ctx.db.insert("mobileSessions", {
        ownerId,
        tokenHash: expiredHash,
        expiresAt: Date.now() - 1000,
        createdAt: Date.now(),
      }),
    );
    const revokedHash = await sha256Hex("revoked-session");
    await t.run(async (ctx) =>
      ctx.db.insert("mobileSessions", {
        ownerId,
        tokenHash: revokedHash,
        expiresAt: Date.now() + 1000,
        revokedAt: Date.now(),
        createdAt: Date.now(),
      }),
    );

    expect(await t.query(internal.mobileAuth.me, { tokenHash: expiredHash })).toBeNull();
    expect(await t.query(internal.mobileAuth.me, { tokenHash: revokedHash })).toBeNull();
  });

  test("petSummary returns read-only vitals + records for the owner's pet only", async () => {
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert("owners", {
        externalId: "pets@example.com",
        email: "pets@example.com",
        name: "Pet Owner",
        createdAt: Date.now(),
      }),
    );
    const strangerId = await t.run(async (ctx) =>
      ctx.db.insert("owners", {
        externalId: "stranger@example.com",
        email: "stranger@example.com",
        name: "Stranger",
        createdAt: Date.now(),
      }),
    );
    const petId = await t.run(async (ctx) =>
      ctx.db.insert("pets", {
        ownerId,
        name: "Rex",
        species: "dog",
        breed: "Shiba",
        sex: "male",
        weightKg: 12.5,
        microchipId: "9001",
        status: "active",
        createdAt: Date.now(),
      }),
    );
    const strangerPetId = await t.run(async (ctx) =>
      ctx.db.insert("pets", {
        ownerId: strangerId,
        name: "Hidden",
        species: "cat",
        status: "active",
        createdAt: Date.now(),
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("vaccinations", {
        ownerId,
        petId,
        vaccineName: "Rabies",
        status: "administered",
        administeredAt: Date.now() - 86400000,
        provider: "Dr. Woo",
        createdAt: Date.now(),
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("vetVisits", {
        ownerId,
        petId,
        visitedAt: Date.now() - 172800000,
        reason: "Annual checkup",
        clinicName: "Woo Clinic",
        createdAt: Date.now(),
      }),
    );
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["test-bytes"])),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("documents", {
        ownerId,
        petId,
        name: "vaccine-card.pdf",
        storageId,
        mime: "application/pdf",
        size: 1024,
        category: "vaccine_record",
        uploadedBy: "pets@example.com",
        createdAt: Date.now(),
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("documents", {
        ownerId,
        petId,
        name: "trashed.pdf",
        storageId,
        mime: "application/pdf",
        size: 2048,
        uploadedBy: "pets@example.com",
        isTrash: true,
        createdAt: Date.now(),
      }),
    );

    const sessionToken = "b".repeat(64);
    const sessionHash = await tokenHashOf(sessionToken);
    await t.run(async (ctx) =>
      ctx.db.insert("mobileSessions", {
        ownerId,
        tokenHash: sessionHash,
        expiresAt: Date.now() + 86400000,
        createdAt: Date.now(),
      }),
    );

    const summary = await t.query(internal.mobileAuth.petSummary, {
      tokenHash: sessionHash,
      petId,
    });
    expect(summary).not.toBeNull();
    expect(summary?.pet.name).toBe("Rex");
    expect(summary?.pet.weightKg).toBe(12.5);
    expect(summary?.vaccinations).toHaveLength(1);
    expect(summary?.vaccinations[0]?.vaccineName).toBe("Rabies");
    expect(summary?.visits).toHaveLength(1);
    // Trashed documents are excluded from the read-only summary.
    expect(summary?.documents.map((d) => d.name)).toEqual(["vaccine-card.pdf"]);

    // A foreign pet id is indistinguishable from an unknown one.
    expect(
      await t.query(internal.mobileAuth.petSummary, {
        tokenHash: sessionHash,
        petId: strangerPetId,
      }),
    ).toBeNull();

    // A dead session gets nothing.
    expect(
      await t.query(internal.mobileAuth.petSummary, {
        tokenHash: await sha256Hex("no-such-session"),
        petId,
      }),
    ).toBeNull();
  });

  test("the public web verifyMagicLink still works alongside mobile sessions", async () => {
    // Web and mobile share magicTokens; one flow must not break the other.
    const email = "cross.flow@example.com";
    const rawToken = "c".repeat(64);
    await t.mutation(internal.magicLink.storeToken, {
      email,
      tokenHash: await sha256Hex(rawToken),
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    const webResult = await t.mutation(api.magicLink.verifyMagicLink, {
      email,
      token: rawToken,
    });
    expect(webResult.ok).toBe(true);

    const mobileResult = await t.mutation(
      internal.mobileAuth.verifyAndCreateSession,
      { email, token: "d".repeat(64) },
    );
    expect(mobileResult.ok).toBe(false);
  });
});
