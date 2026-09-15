/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { resolveBaseUrl } from "./magicLink";

const modules = import.meta.glob("./**/*.ts");

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

  async function sha256Hex(token: string): Promise<string> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token),
    );
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

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
