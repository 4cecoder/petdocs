import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  docPipelineType,
  extractedField,
} from "./schema";

const docCategory = v.union(
  v.literal("vaccine_record"),
  v.literal("lab_result"),
  v.literal("prescription"),
  v.literal("insurance"),
  v.literal("microchip"),
  v.literal("travel_certificate"),
  v.literal("photo"),
  v.literal("other"),
);

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

const MAX_BYTES = 10 * 1024 * 1024;

async function assertOwnsPet(ctx: any, ownerId: any, petId: any) {
  const pet = await ctx.db.get(petId);
  if (!pet || pet.ownerId !== ownerId) throw new Error("Pet not found");
  return pet;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    name: v.string(),
    storageId: v.id("_storage"),
    mime: v.string(),
    size: v.number(),
    category: v.optional(docCategory),
    notes: v.optional(v.string()),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOwnsPet(ctx, args.ownerId, args.petId);
    if (!ALLOWED_MIME.includes(args.mime)) {
      throw new Error(`Unsupported file type: ${args.mime}`);
    }
    if (args.size <= 0 || args.size > MAX_BYTES) {
      throw new Error("File must be non-empty and under 10MB");
    }
    const documentId = await ctx.db.insert("documents", {
      ownerId: args.ownerId,
      petId: args.petId,
      name: args.name,
      storageId: args.storageId,
      mime: args.mime,
      size: args.size,
      category: args.category,
      notes: args.notes,
      uploadedBy: args.uploadedBy,
      status: "uploaded",
      createdAt: Date.now(),
    });
    // Kick off the extraction/OCR/classification pipeline (issue #23).
    await ctx.scheduler.runAfter(0, internal.docPipeline.processDocument, {
      documentId,
    });
    return documentId;
  },
});

/**
 * Owner-facing retry: re-arm a failed/needsOcr/needsReview document and
 * re-run the pipeline. Refuses while a run is already in flight.
 */
export const reprocess = mutation({
  args: {
    ownerId: v.id("owners"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== args.ownerId || doc.isTrash) {
      throw new Error("Document not found");
    }
    if (doc.status === "processing" || doc.status === "uploaded") {
      throw new Error("Document is already being processed");
    }
    await ctx.db.patch(args.documentId, {
      status: "uploaded",
      statusError: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.docPipeline.processDocument, {
      documentId: args.documentId,
    });
    return args.documentId;
  },
});

/**
 * Review-drawer submit: the owner confirms/edits the extracted fields and
 * type. Their confirmation counts as ground truth (confidence 1).
 */
export const reviewSubmit = mutation({
  args: {
    ownerId: v.id("owners"),
    documentId: v.id("documents"),
    type: docPipelineType,
    fields: v.array(extractedField),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== args.ownerId || doc.isTrash) {
      throw new Error("Document not found");
    }
    if (doc.status === "processing") {
      throw new Error("Document is still being processed");
    }
    const cleanFields = args.fields
      .filter((f) => f.label.trim() && f.value.trim())
      .slice(0, 16)
      .map((f) => ({
        label: f.label.trim().slice(0, 80),
        value: f.value.trim().slice(0, 500),
      }));
    await ctx.db.patch(args.documentId, {
      status: "ready",
      statusError: undefined,
      metadata: {
        type: args.type,
        confidence: 1,
        fields: cleanFields,
        needsReview: false,
        ocrUsed: doc.metadata?.ocrUsed,
        processedAt: Date.now(),
      },
    });
    return args.documentId;
  },
});

/** Current pipeline status of one document (for drawers/retry UI). */
export const getStatus = query({
  args: { ownerId: v.id("owners"), documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== args.ownerId || doc.isTrash) return null;
    return {
      status: doc.status,
      statusError: doc.statusError,
      metadata: doc.metadata,
    };
  },
});

export const listByPet = query({
  args: {
    ownerId: v.id("owners"),
    petId: v.id("pets"),
    category: v.optional(docCategory),
  },
  handler: async (ctx, args) => {
    await assertOwnsPet(ctx, args.ownerId, args.petId);
    const docs = args.category
      ? await ctx.db
          .query("documents")
          .withIndex("by_petId_and_category", (q) =>
            q.eq("petId", args.petId).eq("category", args.category!),
          )
          .order("desc")
          .collect()
      : await ctx.db
          .query("documents")
          .withIndex("by_petId", (q) => q.eq("petId", args.petId))
          .order("desc")
          .collect();
    return docs.filter((d) => !d.isTrash);
  },
});

export const getUrl = query({
  args: { ownerId: v.id("owners"), documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== args.ownerId || doc.isTrash) return null;
    return await ctx.storage.getUrl(doc.storageId);
  },
});

export const rename = mutation({
  args: {
    ownerId: v.id("owners"),
    documentId: v.id("documents"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== args.ownerId) throw new Error("Document not found");
    const name = args.name.trim();
    if (!name) throw new Error("Name cannot be empty");
    await ctx.db.patch(args.documentId, { name });
    return args.documentId;
  },
});

export const toggleFavorite = mutation({
  args: { ownerId: v.id("owners"), documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== args.ownerId) throw new Error("Document not found");
    const next = !doc.isFavorite;
    await ctx.db.patch(args.documentId, { isFavorite: next });
    return next;
  },
});

export const moveToTrash = mutation({
  args: { ownerId: v.id("owners"), documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== args.ownerId) throw new Error("Document not found");
    await ctx.db.patch(args.documentId, { isTrash: true, deletedAt: Date.now() });
    return args.documentId;
  },
});

export const restoreFromTrash = mutation({
  args: { ownerId: v.id("owners"), documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== args.ownerId) throw new Error("Document not found");
    await ctx.db.patch(args.documentId, { isTrash: false, deletedAt: undefined });
    return args.documentId;
  },
});

export const emptyTrash = mutation({
  args: { ownerId: v.id("owners") },
  handler: async (ctx, args) => {
    const trashed = await ctx.db
      .query("documents")
      .withIndex("by_isTrash", (q) => q.eq("isTrash", true))
      .collect();
    let count = 0;
    for (const doc of trashed) {
      if (doc.ownerId !== args.ownerId) continue;
      try {
        await ctx.storage.delete(doc.storageId);
      } catch {
        /* already gone */
      }
      await ctx.db.delete(doc._id);
      count++;
    }
    return count;
  },
});
