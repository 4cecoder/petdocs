import { v } from "convex/values";
import { defineApp } from "convex/server";

/**
 * App-level deployment environment variables.
 *
 * OCR is optional: when OCR_API_URL (+ OCR_API_KEY) are configured the doc
 * pipeline can fall back to the remote OCR provider for scanned/image PDFs;
 * without them scanned documents land in the "needsOcr" status instead.
 * Set per deployment with: bunx convex env set OCR_API_URL ...
 */
export default defineApp({
  env: {
    OCR_API_URL: v.optional(v.string()),
    OCR_API_KEY: v.optional(v.string()),
  },
});
