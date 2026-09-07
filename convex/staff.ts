/**
 * Separate staff table for Angela's employees.
 *
 * Pet owners (owners table) stay separate from staff. Staff powers come
 * only from an active staff row, checked first in admin requireRole.
 * Least privilege: auditor < support < manager < owner.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole, staffRoleValidator } from "./admin";
import type { StaffRole } from "./admin";

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

/** Staff role for UI gating. Active staff row wins, else bootstrap owner, else null. */
export const myStaffRole = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = normalizeEmail(args.email);
    const row = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (row) {
      return { role: row.role as StaffRole, active: row.active };
    }
    if (isBootstrapAdmin(normalized)) {
      return { role: "owner" as StaffRole, active: true };
    }
    return null;
  },
});

/** Invite or reactivate staff. Owner only. Audited. */
export const inviteStaff = mutation({
  args: {
    adminEmail: v.string(),
    email: v.string(),
    name: v.string(),
    role: staffRoleValidator,
  },
  handler: async (ctx, args) => {
    const { owner: actor } = await requireRole(ctx, args.adminEmail, "owner");
    const normalized = normalizeEmail(args.email);
    const name = args.name.trim();
    if (!normalized) throw new Error("Email is required");
    if (!name) throw new Error("Name is required");
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        role: args.role,
        active: true,
      });
      await writeAudit(
        ctx,
        actor._id,
        `inviteStaff ${args.role}`,
        `staff:${normalized}`,
      );
      return existing._id;
    }
    const staffId = await ctx.db.insert("staff", {
      email: normalized,
      name,
      role: args.role,
      active: true,
      invitedBy: normalizeEmail(args.adminEmail),
      createdAt: Date.now(),
    });
    await writeAudit(
      ctx,
      actor._id,
      `inviteStaff ${args.role}`,
      `staff:${normalized}`,
    );
    return staffId;
  },
});

/** Change a staff role. Owner only. Audited. Refuses to demote the last owner. */
export const setStaffRole = mutation({
  args: {
    adminEmail: v.string(),
    targetEmail: v.string(),
    role: staffRoleValidator,
  },
  handler: async (ctx, args) => {
    const { owner: actor } = await requireRole(ctx, args.adminEmail, "owner");
    const normalized = normalizeEmail(args.targetEmail);
    const target = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (!target) throw new Error("Staff not found");
    if (target.active && target.role === "owner" && args.role !== "owner") {
      const all = await ctx.db.query("staff").collect();
      const activeOwners = all.filter((s) => s.active && s.role === "owner");
      if (activeOwners.length <= 1) {
        throw new Error("Cannot demote the last owner");
      }
    }
    await ctx.db.patch(target._id, { role: args.role });
    await writeAudit(
      ctx,
      actor._id,
      `setStaffRole ${args.role}`,
      `staff:${normalized}`,
    );
    return target._id;
  },
});

/** Deactivate staff. Owner only. Audited. Cannot deactivate self or last owner. */
export const deactivateStaff = mutation({
  args: {
    adminEmail: v.string(),
    targetEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { owner: actor } = await requireRole(ctx, args.adminEmail, "owner");
    const adminNormalized = normalizeEmail(args.adminEmail);
    const normalized = normalizeEmail(args.targetEmail);
    if (adminNormalized === normalized) {
      throw new Error("Cannot deactivate yourself");
    }
    const target = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (!target) throw new Error("Staff not found");
    if (target.active && target.role === "owner") {
      const all = await ctx.db.query("staff").collect();
      const activeOwners = all.filter((s) => s.active && s.role === "owner");
      if (activeOwners.length <= 1) {
        throw new Error("Cannot deactivate the last owner");
      }
    }
    await ctx.db.patch(target._id, { active: false });
    await writeAudit(ctx, actor._id, "deactivateStaff", `staff:${normalized}`);
    return target._id;
  },
});

/** List staff. Owner plus manager view. Safe projection only, no secrets. */
export const listStaff = query({
  args: { adminEmail: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.adminEmail, "manager");
    const all = await ctx.db.query("staff").collect();
    return all
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        _id: s._id,
        email: s.email,
        name: s.name,
        role: s.role as StaffRole,
        active: s.active,
        createdAt: s.createdAt,
      }));
  },
});
