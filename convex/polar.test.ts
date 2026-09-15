/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  buildCreateCheckoutRequest,
  parseCheckoutResponse,
  tierFromMetadata,
} from "./polar";
import { verifyStandardWebhookSignature } from "./polarHttp";

const modules = import.meta.glob("./**/*.ts");

// ---------------------------------------------------------------------------
// Standard Webhooks signature verification (Polar-compatible)
// ---------------------------------------------------------------------------

// Edge-runtime safe base64 helpers (no Node Buffer in the test environment).
function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function utf8ToB64(value: string): string {
  return bytesToB64(new TextEncoder().encode(value));
}

async function signPayload(
  secretB64: string,
  id: string,
  timestamp: string,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    b64ToBytes(secretB64) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${payload}`),
  );
  return bytesToB64(new Uint8Array(digest));
}

describe("polar webhook signature (Standard Webhooks)", () => {
  const secretB64 = utf8ToB64("test-signing-secret");
  const whsec = `whsec_${secretB64}`;
  const payload = JSON.stringify({
    type: "subscription.active",
    data: { id: "sub_123" },
  });
  const nowSeconds = 1_800_000_000;
  const id = "msg_test_001";

  test("valid signature verifies", async () => {
    const sig = await signPayload(secretB64, id, String(nowSeconds), payload);
    const ok = await verifyStandardWebhookSignature({
      id,
      timestamp: String(nowSeconds),
      payload,
      signatureHeader: `v1,${sig}`,
      secret: whsec,
      nowSeconds,
    });
    expect(ok).toBe(true);
  });

  test("signature from the wrong secret fails", async () => {
    const otherB64 = utf8ToB64("attacker-secret");
    const sig = await signPayload(otherB64, id, String(nowSeconds), payload);
    const ok = await verifyStandardWebhookSignature({
      id,
      timestamp: String(nowSeconds),
      payload,
      signatureHeader: `v1,${sig}`,
      secret: whsec,
      nowSeconds,
    });
    expect(ok).toBe(false);
  });

  test("tampered payload fails", async () => {
    const sig = await signPayload(secretB64, id, String(nowSeconds), payload);
    const tampered = payload.replace("active", "revoked");
    const ok = await verifyStandardWebhookSignature({
      id,
      timestamp: String(nowSeconds),
      payload: tampered,
      signatureHeader: `v1,${sig}`,
      secret: whsec,
      nowSeconds,
    });
    expect(ok).toBe(false);
  });

  test("stale timestamp outside tolerance fails", async () => {
    const stale = nowSeconds - 3600;
    const sig = await signPayload(secretB64, id, String(stale), payload);
    const ok = await verifyStandardWebhookSignature({
      id,
      timestamp: String(stale),
      payload,
      signatureHeader: `v1,${sig}`,
      secret: whsec,
      nowSeconds,
    });
    expect(ok).toBe(false);
  });

  test("malformed signature header fails", async () => {
    const sig = await signPayload(secretB64, id, String(nowSeconds), payload);
    for (const header of ["", `v2,${sig}`, `v1 ${sig}`, "garbage"]) {
      const ok = await verifyStandardWebhookSignature({
        id,
        timestamp: String(nowSeconds),
        payload,
        signatureHeader: header,
        secret: whsec,
        nowSeconds,
      });
      expect(ok).toBe(false);
    }
  });

  test("non-numeric timestamp fails", async () => {
    const ok = await verifyStandardWebhookSignature({
      id,
      timestamp: "not-a-number",
      payload,
      signatureHeader: "v1,AAAA",
      secret: whsec,
      nowSeconds,
    });
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Entitlement sync from webhook events (internal mutations)
// ---------------------------------------------------------------------------

describe("polar entitlement sync", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  async function createOwner(email = "ada@example.com") {
    return await t.run(async (ctx) =>
      ctx.db.insert("owners", {
        externalId: `ext-${email}`,
        name: "Test Owner",
        email,
        createdAt: Date.now(),
      }),
    );
  }

  test("subscription.active grants tier + ids + period end", async () => {
    const ownerId = await createOwner();
    await t.mutation(internal.polar.syncSubscription, {
      polarSubId: "sub_123",
      status: "active",
      customerId: "cus_123",
      customerEmail: "ada@example.com",
      tierHint: "plus",
      currentPeriodEnd: Date.now() + 30 * 24 * 3600 * 1000,
    });
    const owner = await t.run(async (ctx) => ctx.db.get(ownerId));
    expect(owner).toMatchObject({
      billingTier: "plus",
      polarCustomerId: "cus_123",
      polarSubId: "sub_123",
    });
    expect(owner?.currentPeriodEnd).toBeGreaterThan(Date.now());
  });

  test("metadata ownerId attributes entitlement without email match", async () => {
    const ownerId = await createOwner("someone-else@example.com");
    await t.mutation(internal.polar.syncSubscription, {
      polarSubId: "sub_meta",
      status: "active",
      customerId: "cus_meta",
      tierHint: "family",
      metadataOwnerId: ownerId,
    });
    const owner = await t.run(async (ctx) => ctx.db.get(ownerId));
    expect(owner).toMatchObject({
      billingTier: "family",
      polarSubId: "sub_meta",
    });
  });

  test("subscription.revoked downgrades to free immediately", async () => {
    const ownerId = await createOwner();
    await t.mutation(internal.polar.syncSubscription, {
      polarSubId: "sub_1",
      status: "active",
      customerId: "cus_1",
      customerEmail: "ada@example.com",
      tierHint: "plus",
      currentPeriodEnd: Date.now() + 30 * 24 * 3600 * 1000,
    });
    await t.mutation(internal.polar.syncSubscription, {
      polarSubId: "sub_1",
      status: "revoked",
      customerId: "cus_1",
      customerEmail: "ada@example.com",
      currentPeriodEnd: Date.now() + 30 * 24 * 3600 * 1000,
    });
    const owner = await t.run(async (ctx) => ctx.db.get(ownerId));
    expect(owner?.billingTier).toBe("free");
  });

  test("past_due keeps grace access through the paid period", async () => {
    const ownerId = await createOwner();
    const periodEnd = Date.now() + 30 * 24 * 3600 * 1000;
    await t.mutation(internal.polar.syncSubscription, {
      polarSubId: "sub_1",
      status: "active",
      customerId: "cus_1",
      customerEmail: "ada@example.com",
      tierHint: "plus",
      currentPeriodEnd: periodEnd,
    });
    await t.mutation(internal.polar.syncSubscription, {
      polarSubId: "sub_1",
      status: "past_due",
      customerId: "cus_1",
      customerEmail: "ada@example.com",
      currentPeriodEnd: periodEnd,
    });
    const owner = await t.run(async (ctx) => ctx.db.get(ownerId));
    expect(owner?.billingTier).toBe("plus");
    expect(owner?.currentPeriodEnd).toBe(periodEnd);
  });

  test("event for unknown customer is a safe no-op", async () => {
    await t.mutation(internal.polar.syncSubscription, {
      polarSubId: "sub_ghost",
      status: "active",
      customerId: "cus_ghost",
      tierHint: "plus",
    });
    const owners = await t.run(async (ctx) =>
      ctx.db.query("owners").collect(),
    );
    expect(owners).toHaveLength(0);
  });

  test("customer.deleted downgrades that customer", async () => {
    const ownerId = await createOwner();
    await t.mutation(internal.polar.syncSubscription, {
      polarSubId: "sub_1",
      status: "active",
      customerId: "cus_bye",
      customerEmail: "ada@example.com",
      tierHint: "plus",
    });
    await t.mutation(internal.polar.detachCustomer, { customerId: "cus_bye" });
    const owner = await t.run(async (ctx) => ctx.db.get(ownerId));
    expect(owner?.billingTier).toBe("free");
  });

  test("checkout.confirmed latches the polar customer id", async () => {
    const ownerId = await createOwner();
    await t.mutation(internal.polar.linkCheckoutCustomer, {
      customerId: "cus_first",
      metadataOwnerId: ownerId,
    });
    const owner = await t.run(async (ctx) => ctx.db.get(ownerId));
    expect(owner?.polarCustomerId).toBe("cus_first");
  });
});

// ---------------------------------------------------------------------------
// Tier + limit gating (requireTier / requireWithinLimit via public surfaces)
// ---------------------------------------------------------------------------

describe("tier gating", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  async function createOwner(tier?: "plus" | "family", periodEnd?: number) {
    return await t.run(async (ctx) =>
      ctx.db.insert("owners", {
        externalId: `ext-${Math.random()}`,
        name: "Owner",
        email: `owner-${Math.random()}@example.com`,
        createdAt: Date.now(),
        ...(tier ? { billingTier: tier } : {}),
        ...(periodEnd !== undefined ? { currentPeriodEnd: periodEnd } : {}),
      }),
    );
  }

  test("free tier allows 1 pet, denies the 2nd", async () => {
    const ownerId = await createOwner();
    await t.mutation(api.pets.create, { ownerId, name: "Fido", species: "dog" });
    await expect(
      t.mutation(api.pets.create, { ownerId, name: "Second", species: "cat" }),
    ).rejects.toThrow(/Upgrade required/);
  });

  test("plus tier allows 5 pets, denies the 6th", async () => {
    const ownerId = await createOwner("plus");
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.pets.create, {
        ownerId,
        name: `Pet ${i}`,
        species: "dog",
      });
    }
    await expect(
      t.mutation(api.pets.create, { ownerId, name: "Six", species: "cat" }),
    ).rejects.toThrow(/plus plan allows up to 5/);
  });

  test("family tier allows 10 pets, denies the 11th", async () => {
    const ownerId = await createOwner("family");
    for (let i = 0; i < 10; i++) {
      await t.mutation(api.pets.create, {
        ownerId,
        name: `Pet ${i}`,
        species: "dog",
      });
    }
    await expect(
      t.mutation(api.pets.create, { ownerId, name: "Eleven", species: "cat" }),
    ).rejects.toThrow(/family plan allows up to 10/);
  });

  test("archiving a pet frees a free-tier slot", async () => {
    const ownerId = await createOwner();
    const petId = await t.mutation(api.pets.create, {
      ownerId,
      name: "Fido",
      species: "dog",
    });
    await t.mutation(api.pets.archive, { ownerId, petId });
    const second = await t.mutation(api.pets.create, {
      ownerId,
      name: "New",
      species: "cat",
    });
    expect(second).toBeTruthy();
  });

  test("expired currentPeriodEnd collapses a paid tier to free", async () => {
    const ownerId = await createOwner("plus", Date.now() - 1000);
    await t.mutation(api.pets.create, { ownerId, name: "Fido", species: "dog" });
    await expect(
      t.mutation(api.pets.create, { ownerId, name: "Second", species: "cat" }),
    ).rejects.toThrow(/free plan allows up to 1/);
  });

  test("free tier allows 1 share link, denies the 2nd; plus allows more", async () => {
    const freeOwner = await createOwner();
    const pet = await t.mutation(api.pets.create, {
      ownerId: freeOwner,
      name: "Fido",
      species: "dog",
    });
    await t.mutation(api.shareLinks.createToken, {
      ownerId: freeOwner,
      petId: pet,
      scope: "passport",
    });
    await expect(
      t.mutation(api.shareLinks.createToken, {
        ownerId: freeOwner,
        petId: pet,
        scope: "passport",
      }),
    ).rejects.toThrow(/Upgrade required/);

    const plusOwner = await createOwner("plus");
    const plusPet = await t.mutation(api.pets.create, {
      ownerId: plusOwner,
      name: "Plus Pet",
      species: "dog",
    });
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.shareLinks.createToken, {
        ownerId: plusOwner,
        petId: plusPet,
        scope: "passport",
      });
    }
  });

  test("revoking a share link frees the free-tier slot", async () => {
    const ownerId = await createOwner();
    const pet = await t.mutation(api.pets.create, {
      ownerId,
      name: "Fido",
      species: "dog",
    });
    const { linkId } = await t.mutation(api.shareLinks.createToken, {
      ownerId,
      petId: pet,
      scope: "passport",
    });
    await t.mutation(api.shareLinks.revoke, { ownerId, linkId });
    const second = await t.mutation(api.shareLinks.createToken, {
      ownerId,
      petId: pet,
      scope: "vaccines_only",
    });
    expect(second.token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("billingStatus reports tier + limits", async () => {
    const ownerId = await createOwner("family", Date.now() + 60_000);
    const status = await t.query(api.billing.billingStatus, { ownerId });
    expect(status.tier).toBe("family");
    expect(status.limits).toMatchObject({ pets: 10, documents: null, shareLinks: null });

    const freeOwner = await createOwner();
    const free = await t.query(api.billing.billingStatus, { ownerId: freeOwner });
    expect(free.tier).toBe("free");
    expect(free.limits).toMatchObject({ pets: 1, documents: 25, shareLinks: 1 });
  });
});

// ---------------------------------------------------------------------------
// Checkout request construction (pure functions — no live Polar calls)
// ---------------------------------------------------------------------------

describe("checkout creation (mocked, pure)", () => {
  test("buildCreateCheckoutRequest targets /v1/checkouts/ with auth + metadata", () => {
    const request = buildCreateCheckoutRequest({
      accessToken: "polar_test_token",
      productId: "prod-plus-uuid",
      successUrl: "https://petdocs.example/dashboard",
      ownerId: "owner123",
      customerEmail: "ada@example.com",
      apiBase: "https://api.polar.sh",
    });
    expect(request.url).toBe("https://api.polar.sh/v1/checkouts/");
    expect(request.init.method).toBe("POST");
    expect(request.init.headers.Authorization).toBe("Bearer polar_test_token");
    const body = JSON.parse(request.init.body);
    expect(body.products).toEqual(["prod-plus-uuid"]);
    expect(body.success_url).toBe("https://petdocs.example/dashboard");
    expect(body.metadata.ownerId).toBe("owner123");
    expect(body.customer_email).toBe("ada@example.com");
  });

  test("parseCheckoutResponse extracts the hosted checkout url", () => {
    expect(parseCheckoutResponse({ url: "https://polar.sh/checkout/abc" })).toBe(
      "https://polar.sh/checkout/abc",
    );
    expect(parseCheckoutResponse({})).toBeNull();
    expect(parseCheckoutResponse(null)).toBeNull();
    expect(parseCheckoutResponse("nope")).toBeNull();
  });

  test("tierFromMetadata: hint wins, product ids match, fallback is plus", () => {
    expect(tierFromMetadata("family", undefined)).toBe("family");
    expect(tierFromMetadata("plus", "ignored")).toBe("plus");
    expect(tierFromMetadata(undefined, undefined)).toBe("plus");
    expect(tierFromMetadata("bogus", undefined)).toBe("plus");
  });
});
