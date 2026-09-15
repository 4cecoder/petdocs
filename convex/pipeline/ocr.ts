/**
 * Pluggable OCR provider for scanned/image documents.
 *
 * Default deployment: no provider configured (OCR_API_URL absent) -> the
 * pipeline marks scanned docs as "needsOcr" instead of calling anything.
 * When env vars are present we use the generic HTTP provider: multipart
 * POST of the file to OCR_API_URL with an optional Bearer OCR_API_KEY,
 * expecting a JSON response containing the recognized text.
 */

export interface OcrProvider {
  readonly id: string;
  ocr(bytes: Uint8Array, mime: string): Promise<string>;
}

interface OcrResponseLike {
  text?: unknown;
  pages?: unknown;
  result?: unknown;
}

function textFromResponse(data: unknown): string {
  if (typeof data === "string") return data;
  const obj = (data ?? {}) as OcrResponseLike;
  if (typeof obj.text === "string") return obj.text;
  if (Array.isArray(obj.text)) {
    return obj.text.filter((p): p is string => typeof p === "string").join("\n");
  }
  if (Array.isArray(obj.pages)) {
    return obj.pages.filter((p): p is string => typeof p === "string").join("\n");
  }
  if (typeof obj.result === "string") return obj.result;
  throw new Error("OCR provider returned an unrecognized response shape");
}

export function httpOcrProvider(baseUrl: string, apiKey?: string): OcrProvider {
  return {
    id: "http",
    async ocr(bytes, mime) {
      const form = new FormData();
      form.append(
        "file",
        new Blob([bytes as BlobPart], { type: mime || "application/octet-stream" }),
        "document",
      );
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        body: form,
      });
      if (!res.ok) {
        throw new Error(`OCR provider failed: HTTP ${res.status}`);
      }
      const data: unknown = await res.json();
      return textFromResponse(data);
    },
  };
}

/** Returns null when OCR is not configured (graceful "needsOcr" flow). */
export function resolveOcrProvider(
  apiUrl: string | undefined,
  apiKey: string | undefined,
): OcrProvider | null {
  const url = apiUrl?.trim();
  if (!url) return null;
  return httpOcrProvider(url, apiKey?.trim() || undefined);
}
