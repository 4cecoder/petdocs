/**
 * Minimal-MVP superadmin + RBAC for internal product management.
 *
 * Server-only (never import from src/). Every query/mutation takes
 * { adminEmail } and verifies server-side. Never trust client role.
 *
 * Roles: owner < support < admin.
 * Bootstrap: Convex env ADMIN_EMAILS (comma-separated) counts as admin
 * even when the owner row role is unset.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const adminRole = v.union(
  v.literal("owner"),
  v.literal("support"),
  v.literal("admin"),
);

type Role = "owner" | "support" | "admin";

const RANK: Record<Role, number> = { owner: 0, support: 1, admin: 2 };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function bootstrapEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function isBootstrapAdmin(email: string): boolean {
  return bootstrapEmails().includes(normalizeEmail(email));
}

function effectiveRole(
  stored: Role | undefined,
  email: string,
): Role {
  if (isBootstrapAdmin(email)) return "admin";
  return stored ?? "owner";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireRole(ctx: any, email: string, minRole: Role) {
  const normalized = normalizeEmail(email);
  const owner = await ctx.db
    .query("owners")
    .withIndex("by_email", (q: any) => q.eq("email", normalized))
    .first();
  if (!owner) throw new Error("Not authorized");
  const role = effectiveRole(
    (owner.role as Role | undefined) ?? undefined,
    normalized,
  );
  if (RANK[role] < RANK[minRole]) throw new Error("Not authorized");
  return { owner, role };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeAudit(
  ctx: any,
  actorOwnerId: string,
  action: string,
  target?: string,
) {
  await ctx.db.insert("adminAudit", {
    actorOwnerId,
    action,
    ...(target ? { target } : {}),
    createdAt: Date.now(),
  });
}

/** Owner row or null. Client reads `role` to gate. Bootstrap resolves to admin. */
export const getMe = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = normalizeEmail(args.email);
    const owner = await ctx.db
      .query("owners")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (!owner) return null;
    return {
      _id: owner._id,
      email: owner.email,
      name: owner.name,
      role: effectiveRole(
        (owner.role as Role | undefined) ?? undefined,
        normalized,
      ),
      createdAt: owner.createdAt,
    };
  },
});

/** Counts for the admin overview. Admin + support. */
export const stats = query({
  args: { adminEmail: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "support");
    const [owners, pets, documents, links, reminders] = await Promise.all([
      ctx.db.query("owners").collect(),
      ctx.db.query("pets").collect(),
      ctx.db.query("documents").collect(),
      ctx.db.query("shareLinks").collect(),
      ctx.db.query("reminders").collect(),
    ]);
    return {
      owners: owners.length,
      pets: pets.length,
      documents: documents.length,
      activeLinks: links.filter((l: { isActive: boolean }) => l.isActive)
        .length,
      remindersScheduled: reminders.filter(
        (r: { status: string }) => r.status === "scheduled",
      ).length,
    };
  },
});

/** Recent owners. Safe projection only, no secrets. Admin + support. */
export const recentOwners = query({
  args: { adminEmail: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "support");
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const all = await ctx.db.query("owners").collect();
    return all
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((o) => ({
        _id: o._id,
        email: o.email,
        name: o.name,
        role: effectiveRole(
          (o.role as Role | undefined) ?? undefined,
          o.email,
        ),
        createdAt: o.createdAt,
      }));
  },
});

/** Recent share links, active first. Admin + support. Token never returned. */
export const listLinks = query({
  args: { adminEmail: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "support");
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const all = await ctx.db.query("shareLinks").collect();
    const sorted = all.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
    const page = sorted.slice(0, limit);
    return await Promise.all(
      page.map(async (l) => {
        const [owner, pet] = await Promise.all([
          ctx.db.get(l.ownerId),
          ctx.db.get(l.petId),
        ]);
        return {
          _id: l._id,
          petId: l.petId,
          ownerId: l.ownerId,
          scope: l.scope,
          label: l.label,
          isActive: l.isActive,
          viewCount: l.viewCount,
          createdAt: l.createdAt,
          expiresAt: l.expiresAt,
          ownerEmail: owner?.email ?? null,
          petName: pet?.name ?? null,
        };
      }),
    );
  },
});

/** Set an owner role. Admin only. Audited. */
export const setRole = mutation({
  args: {
    adminEmail: v.string(),
    targetOwnerId: v.id("owners"),
    role: adminRole,
  },
  handler: async (ctx, args) => {
    const { owner: actor } = await requireRole(ctx, args.adminEmail, "admin");
    const target = await ctx.db.get(args.targetOwnerId);
    if (!target) throw new Error("Owner not found");
    await ctx.db.patch(target._id, { role: args.role });
    await writeAudit(
      ctx,
      actor._id,
      `setRole ${args.role}`,
      `owner:${target._id}`,
    );
    return target._id;
  },
});

/** Revoke any share link. Support + admin. Mirrors shareLinks:revoke. Audited. */
export const revokeAnyLink = mutation({
  args: { adminEmail: v.string(), linkId: v.id("shareLinks") },
  handler: async (ctx, args) => {
    const { owner: actor } = await requireRole(
      ctx,
      args.adminEmail,
      "support",
    );
    const link = await ctx.db.get(args.linkId);
    if (!link) throw new Error("Link not found");
    await ctx.db.patch(args.linkId, { isActive: false, revokedAt: Date.now() });
    await writeAudit(ctx, actor._id, "revokeLink", `link:${link._id}`);
    return args.linkId;
  },
});

/** Lock or unlock a pet. Admin only. Audited. */
export const lockPet = mutation({
  args: {
    adminEmail: v.string(),
    petId: v.id("pets"),
    locked: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { owner: actor } = await requireRole(ctx, args.adminEmail, "admin");
    const pet = await ctx.db.get(args.petId);
    if (!pet) throw new Error("Pet not found");
    await ctx.db.patch(args.petId, { locked: args.locked });
    await writeAudit(
      ctx,
      actor._id,
      args.locked ? "lockPet" : "unlockPet",
      `pet:${pet._id}`,
    );
    return args.petId;
  },
});

/** Recent audit entries, newest first. Admin + support. */
export const auditLog = query({
  args: { adminEmail: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "support");
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const rows = await ctx.db.query("adminAudit").order("desc").take(limit);
    return await Promise.all(
      rows.map(async (r) => {
        const actor = await ctx.db.get(r.actorOwnerId);
        return {
          _id: r._id,
          actorOwnerId: r.actorOwnerId,
          actorEmail: actor?.email ?? null,
          action: r.action,
          target: r.target,
          createdAt: r.createdAt,
        };
      }),
    );
  },
});
