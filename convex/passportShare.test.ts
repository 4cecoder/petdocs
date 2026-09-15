/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  buildPassportShareEmail,
  convexSiteUrl,
} from "./passportShare";
import { qrSvgResponse } from "./qr";

const modules = import.meta.glob("./**/*.ts");

describe("passportShare (#39)", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  async function setup(tier?: "plus" | "family") {
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert("owners", {
        externalId: `ext-${Date.now()}-${Math.random()}`,
        name: "Owner",
        email: "secret-owner@example.com",
        createdAt: Date.now(),
        // Paid tier for tests that exceed the free share-link limit (1).
        ...(tier ? { billingTier: tier } : {}),
      }),
    );
    const petId = await t.mutation(api.pets.create, {
      ownerId,
      name: "Mochi",
      species: "dog",
      breed: "Shiba Inu",
    });
    return { ownerId, petId };
  }

  test("emailPassport mints a link, then REUSES the live token for other recipients", async () => {
    const { ownerId, petId } = await setup();

    const first = await t.action(api.passportShare.emailPassport, {
      ownerId,
      petId,
      recipientEmail: "vet@clinic.example",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.reused).toBe(false);
    expect(first.token).toMatch(/^[0-9a-f]{64}$/);

    // The minted link exists and is a live passport link.
    const link = await t.run(async (ctx) => ctx.db.get(first.linkId));
    expect(link).toMatchObject({ scope: "passport", isActive: true });

    // A different recipient reuses the SAME capability — no token sprawl.
    const second = await t.action(api.passportShare.emailPassport, {
      ownerId,
      petId,
      recipientEmail: "groomer@shop.example",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.reused).toBe(true);
    expect(second.token).toBe(first.token);
    expect(second.linkId).toBe(first.linkId);
  });

  test("cooldown: same pet+recipient within 60s is blocked, expired cooldown sends", async () => {
    const { ownerId, petId } = await setup();

    const first = await t.action(api.passportShare.emailPassport, {
      ownerId,
      petId,
      recipientEmail: "vet@clinic.example",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("expected ok");

    const blocked = await t.action(api.passportShare.emailPassport, {
      ownerId,
      petId,
      recipientEmail: "vet@clinic.example",
    });
    expect(blocked).toEqual({
      ok: false,
      error: expect.stringContaining("Wait a minute"),
    });

    // Age the latest attempt past the cooldown window → send proceeds.
    await t.run(async (ctx) => {
      await ctx.db.insert("shareEmails", {
        ownerId,
        petId,
        linkId: first.linkId,
        recipientEmail: "vet@clinic.example",
        status: "failed",
        createdAt: Date.now() - 61_000,
      });
    });
    const again = await t.action(api.passportShare.emailPassport, {
      ownerId,
      petId,
      recipientEmail: "vet@clinic.example",
    });
    expect(again.ok).toBe(true);
  });

  test("validation: bad email and over-long note rejected without side effects", async () => {
    const { ownerId, petId } = await setup();

    expect(
      await t.action(api.passportShare.emailPassport, {
        ownerId,
        petId,
        recipientEmail: "not-an-email",
      }),
    ).toEqual({ ok: false, error: "Enter a valid email address." });

    expect(
      await t.action(api.passportShare.emailPassport, {
        ownerId,
        petId,
        recipientEmail: "vet@clinic.example",
        note: "x".repeat(501),
      }),
    ).toEqual({
      ok: false,
      error: "Note must be at most 500 characters.",
    });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("shareEmails").collect(),
    );
    expect(rows).toHaveLength(0);
  });

  test("authz: only the owner emails their pet; links stay owner-scoped", async () => {
    const { ownerId, petId } = await setup();
    const otherOwner = await t.run(async (ctx) =>
      ctx.db.insert("owners", {
        externalId: `ext-other-${Date.now()}`,
        name: "Other",
        email: "other@example.com",
        createdAt: Date.now(),
      }),
    );

    expect(
      await t.action(api.passportShare.emailPassport, {
        ownerId: otherOwner,
        petId,
        recipientEmail: "vet@clinic.example",
      }),
    ).toEqual({ ok: false, error: "Pet not found." });

    // shareLinks.createToken keeps its own ownership guard too.
    await expect(
      t.mutation(api.shareLinks.createToken, {
        ownerId: otherOwner,
        petId,
        scope: "passport",
      }),
    ).rejects.toThrow("Pet not found");
    expect(ownerId).toBeTruthy();
  });

  test("history: listEmails records sent-to, when, status, and link state", async () => {
    const { ownerId, petId } = await setup();
    // No RESEND config in tests → the attempt is recorded as failed.
    const result = await t.action(api.passportShare.emailPassport, {
      ownerId,
      petId,
      recipientEmail: "vet@clinic.example",
      note: "for Friday",
    });
    expect(result.ok).toBe(true);

    const history = await t.query(api.passportShare.listEmails, { ownerId });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      petName: "Mochi",
      recipientEmail: "vet@clinic.example",
      note: "for Friday",
      status: "failed",
      linkActive: true,
    });
    expect(history[0].error).toBeTruthy();

    // Revoking the reused link flips linkActive in the history.
    if (!result.ok) return;
    await t.mutation(api.shareLinks.revoke, {
      ownerId,
      linkId: result.linkId,
    });
    const after = await t.query(api.passportShare.listEmails, { ownerId });
    expect(after[0].linkActive).toBe(false);
  });

  test("isTokenLive: live true, revoked/expired/unknown false", async () => {
    const { ownerId, petId } = await setup("plus");
    const { token } = await t.mutation(api.shareLinks.createToken, {
      ownerId,
      petId,
      scope: "passport",
    });
    expect(await t.query(internal.passportShare.isTokenLive, { token })).toBe(
      true,
    );
    const expired = await t.mutation(api.shareLinks.createToken, {
      ownerId,
      petId,
      scope: "passport",
      expiresAt: Date.now() - 1000,
    });
    expect(
      await t.query(internal.passportShare.isTokenLive, {
        token: expired.token,
      }),
    ).toBe(false);
    expect(
      await t.query(internal.passportShare.isTokenLive, {
        token: "f".repeat(64),
      }),
    ).toBe(false);
    const live = await t.mutation(api.shareLinks.createToken, {
      ownerId,
      petId,
      scope: "passport",
    });
    await t.mutation(api.shareLinks.revoke, {
      ownerId,
      linkId: live.linkId,
    });
    expect(
      await t.query(internal.passportShare.isTokenLive, { token: live.token }),
    ).toBe(false);
  });
});

