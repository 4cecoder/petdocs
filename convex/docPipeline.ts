/**
 * Document processing pipeline (issue #23).
 *
 *   upload -> documents.create (status "uploaded")
 *          -> schedules internal.docPipeline.processDocument
 *          -> markProcessing -> fetch bytes -> extract text (unpdf, with
 *             naive fallback) -> [OCR if no text layer & provider
 *             configured] -> classify + fields -> complete (ready |
 *             needsReview | needsOcr) -> fail (failed + statusError)
 *
 * This file intentionally contains ONLY the action + internal mutations
 * that drive the status machine: actions run in a separate runtime from
 * queries/mutations, so the public owner-facing mutations live in
 * documents.ts and the admin mutation in docPipelineAdmin.ts.
 */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalMutation } from "./_generated/server";
import { classifyDocument } from "./pipeline/classify";
import { fetchSourceBytes } from "./pipeline/fetchSource";
import { resolveOcrProvider } from "./pipeline/ocr";
import { extractDocumentText } from "./pipeline/textExtract";
import {
  MAX_EXTRACTED_TEXT_CHARS,
  MIN_TEXT_LENGTH,
  REVIEW_THRESHOLD,
  type DocType,
  type ExtractedField,
} from "./pipeline/types";
import { extractedField } from "./schema";

const MAX_BYTES = 10 * 1024 * 1024; // mirrors documents.create MAX_BYTES

/** Marks a doc "processing" and returns what the action needs, or null. */
export const startProcessing = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.isTrash) return null;
    // Idempotency guard: only ever leave "uploaded".
    if (doc.status !== "uploaded") return null;
    const pet = await ctx.db.get(doc.petId);
    await ctx.db.patch(args.documentId, {
      status: "processing",
      statusError: undefined,
    });
    return {
      storageId: doc.storageId,
      mime: doc.mime,
      category: doc.category,
      petName: pet?.name,
    };
  },
});

/** Terminal success write: ready / needsReview / needsOcr. */
export const completeProcessing = internalMutation({
  args: {
    documentId: v.id("documents"),
    text: v.string(),
    ocrUsed: v.boolean(),
    kind: v.union(
      v.literal("classified"),
      v.literal("needsOcr"),
      v.literal("skippedPhoto"),
    ),
    type: v.optional(v.string()),
    confidence: v.optional(v.number()),
    fields: v.optional(v.array(extractedField)),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.isTrash) return;
    if (doc.status !== "processing") return;

    let status: "ready" | "needsReview" | "needsOcr" = "ready";
    let metadata = {
      type: (args.type ?? "other") as DocType,
      confidence: args.confidence ?? 0,
      fields: args.fields ?? ([] as ExtractedField[]),
      needsReview: false,
      ocrUsed: args.ocrUsed,
      processedAt: Date.now(),
    };

    if (args.kind === "needsOcr") {
      status = "needsOcr";
      metadata = {
        ...metadata,
        type: "other",
        confidence: 0,
        fields: [],
        needsReview: true,
      };
    } else if (args.kind === "classified") {
      const needsReview = (args.confidence ?? 0) < REVIEW_THRESHOLD;
      status = needsReview ? "needsReview" : "ready";
      metadata = { ...metadata, needsReview };
    } // skippedPhoto -> ready, no review

    await ctx.db.patch(args.documentId, {
      status,
      statusError: undefined,
      extractedText: args.text ? args.text.slice(0, MAX_EXTRACTED_TEXT_CHARS) : undefined,
      metadata,
    });
  },
});

/** Terminal failure write: failed + statusError. */
export const failProcessing = internalMutation({
  args: { documentId: v.id("documents"), error: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.isTrash) return;
    if (doc.status !== "processing") return;
    await ctx.db.patch(args.documentId, {
      status: "failed",
      statusError: args.error.slice(0, 500),
    });
  },
});

