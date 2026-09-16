/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("vaccinations", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest({ schema, modules });
  });

  test("reuses a suggestion-keyed row on retry", async () => {
    const ownerId = await t.run((ctx) =>
      ctx.db.insert("owners", {
        externalId: "ext-vaccination-test",
        name: "Test Owner",
        email: "vaccination@example.com",
        createdAt: Date.now(),
      }),
    );
    const petId = await t.mutation(api.pets.create, {
      ownerId,
      name: "Fido",
      species: "dog",
    });
    const suggestionKey = "document-1:vaccination";

    const first = await t.mutation(api.vaccinations.create, {
      ownerId,
      petId,
      vaccineName: "Rabies",
      suggestionKey,
    });
    await t.mutation(api.vaccinations.markAdministered, {
      ownerId,
      vaccinationId: first,
      administeredAt: 1_700_000_000_000,
    });

    const retry = await t.mutation(api.vaccinations.create, {
      ownerId,
      petId,
      vaccineName: "Rabies",
      suggestionKey,
    });

    expect(retry).toBe(first);
    const rows = await t.query(api.vaccinations.listByPet, { ownerId, petId });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("administered");
  });
});
