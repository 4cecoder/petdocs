/**
 * Text extraction for the doc pipeline.
 *
 * Primary path: unpdf (serverless build of PDF.js v5, designed for
 * workers-style runtimes — the same execution model as Convex actions).
 * If unpdf is unavailable or fails at runtime, we degrade to a PDF.js-free
 * naive extractor that inflates content streams (DecompressionStream) and
 * reads text-showing operators (Tj/TJ) directly. Both feed the same
 * TextExtractor seam so the pipeline logic never changes.
 */
import { MAX_EXTRACTED_TEXT_CHARS } from "./types";

export interface TextExtractor {
  readonly id: string;
  extract(bytes: Uint8Array, mime: string): Promise<string>;
}

/** Latin-1 is byte-preserving; safe for scanning PDF structure. */
function decodeLatin1(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

function unescapePdfString(raw: string): string {
  return raw
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) =>
      String.fromCharCode(parseInt(oct, 8)),
    )
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "")
    .replace(/\\f/g, "")
    .replace(/\\([()\\])/g, "$1");
}

function decodeHexString(raw: string): string {
  const hex = raw.replace(/[^0-9a-fA-F]/g, "");
  let out = "";
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  // Heuristic: UTF-16BE (pdf.js text with 2-byte glyphs) has lots of NULs.
  if (out.length > 1 && (out.match(/\x00/g) ?? []).length > out.length / 3) {
    const cleaned = out.replace(/\x00/g, "");
    return cleaned;
  }
  return out;
}

/** Pull text-showing operators (…)Tj, […]TJ, <…>Tj out of a stream body. */
function textFromContentStream(body: string): string {
  const parts: string[] = [];
  const tjRe = /\(((?:\\.|[^()\\])*)\)\s*Tj|<([0-9a-fA-F\s]+)>\s*Tj|\[((?:\\.|[^\]])*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(body)) !== null) {
    if (m[1] !== undefined) {
      parts.push(unescapePdfString(m[1]));
    } else if (m[2] !== undefined) {
      parts.push(decodeHexString(m[2]));
    } else if (m[3] !== undefined) {
      const inner = m[3];
      const strRe = /\(((?:\\.|[^()\\])*)\)|<([0-9a-fA-F\s]+)>/g;
      let s: RegExpExecArray | null;
      while ((s = strRe.exec(inner)) !== null) {
        parts.push(s[1] !== undefined ? unescapePdfString(s[1]) : decodeHexString(s[2]));
      }
    }
  }
  return parts.join("\n");
}

/**
 * PDF.js-free extraction: locate stream…endstream bodies, inflate
 * FlateDecode streams when DecompressionStream is available, then read
 * Tj/TJ operators. Works on simple/uncompressed PDFs; returns "" when
 * nothing legible is found (never throws).
 */
export async function naivePdfText(bytes: Uint8Array): Promise<string> {
  try {
    const latin1 = decodeLatin1(bytes);
    const chunks: string[] = [];
    const streamRe = /stream\r?\n/g;
    let m: RegExpExecArray | null;
    while ((m = streamRe.exec(latin1)) !== null) {
      const start = m.index + m[0].length;
      const end = latin1.indexOf("endstream", start);
      if (end === -1) break;
      streamRe.lastIndex = end;
      const bodyBytes = bytes.subarray(start, end);
      let body: string | null = null;
      if (typeof DecompressionStream !== "undefined" && bodyBytes.length > 2) {
        try {
          const ds = new DecompressionStream("deflate");
          const stream = new Blob([bodyBytes as BlobPart])
            .stream()
            .pipeThrough(ds);
          const inflated = await new Response(stream).arrayBuffer();
          body = decodeLatin1(new Uint8Array(inflated));
        } catch {
          body = null;
        }
      }
      if (body === null) {
        body = latin1.slice(start, end);
      }
      const text = textFromContentStream(body);
      if (text.trim()) chunks.push(text);
    }
    return chunks.join("\n").slice(0, MAX_EXTRACTED_TEXT_CHARS);
  } catch {
    return "";
  }
}

/** unpdf-based extractor; dynamic import so failure degrades gracefully. */
export const unpdfExtractor: TextExtractor = {
  id: "unpdf",
  async extract(bytes) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes.slice());
    // mergePages: true makes `text` a single string (TS-narrowed).
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text ?? "");
  },
};

/** Naive fallback extractor (see naivePdfText). */
export const naivePdfExtractor: TextExtractor = {
  id: "pdf-plain-scan",
  extract: (bytes) => naivePdfText(bytes),
};

/**
 * Dispatch by MIME type. Never throws: on total extraction failure it
 * returns "" and the pipeline treats the doc as needing OCR / review.
 * Images have no text layer -> "" (the OCR stage handles them).
 */
export async function extractDocumentText(
  bytes: Uint8Array,
  mime: string,
): Promise<{ text: string; extractor: string }> {
  const normalized = (mime ?? "").toLowerCase();
  try {
    if (normalized === "application/pdf" || normalized.endsWith("/pdf")) {
      try {
        const text = await unpdfExtractor.extract(bytes, normalized);
        return { text: (text ?? "").slice(0, MAX_EXTRACTED_TEXT_CHARS), extractor: "unpdf" };
      } catch (err) {
        console.warn(
          `docPipeline: unpdf extraction failed (${err instanceof Error ? err.message : String(err)}), falling back to plain-scan extractor`,
        );
        const text = await naivePdfExtractor.extract(bytes, normalized);
        return { text, extractor: "pdf-plain-scan" };
      }
    }
    if (normalized.startsWith("image/")) {
      return { text: "", extractor: "none-image" };
    }
    if (
      normalized.startsWith("text/") ||
      normalized === "application/json" ||
      normalized === "application/xml"
    ) {
      return { text: decodeUtf8(bytes).slice(0, MAX_EXTRACTED_TEXT_CHARS), extractor: "utf8" };
    }
    return { text: "", extractor: "none-unsupported" };
  } catch (err) {
    console.warn(
      `docPipeline: text extraction failed (${err instanceof Error ? err.message : String(err)})`,
    );
    return { text: "", extractor: "none-error" };
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