/**
 * Process one uploaded document. Internal-only; scheduled from
 * documents.create and re-run via reprocess/retry paths.
 *
 * `textOverride` is an internal-only test/ops seam: convex-test simulates
 * storage with fake URLs, so tests pass extracted text directly instead of
 * fetching bytes. Never exposed through the public API.
 */
export const processDocument = internalAction({
  args: {
    documentId: v.id("documents"),
    textOverride: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const info = await ctx.runMutation(internal.docPipeline.startProcessing, {
        documentId: args.documentId,
      });
      if (!info) return; // missing, trashed, or already being processed

      // Photos are user-labeled imagery: nothing to extract, stay "ready".
      if (info.category === "photo") {
        await ctx.runMutation(internal.docPipeline.completeProcessing, {
          documentId: args.documentId,
          text: "",
          ocrUsed: false,
          kind: "skippedPhoto" as const,
          type: "other",
          confidence: 1,
        });
        return;
      }

      let text = args.textOverride ?? "";
      let extractorId = "override";
      let bytes: Uint8Array | null = null;
      if (args.textOverride === undefined) {
        const url = await ctx.storage.getUrl(info.storageId);
        bytes = await fetchSourceBytes(url ?? "", MAX_BYTES);
        const extracted = await extractDocumentText(bytes, info.mime);
        text = extracted.text;
        extractorId = extracted.extractor;
      }
      if (text.length > MAX_EXTRACTED_TEXT_CHARS) {
        text = text.slice(0, MAX_EXTRACTED_TEXT_CHARS);
      }

      let ocrUsed = false;
      if (text.trim().length < MIN_TEXT_LENGTH) {
        const provider = resolveOcrProvider(env.OCR_API_URL, env.OCR_API_KEY);
        if (provider && bytes) {
          const ocrText = await provider.ocr(bytes, info.mime);
          ocrUsed = true;
          if (ocrText.trim().length >= MIN_TEXT_LENGTH) {
            text = ocrText.slice(0, MAX_EXTRACTED_TEXT_CHARS);
          } else {
            text = "";
          }
        } else {
          // No text layer (scanned PDF / image) and no OCR configured:
          // graceful "needsOcr" landing, flagged for review.
          await ctx.runMutation(internal.docPipeline.completeProcessing, {
            documentId: args.documentId,
            text: "",
            ocrUsed: false,
            kind: "needsOcr" as const,
          });
          return;
        }
      }

      const classification = classifyDocument(text, {
        knownPetNames: info.petName ? [info.petName] : [],
      });
      console.log(
        `docPipeline: ${args.documentId} via ${extractorId}${ocrUsed ? "+ocr" : ""} -> ${classification.type} @ ${classification.confidence}`,
      );
      await ctx.runMutation(internal.docPipeline.completeProcessing, {
        documentId: args.documentId,
        text,
        ocrUsed,
        kind: "classified" as const,
        type: classification.type,
        confidence: classification.confidence,
        fields: classification.fields,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`docPipeline: processing failed for ${args.documentId}: ${message}`);
      try {
        await ctx.runMutation(internal.docPipeline.failProcessing, {
          documentId: args.documentId,
          error: message,
        });
      } catch (failErr) {
        console.error(
          `docPipeline: could not record failure for ${args.documentId}: ${
            failErr instanceof Error ? failErr.message : String(failErr)
          }`,
        );
      }
    }
  },
});

/**
 * Retry sweep for documents stuck in "failed" (bounded batch; runs from the
 * cron tick or by hand). Re-arms them to "uploaded" and reschedules.
 */
export const retryFailed = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 25);
    const failed = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .take(limit);
    let scheduled = 0;
    for (const doc of failed) {
      if (doc.isTrash) continue;
      await ctx.db.patch(doc._id, {
        status: "uploaded",
        statusError: undefined,
      });
      await ctx.scheduler.runAfter(0, internal.docPipeline.processDocument, {
        documentId: doc._id,
      });
      scheduled++;
    }
    return { scheduled };
  },
});
