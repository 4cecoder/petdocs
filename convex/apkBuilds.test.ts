/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * #42 build hosting. Upload/finalize are superadmin-gated server-side via
 * requireRole (staff rows → ADMIN_EMAILS bootstrap → SUPERADMIN_EMAILS
 * allowlist → legacy stored role). The default allowlist in convex/admin.ts
 * (itsmedjt@gmail.com) is what the positive path asserts against, so these
 * tests pass on any deployment without env setup — the same convention as
 * magicLink.test.ts.
 */
const SUPERADMIN = "itsmedjt@gmail.com";
const STRANGER = "not-admin@example.com";

/**
 * An allowlisted superadmin has signed in before, so their owners row
 * exists — requireRole resolves authz through it.
 */
async function ensureOwner(
  t: ReturnType<typeof convexTest>,
  email: string,
): Promise<void> {
  await t.run(async (ctx) => {
    const existing = (await ctx.db.query("owners").collect()).find(
      (o) => o.email === email,
    );
    if (existing) return;
    await ctx.db.insert("owners", {
      externalId: `ext-${email}`,
      email,
      name: email,
      createdAt: Date.now(),
    });
  });
}

async function publish(
  t: ReturnType<typeof convexTest>,
  overrides?: Partial<{
    platform: "android" | "ios";
    version: string;
    sha256: string;
    uploadedBy: string;
    notes: string;
  }>,
) {
  const uploadedBy = overrides?.uploadedBy ?? SUPERADMIN;
  if (uploadedBy === SUPERADMIN) await ensureOwner(t, SUPERADMIN);
  const storageId = await t.run(async (ctx) =>
    ctx.storage.store(new Blob(["apk-bytes"])),
  );
  return await t.mutation(api.apkBuilds.finalize, {
    platform: "android",
    version: "0.1.0",
    storageId,
    sha256: "a".repeat(64),
    uploadedBy,
    ...overrides,
  });
}

describe("apkBuilds admin upload gate (#42)", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  test("finalize rejects a non-allowlisted uploader", async () => {
    await expect(
      publish(t, { uploadedBy: STRANGER }),
    ).rejects.toThrow(/Not authorized/i);
    await expect(
      t.mutation(api.apkBuilds.generateUploadUrl, {
        uploadedBy: STRANGER,
      }),
    ).rejects.toThrow(/Not authorized/i);
  });

  test("an empty or unknown uploader is rejected too", async () => {
    await expect(
      t.mutation(api.apkBuilds.finalize, {
        platform: "android",
        version: "0.1.0",
        storageId: await t.run(async (ctx) =>
          ctx.storage.store(new Blob(["x"])),
        ),
        sha256: "a".repeat(64),
        uploadedBy: "  ",
      }),
    ).rejects.toThrow();
  });

  test("the allowlisted superadmin can publish and version/sha256 are validated", async () => {
    const buildId = await publish(t, {
      version: "0.2.0-beta",
      notes: "first beta",
    });
    expect(buildId).toBeTruthy();

    await expect(
      publish(t, { version: "   " }),
    ).rejects.toThrow(/version is required/i);
    await expect(
      publish(t, { sha256: "nothex" }),
    ).rejects.toThrow(/sha256/i);
  });

  test("latest returns metadata only, newest first, per platform", async () => {
    await publish(t, { version: "0.1.0" });
    await publish(t, { version: "0.2.0" });
    await publish(t, { platform: "ios", version: "9.9.9" });

    const latest = await t.query(api.apkBuilds.latest, {});
    expect(latest.android?.version).toBe("0.2.0");
    expect(latest.android?.sha256).toBe("a".repeat(64));
    expect(latest.ios?.version).toBe("9.9.9");

    // Metadata safe for a public panel: no storage ids leak.
    expect(JSON.stringify(latest)).not.toContain("storageId");
  });

  test("latest is null before anything is published", async () => {
    const latest = await t.query(api.apkBuilds.latest, {});
    expect(latest).toEqual({ android: null, ios: null });
  });

  test("latestForPlatform backs the public 302 with a storage URL", async () => {
    await publish(t, { version: "0.2.0" });

    const build = await t.query(internal.apkBuilds.latestForPlatform, {
      platform: "android",
    });
    expect(build?.version).toBe("0.2.0");
    expect(build?.url).toContain("http");

    expect(
      await t.query(internal.apkBuilds.latestForPlatform, {
        platform: "ios",
      }),
    ).toBeNull();
  });
});
