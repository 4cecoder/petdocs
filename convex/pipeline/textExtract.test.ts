/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import {
  FIXTURE_GARBAGE_PDF_BYTES,
  FIXTURE_VACCINE_TEXT,
  makeMinimalPdf,
} from "./fixtures";
import { extractDocumentText, naivePdfText } from "./textExtract";

const VACCINE_PDF = makeMinimalPdf(FIXTURE_VACCINE_TEXT.split("\n"));

describe("naivePdfText (PDF.js-free fallback)", () => {
  test("reads Tj operators out of an uncompressed content stream", async () => {
    const text = await naivePdfText(VACCINE_PDF);
    expect(text).toContain("Rabies Vaccination Certificate");
    expect(text).toContain("Pet name: Maple");
    expect(text).toContain("Next due: 03/14/2027");
  });

  test("returns empty string for garbage instead of throwing", async () => {
    const text = await naivePdfText(FIXTURE_GARBAGE_PDF_BYTES);
    expect(text).toBe("");
  });
});

describe("extractDocumentText", () => {
  test("unpdf (serverless PDF.js) extracts text from the fixture PDF", async () => {
    const { text, extractor } = await extractDocumentText(
      VACCINE_PDF,
      "application/pdf",
    );
    // Proves unpdf + its bundled PDF.js run under this runtime.
    expect(extractor).toBe("unpdf");
    expect(text).toContain("Rabies Vaccination Certificate");
    expect(text).toContain("Dr. Elena Ruiz, DVM");
  });

  test("images have no text layer -> empty text (OCR handles them)", async () => {
    const { text, extractor } = await extractDocumentText(
      new Uint8Array([1, 2, 3, 4]),
      "image/jpeg",
    );
    expect(text).toBe("");
    expect(extractor).toBe("none-image");
  });

  test("garbage PDF bytes degrade gracefully to empty text", async () => {
    const { text } = await extractDocumentText(
      FIXTURE_GARBAGE_PDF_BYTES,
      "application/pdf",
    );
    expect(text).toBe("");
  });

  test("plain text passthrough", async () => {
    const bytes = new TextEncoder().encode("hello vaccination world");
    const { text } = await extractDocumentText(bytes, "text/plain");
    expect(text).toBe("hello vaccination world");
  });
});
