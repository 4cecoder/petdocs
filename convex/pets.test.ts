/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("pets", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  async function createOwner(email = "ada@example.com") {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("owners", {
        externalId: `ext-${email}`,
        name: "Test Owner",
        email,
        createdAt: Date.now(),
      });
    });
  }

  test("create + listByOwner returns owner's pets", async () => {
    const ownerA = await createOwner("a@example.com");
    const ownerB = await createOwner("b@example.com");
    await t.mutation(api.pets.create, { ownerId: ownerA, name: "Fido", species: "dog" });
    await t.mutation(api.pets.create, { ownerId: ownerA, name: "Whiskers", species: "cat" });

    const mine = await t.query(api.pets.listByOwner, { ownerId: ownerA });
    expect(mine).toHaveLength(2);
    expect(mine.map((p) => p.name).sort()).toEqual(["Fido", "Whiskers"]);

    expect(await t.query(api.pets.listByOwner, { ownerId: ownerB })).toHaveLength(0);
  });

  test("get with wrong ownerId returns null", async () => {
    const ownerA = await createOwner("a@example.com");
    const ownerB = await createOwner("b@example.com");
    const petId = await t.mutation(api.pets.create, { ownerId: ownerA, name: "Fido", species: "dog" });

    expect(await t.query(api.pets.get, { ownerId: ownerA, petId })).toMatchObject({ name: "Fido" });
    expect(await t.query(api.pets.get, { ownerId: ownerB, petId })).toBeNull();
  });

  test("create with empty name throws", async () => {
    const ownerId = await createOwner();
    await expect(
      t.mutation(api.pets.create, { ownerId, name: "   ", species: "dog" }),
    ).rejects.toThrow(/required/);
  });

  test("archive flips status to archived", async () => {
    const ownerId = await createOwner();
    const petId = await t.mutation(api.pets.create, { ownerId, name: "Fido", species: "dog" });

    await t.mutation(api.pets.archive, { ownerId, petId });
    const pet = await t.query(api.pets.get, { ownerId, petId });
    expect(pet?.status).toBe("archived");
  });

  test("update on locked pet throws", async () => {
    const ownerId = await createOwner();
    const petId = await t.mutation(api.pets.create, { ownerId, name: "Fido", species: "dog" });
    await t.run(async (ctx) => {
      await ctx.db.patch(petId, { locked: true });
    });

    await expect(t.mutation(api.pets.update, { ownerId, petId, name: "Rex" })).rejects.toThrow(
      /locked/,
    );
  });
});
