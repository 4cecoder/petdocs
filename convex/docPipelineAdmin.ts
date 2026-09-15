/**
 * Admin endpoint for the doc pipeline: re-run processing on a document.
 * Guarded by the staff RBAC from admin.ts (support rank and up), writes an
 * adminAudit row like the rest of the admin surface.
 */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import { requireRole } from "./admin";

export const adminReprocessDocument = mutation({
  args: {
    adminEmail: v.string(),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const { owner } = await requireRole(ctx, args.adminEmail, "support");
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await ctx.db.patch(args.documentId, {
      status: "uploaded",
      statusError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.docPipeline.processDocument, {
      documentId: args.documentId,
    });
    await ctx.db.insert("adminAudit", {
      actorOwnerId: owner._id,
      action: "doc_pipeline.reprocess",
      target: args.documentId,
      createdAt: Date.now(),
    });
    return args.documentId;
  },
});
