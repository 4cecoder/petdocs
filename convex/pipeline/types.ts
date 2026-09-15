/**
 * Shared types for the document pipeline (upload -> text -> OCR -> classify).
 * Pure TypeScript: no Convex imports, so these run in the default runtime,
 * in tests, and are trivially unit-testable.
 */

export const DOC_TYPES = [
  "vaccination",
  "vet_visit",
  "medication",
  "lab",
  "other",
] as const;

export type DocType = (typeof DOC_TYPES)[number];

export interface ExtractedField {
  label: string;
  value: string;
}

export interface Classification {
  type: DocType;
  confidence: number;
  fields: ExtractedField[];
  needsReview: boolean;
}

export interface ClassifyOptions {
  /** Known pet names for this owner — used to guess which pet the doc is for. */
  knownPetNames?: string[];
}

/** Docs below this confidence land in needsReview. */
export const REVIEW_THRESHOLD = 0.6;

/** Extracted text shorter than this is treated as "no text layer found". */
export const MIN_TEXT_LENGTH = 24;

/** Cap on how much extracted text we persist on the document row. */
export const MAX_EXTRACTED_TEXT_CHARS = 100_000;