describe("QR rendering (#39)", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  test("renderSvg action produces a standalone SVG string", async () => {
    const svg = await t.action(internal.qr.renderSvg, {
      text: "https://petdocs.seridian.dev/p/" + "a".repeat(64),
    });
    expect(typeof svg).toBe("string");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("viewBox");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    // Rendered server-side in-process: no external API URL is embedded.
    expect(svg).not.toContain("https://");
  });

  test("qrSvgResponse serves the SVG content type", () => {
    const res = qrSvgResponse("<svg></svg>");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
  });
});

describe("passport share email builder (#39)", () => {
  const shareUrl = "https://petdocs.seridian.dev/p/" + "b".repeat(64);
  const qrUrl =
    "https://necessary-cod-965.convex.site/api/passport/" +
    "b".repeat(64) +
    "/qr.svg";

  test("HTML contains the link and the hosted QR image", () => {
    const { subject, html, text, headers } = buildPassportShareEmail({
      petName: "Mochi",
      species: "dog",
      breed: "Shiba Inu",
      note: "for Friday",
      shareUrl,
      qrUrl,
    });
    expect(subject).toContain("Mochi");
    expect(html).toContain(`href="${shareUrl}"`);
    expect(html).toContain(`src="${qrUrl}"`);
    expect(html).toContain(`alt="QR code linking to Mochi's passport"`);
    expect(html).toContain("for Friday");
    expect(text).toContain(shareUrl);
    expect(text).toContain("for Friday");
    // Standalone conversation: unique Message-ID, never threading headers.
    expect(headers["Message-ID"]).toMatch(/^<[\s\S]+@[\s\S]+>$/);
    expect(headers["In-Reply-To"]).toBeUndefined();
    expect(headers["References"]).toBeUndefined();
  });

  test("user-controlled fields are HTML-escaped; QR optional", () => {
    const noQr = buildPassportShareEmail({
      petName: "<script>alert(1)</script>",
      breed: 'Shiba "Inu" &amp; friends',
      shareUrl,
    });
    expect(noQr.html).not.toContain("<script>alert(1)</script>");
    expect(noQr.html).toContain("&lt;script&gt;");
    expect(noQr.html).toContain("Shiba &quot;Inu&quot; &amp;amp; friends");
    expect(noQr.html).not.toContain("<img");

    const hostileNote = buildPassportShareEmail({
      petName: "Mochi",
      note: "<img src=x onerror=alert(1)>",
      shareUrl,
      qrUrl,
    });
    expect(hostileNote.html).not.toContain("<img src=x");
    expect(hostileNote.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("convexSiteUrl (#39)", () => {
  const OLD = { ...process.env };

  function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
    delete process.env.CONVEX_SITE_URL;
    delete process.env.CONVEX_CLOUD_URL;
    for (const [k, v] of Object.entries(vars)) {
      if (v !== undefined) process.env[k] = v;
    }
    try {
      fn();
    } finally {
      process.env.CONVEX_SITE_URL = OLD.CONVEX_SITE_URL;
      process.env.CONVEX_CLOUD_URL = OLD.CONVEX_CLOUD_URL;
    }
  }

  test("prefers CONVEX_SITE_URL, derives from CONVEX_CLOUD_URL, else null", () => {
    withEnv(
      { CONVEX_SITE_URL: "https://nice-axolotl-123.convex.site/" },
      () => {
        expect(convexSiteUrl()).toBe("https://nice-axolotl-123.convex.site");
      },
    );
    withEnv(
      { CONVEX_CLOUD_URL: "https://nice-axolotl-123.convex.cloud" },
      () => {
        expect(convexSiteUrl()).toBe("https://nice-axolotl-123.convex.site");
      },
    );
    withEnv({}, () => {
      expect(convexSiteUrl()).toBeNull();
    });
  });
});
