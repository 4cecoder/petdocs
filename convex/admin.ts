/**
 * Minimal-MVP superadmin + RBAC for internal product management.
 *
 * Server-only (never import from src/). Every query/mutation takes
 * { adminEmail } and verifies server-side. Never trust client role.
 *
 * Staff roles (staff table, least privilege):
 * auditor (stats + audit read only) < support (stats, owners, links,
 * revoke, claims, audit) < manager (all support powers plus setRole
 * on owners plus claim review, no staff ops, no pet lock) < owner
 * (everything including staff manage).
 * Legacy owners table roles (owner < support < admin) still resolve
 * when no active staff row exists. Legacy admin maps to owner rank.
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

export const staffRoleValidator = v.union(
  v.literal("owner"),
  v.literal("manager"),
  v.literal("support"),
  v.literal("auditor"),
);

export type StaffRole = "owner" | "manager" | "support" | "auditor";
export type LegacyRole = "owner" | "support" | "admin";
export type Role = StaffRole | LegacyRole;

export const RANK: Record<Role, number> = {
  auditor: 1,
  support: 2,
  manager: 3,
  owner: 4,
  admin: 4,
};

const LEGACY_RANK: Record<LegacyRole, number> = {
  owner: 0,
  support: 2,
  admin: 4,
};

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
export async function requireRole(ctx: any, email: string, minRole: Role) {
  const normalized = normalizeEmail(email);
  const minRank = RANK[minRole];
  if (minRank === undefined) throw new Error("Not authorized");
  // Staff first: an active staff row decides the role.
  const staff = await ctx.db
    .query("staff")
    .withIndex("by_email", (q: any) => q.eq("email", normalized))
    .first();
  if (staff && staff.active) {
    const staffRole = staff.role as StaffRole;
    const rank = RANK[staffRole];
    if (rank === undefined) throw new Error("Not authorized");
    if (rank < minRank) throw new Error("Not authorized");
    const owner = await ctx.db
      .query("owners")
      .withIndex("by_email", (q: any) => q.eq("email", normalized))
      .first();
    if (!owner) throw new Error("Not authorized");
    return { owner, role: staffRole as Role, staff };
  }
  // No active staff: fall back to owners row plus bootstrap.
  const owner = await ctx.db
    .query("owners")
    .withIndex("by_email", (q: any) => q.eq("email", normalized))
    .first();
  if (!owner) throw new Error("Not authorized");
  if (isBootstrapAdmin(normalized)) {
    if (RANK["admin"] < minRank) throw new Error("Not authorized");
    return { owner, role: "admin" as Role };
  }
  const stored = (owner.role as LegacyRole | undefined) ?? "owner";
  const rank = LEGACY_RANK[stored] ?? 0;
  if (rank < minRank) throw new Error("Not authorized");
  return { owner, role: stored as Role };
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

/** Counts for the admin overview. Auditor and above. */
export const stats = query({
  args: { adminEmail: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "auditor");
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

/** Set an owner role. Owner and manager. Audited. */
export const setRole = mutation({
  args: {
    adminEmail: v.string(),
    targetOwnerId: v.id("owners"),
    role: adminRole,
  },
  handler: async (ctx, args) => {
    const { owner: actor } = await requireRole(ctx, args.adminEmail, "manager");
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

/** Recent audit entries, newest first. Auditor and above. */
export const auditLog = query({
  args: { adminEmail: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "auditor");
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
