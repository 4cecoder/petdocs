export const PET_SPECIES = [
  "dog",
  "cat",
  "bird",
  "rabbit",
  "reptile",
  "other",
] as const;

export type PetSpecies = (typeof PET_SPECIES)[number];

export const DOC_CATEGORIES = [
  "vaccine_record",
  "lab_result",
  "prescription",
  "insurance",
  "microchip",
  "travel_certificate",
  "photo",
  "other",
] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

/** MIME types the vault accepts (mirrors convex/documents.ts + Android). */
export const ALLOWED_DOC_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_DOCS_PER_PET = 100;

export function isAllowedDocMime(mime: string): boolean {
  return (ALLOWED_DOC_MIME as readonly string[]).includes(mime);
}

export function validateDocUpload(input: { mime: string; size: number }): string | null {
  if (!isAllowedDocMime(input.mime)) {
    return `Unsupported file type: ${input.mime}. Use PDF or a photo (JPG/PNG/WebP/HEIC).`;
  }
  if (input.size <= 0) return "File is empty.";
  if (input.size > MAX_DOC_BYTES) {
    return `File is too large (${Math.round(input.size / 1024 / 1024)}MB). Max is 10MB.`;
  }
  return null;
}

export function validatePetName(name: string): string | null {
  if (!name.trim()) return "Pet name is required.";
  if (name.trim().length > 60) return "Pet name must be under 60 characters.";
  return null;
}
