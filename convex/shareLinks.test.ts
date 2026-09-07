/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("shareLinks", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  async function setup() {
    const ownerId = await t.run(async (ctx) =>
      ctx.db.insert("owners", {
        externalId: `ext-${Date.now()}-${Math.random()}`,
        name: "Owner",
        email: "secret-owner@example.com",
        createdAt: Date.now(),
      }),
    );
    const petId = await t.mutation(api.pets.create, {
      ownerId, name: "Fido", species: "dog", breed: "Lab",
    });
    await t.run(async (ctx) =>
      ctx.db.insert("vaccinations", {
        ownerId, petId, vaccineName: "Rabies", status: "administered",
        administeredAt: Date.now(), createdAt: Date.now(),
      }),
    );
    return { ownerId, petId };
  }

  test("createToken returns 64-hex-char token", async () => {
    const { ownerId, petId } = await setup();
    const { token } = await t.mutation(api.shareLinks.createToken, {
      ownerId, petId, scope: "passport",
    });
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("resolve returns passport projection without secrets", async () => {
    const { ownerId, petId } = await setup();
    const { token } = await t.mutation(api.shareLinks.createToken, {
      ownerId, petId, scope: "passport",
    });
    const result: any = await t.query(api.shareLinks.resolve, { token });
    expect(result.pet).toMatchObject({ name: "Fido", species: "dog" });
    expect(result.vaccinations).toHaveLength(1);
    const raw = JSON.stringify(result);
    expect(raw).not.toContain("secret-owner@example.com");
    expect(raw).not.toContain("storageId");
  });

  test("resolve with bogus token returns null", async () => {
    expect(await t.query(api.shareLinks.resolve, { token: "0".repeat(64) })).toBeNull();
  });

  test("revoke makes resolve return null", async () => {
    const { ownerId, petId } = await setup();
    const { token, linkId } = await t.mutation(api.shareLinks.createToken, {
      ownerId, petId, scope: "passport",
    });
    await t.mutation(api.shareLinks.revoke, { ownerId, linkId });
    expect(await t.query(api.shareLinks.resolve, { token })).toBeNull();
  });

  test("expired link resolves null", async () => {
    const { ownerId, petId } = await setup();
    const { token } = await t.mutation(api.shareLinks.createToken, {
      ownerId, petId, scope: "passport", expiresAt: Date.now() - 1000,
    });
    expect(await t.query(api.shareLinks.resolve, { token })).toBeNull();
  });

  test("recordView increments viewCount; maxViews enforced", async () => {
    const { ownerId, petId } = await setup();
    const open = await t.mutation(api.shareLinks.createToken, {
      ownerId, petId, scope: "passport",
    });
    expect(await t.mutation(api.shareLinks.recordView, { token: open.token })).toBe(1);
    expect(await t.mutation(api.shareLinks.recordView, { token: open.token })).toBe(2);

    const capped = await t.mutation(api.shareLinks.createToken, {
      ownerId, petId, scope: "passport", maxViews: 1,
    });
    expect(await t.mutation(api.shareLinks.recordView, { token: capped.token })).toBe(1);
    expect(await t.mutation(api.shareLinks.recordView, { token: capped.token })).toBeNull();
    expect(await t.query(api.shareLinks.resolve, { token: capped.token })).toBeNull();
  });
});
