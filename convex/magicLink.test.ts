/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach, afterEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { resolveBaseUrl, buildMagicLinkEmail } from "./magicLink";
import {
  isSuperadminAllowlisted,
  superadminEmails,
} from "./admin";

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

describe("magicLink origin resolution", () => {
  test("resolves localhost and 127.0.0.1", () => {
    expect(resolveBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(resolveBaseUrl("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });

  test("resolves seridian.dev and subdomains", () => {
    expect(resolveBaseUrl("https://petdocs.seridian.dev")).toBe(
      "https://petdocs.seridian.dev",
    );
    expect(resolveBaseUrl("https://preview--petdocs.seridian.dev")).toBe(
      "https://preview--petdocs.seridian.dev",
    );
  });

  test("rejects untrusted domains and falls back to default/env SITE_URL", () => {
    expect(resolveBaseUrl("https://malicious.com")).toBe(
      "https://petdocs.seridian.dev",
    );
    expect(resolveBaseUrl("invalid-url")).toBe(
      "https://petdocs.seridian.dev",
    );
    expect(resolveBaseUrl(undefined)).toBe("https://petdocs.seridian.dev");
  });
});

describe("magicLink database flows", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  test("storeToken and verifyMagicLink successfully signs in / registers", async () => {
    const email = "testowner@example.com";
    const rawToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const tokenHash = await sha256Hex(rawToken);

    await t.mutation(internal.magicLink.storeToken, {
      email,
      tokenHash,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const result = await t.mutation(api.magicLink.verifyMagicLink, {
      email,
      token: rawToken,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ownerId).toBeDefined();
      // Owner document was created
      const owner = await t.run(async (ctx) => ctx.db.get(result.ownerId));
      expect(owner).toMatchObject({
        email,
        externalId: email,
        name: "testowner",
      });
    }

    // Token reuse is rejected
    const secondAttempt = await t.mutation(api.magicLink.verifyMagicLink, {
      email,
      token: rawToken,
    });
    expect(secondAttempt.ok).toBe(false);
    if (!secondAttempt.ok) {
      expect(secondAttempt.error).toContain("already been used");
    }
  });

  test("verifyMagicLink rejects expired token", async () => {
    const email = "expired@example.com";
    const rawToken = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
    const tokenHash = await sha256Hex(rawToken);

    await t.mutation(internal.magicLink.storeToken, {
      email,
      tokenHash,
      expiresAt: Date.now() - 1000, // already expired
    });

    const result = await t.mutation(api.magicLink.verifyMagicLink, {
      email,
      token: rawToken,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("expired");
    }
  });

  test("verifyMagicLink rejects wrong token or wrong email", async () => {
    const result = await t.mutation(api.magicLink.verifyMagicLink, {
      email: "unknown@example.com",
      token: "wrongtoken",
    });
    expect(result.ok).toBe(false);
  });
});

describe("superadmin allowlist (#22)", () => {
  const ORIGINAL_ENV = process.env.SUPERADMIN_EMAILS;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.SUPERADMIN_EMAILS;
    } else {
      process.env.SUPERADMIN_EMAILS = ORIGINAL_ENV;
    }
  });

  test("default allowlist contains the owner email, normalized", () => {
    delete process.env.SUPERADMIN_EMAILS;
    expect(superadminEmails()).toContain("itsmedjt@gmail.com");
    expect(isSuperadminAllowlisted("ItsMedJT@Gmail.com")).toBe(true);
    expect(isSuperadminAllowlisted("  itsmedjt@gmail.com ")).toBe(true);
  });

  test("other emails are not allowlisted", () => {
    delete process.env.SUPERADMIN_EMAILS;
    expect(isSuperadminAllowlisted("someone.else@gmail.com")).toBe(false);
  });

  test("SUPERADMIN_EMAILS env var overrides the default list", () => {
    process.env.SUPERADMIN_EMAILS = "dev1@seridian.dev, dev2@Seridian.DEV";
    expect(superadminEmails()).toEqual([
      "dev1@seridian.dev",
      "dev2@seridian.dev",
    ]);
    expect(isSuperadminAllowlisted("dev2@seridian.dev")).toBe(true);
    expect(isSuperadminAllowlisted("itsmedjt@gmail.com")).toBe(false);
  });

  test("verifyMagicLink persists the superadmin tier on first sign-in", async () => {
    delete process.env.SUPERADMIN_EMAILS;
    const t2 = convexTest(schema, modules);
    const rawToken = "a".repeat(64);
    await t2.mutation(internal.magicLink.storeToken, {
      email: "itsmedjt@gmail.com",
      tokenHash: await sha256Hex(rawToken),
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const result = await t2.mutation(api.magicLink.verifyMagicLink, {
      email: "ItsMedJT@Gmail.com", // normalization must still match
      token: rawToken,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const owner = await t2.run(async (ctx) => ctx.db.get(result.ownerId));
      expect(owner?.role).toBe("superadmin");
    }
  });

  test("verifyMagicLink upgrades an existing non-superadmin owner", async () => {
    delete process.env.SUPERADMIN_EMAILS;
    const t3 = convexTest(schema, modules);
    await t3.run(async (ctx) => {
      await ctx.db.insert("owners", {
        externalId: "itsmedjt@gmail.com",
        email: "itsmedjt@gmail.com",
        name: "Owner",
        role: "owner",
        createdAt: Date.now(),
      });
    });
    const rawToken = "b".repeat(64);
    await t3.mutation(internal.magicLink.storeToken, {
      email: "itsmedjt@gmail.com",
      tokenHash: await sha256Hex(rawToken),
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const result = await t3.mutation(api.magicLink.verifyMagicLink, {
      email: "itsmedjt@gmail.com",
      token: rawToken,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const owner = await t3.run(async (ctx) => ctx.db.get(result.ownerId));
      expect(owner?.role).toBe("superadmin");
    }
  });

  test("verifyMagicLink does not grant superadmin to other emails", async () => {
    delete process.env.SUPERADMIN_EMAILS;
    const t4 = convexTest(schema, modules);
    const rawToken = "c".repeat(64);
    await t4.mutation(internal.magicLink.storeToken, {
      email: "regular@example.com",
      tokenHash: await sha256Hex(rawToken),
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const result = await t4.mutation(api.magicLink.verifyMagicLink, {
      email: "regular@example.com",
      token: rawToken,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const owner = await t4.run(async (ctx) => ctx.db.get(result.ownerId));
      expect(owner?.role).toBeUndefined();
    }
  });
});

describe("magic link email threading (#21)", () => {
  test("subject carries a short request timestamp", () => {
    const { subject } = buildMagicLinkEmail(
      "https://petdocs.seridian.dev/sign-in?token=x&email=y",
      new Date("2026-09-15T14:03:00Z"),
    );
    expect(subject).toMatch(/Sign in to PetDocs/);
    expect(subject).toContain("2026-09-15 14:03 UTC");
  });

  test("every send gets a unique Message-ID and no threading headers", () => {
    const a = buildMagicLinkEmail("https://x/sign-in", new Date());
    const b = buildMagicLinkEmail("https://x/sign-in", new Date());
    expect(a.headers["Message-ID"]).toMatch(/^<.+@.+>$/);
    expect(b.headers["Message-ID"]).toMatch(/^<.+@.+>$/);
    expect(a.headers["Message-ID"]).not.toBe(b.headers["Message-ID"]);
    for (const email of [a, b]) {
      expect(Object.keys(email.headers)).not.toContain("In-Reply-To");
      expect(Object.keys(email.headers)).not.toContain("References");
    }
  });
});

describe("directSignIn bypass removal (#17)", () => {
  test("the magicLink module no longer exports a directSignIn mutation", async () => {
    const magicLinkModule = await import("./magicLink");
    expect("directSignIn" in magicLinkModule).toBe(false);
  });
});
