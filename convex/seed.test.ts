/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("demo seed role coverage", () => {
  test("creates pet data plus every staff role with server-side gates", async () => {
    const t = convexTest({ schema, modules });
    const result = await t.mutation(api.seed.seedDemo, {});

    expect(result).toMatchObject({ owners: 7, staff: 5, pets: 3 });

    const data = await t.run(async (ctx) => ({
      owners: await ctx.db.query("owners").collect(),
      pets: await ctx.db.query("pets").collect(),
      staff: await ctx.db.query("staff").collect(),
    }));

    expect(data.pets.map((pet) => pet.name).sort()).toEqual([
      "Mochi",
      "Pickle",
      "Udon",
    ]);
    expect(data.staff.map((staff) => staff.role).sort()).toEqual([
      "auditor",
      "manager",
      "owner",
      "superadmin",
      "support",
    ]);
    expect(data.owners.find((owner) => owner.email === "superadmin@demo.pet")?.role).toBe(
      "superadmin",
    );

    await expect(
      t.query(api.admin.stats, { adminEmail: "auditor@demo.pet" }),
    ).resolves.toMatchObject({ owners: 7, pets: 3 });
    await expect(
      t.query(api.admin.auditLog, { adminEmail: "auditor@demo.pet" }),
    ).resolves.toEqual([]);
    await expect(
      t.query(api.admin.recentOwners, { adminEmail: "auditor@demo.pet" }),
    ).rejects.toThrow(/Not authorized/);

    await expect(
      t.query(api.admin.recentOwners, { adminEmail: "support@demo.pet" }),
    ).resolves.toHaveLength(7);
    await expect(
      t.query(api.admin.stats, { adminEmail: "manager@demo.pet" }),
    ).resolves.toMatchObject({ owners: 7 });
    await expect(
      t.query(api.admin.stats, { adminEmail: "owner@demo.pet" }),
    ).resolves.toMatchObject({ owners: 7 });
    await expect(
      t.query(api.admin.stats, { adminEmail: "superadmin@demo.pet" }),
    ).resolves.toMatchObject({ owners: 7 });
  });

  test("repairs staff rows without resetting existing demo owners", async () => {
    const t = convexTest({ schema, modules });
    const legacyAuditorId = await t.run(async (ctx) =>
      ctx.db.insert("owners", {
        externalId: "legacy-demo-auditor",
        name: "Legacy Auditor",
        email: "auditor@demo.pet",
        createdAt: 123,
      }),
    );

    const result = await t.mutation(api.seed.repairDemoRoles, {});

    expect(result).toMatchObject({
      ownersCreated: 4,
      staffCreated: 5,
      staffUpdated: 0,
      roles: 5,
    });

    const data = await t.run(async (ctx) => ({
      owners: await ctx.db.query("owners").collect(),
      staff: await ctx.db.query("staff").collect(),
      legacyAuditor: await ctx.db.get(legacyAuditorId),
    }));
    expect(data.owners).toHaveLength(5);
    expect(data.staff).toHaveLength(5);
    expect(data.legacyAuditor).toMatchObject({
      name: "Legacy Auditor",
      email: "auditor@demo.pet",
      createdAt: 123,
    });

    await expect(
      t.query(api.admin.getMe, { email: "auditor@demo.pet" }),
    ).resolves.toMatchObject({ role: "auditor" });
    await expect(
      t.query(api.admin.getMe, { email: "superadmin@demo.pet" }),
    ).resolves.toMatchObject({ role: "superadmin" });
  });
});
