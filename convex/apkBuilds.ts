/**
 * Mobile build hosting (#42).
 *
 * App packages (APK today) live in Convex file storage with a small
 * `apkBuilds` row per build. Uploads are two-step, matching the existing
 * generateUploadUrl → POST → create pattern used by documents:
 *
 *   1. generateUploadUrl  — mutation, superadmin-only (convex/admin.ts
 *      allowlist), returns a one-time storage upload URL.
 *   2. finalize           — mutation, superadmin-only, records the build
 *      { platform, version, storageId, sha256, createdAt }.
 *
 * Reads:
 *   - latestForPlatform (internal) backs the public GET
 *     /api/builds/latest?platform=android 302 redirect in convex/http.ts.
 *   - latest (public query) powers the dashboard settings "Mobile apps"
 *     panel — safe metadata only (version/sha/date), never storage ids of
 *     other platforms' artifacts.
 *
 * The allowlist is resolved server-side from Convex env
 * (SUPERADMIN_EMAILS) — client-supplied emails are verified via
 * requireRole(ctx, …, "superadmin") (staff rows → bootstrap → allowlist →
 * legacy stored role), never trusted.
 */
import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireRole } from "./admin";

export const platformValidator = v.union(
  v.literal("android"),
  v.literal("ios"),
);

export const latestBuildMeta = v.object({
  platform: platformValidator,
  version: v.string(),
  sha256: v.string(),
  notes: v.optional(v.string()),
  createdAt: v.number(),
});

/** Step 1 of an admin upload: one-time storage upload URL. */
export const generateUploadUrl = mutation({
  args: { uploadedBy: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.uploadedBy, "superadmin");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Step 2 of an admin upload: record the published build. */
export const finalize = mutation({
  args: {
    platform: platformValidator,
    version: v.string(),
    storageId: v.id("_storage"),
    sha256: v.string(),
    notes: v.optional(v.string()),
    uploadedBy: v.string(),
  },
  returns: v.id("apkBuilds"),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.uploadedBy, "superadmin");
    const version = args.version.trim();
    if (!version) throw new Error("version is required");
    if (!/^[0-9a-f]{64}$/.test(args.sha256)) {
      throw new Error("sha256 must be a 64-char hex digest");
    }
    return await ctx.db.insert("apkBuilds", {
      platform: args.platform,
      version,
      storageId: args.storageId,
      sha256: args.sha256,
      ...(args.notes ? { notes: args.notes } : {}),
      uploadedBy: args.uploadedBy,
      createdAt: Date.now(),
    });
  },
});

/**
 * Latest build per platform for the settings "Mobile apps" panel. Safe
 * metadata only; downloads flow through /api/builds/latest.
 */
export const latest = query({
  args: {},
  returns: v.object({
    android: v.union(latestBuildMeta, v.null()),
    ios: v.union(latestBuildMeta, v.null()),
  }),
  handler: async (ctx) => {
    const pick = async (platform: "android" | "ios") => {
      const build = await ctx.db
        .query("apkBuilds")
        .withIndex("by_platform_and_createdAt", (q) =>
          q.eq("platform", platform),
        )
        .order("desc")
        .first();
      if (!build) return null;
      return {
        platform: build.platform,
        version: build.version,
        sha256: build.sha256,
        ...(build.notes ? { notes: build.notes } : {}),
        createdAt: build.createdAt,
      };
    };
    return { android: await pick("android"), ios: await pick("ios") };
  },
});

/** Backing query for GET /api/builds/latest (302 to the storage URL). */
export const latestForPlatform = internalQuery({
  args: { platform: platformValidator },
  returns: v.union(
    v.object({
      version: v.string(),
      url: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const build = await ctx.db
      .query("apkBuilds")
      .withIndex("by_platform_and_createdAt", (q) =>
        q.eq("platform", args.platform),
      )
      .order("desc")
      .first();
    if (!build) return null;
    const url = await ctx.storage.getUrl(build.storageId);
    if (!url) return null;
    return { version: build.version, url };
  },
});
