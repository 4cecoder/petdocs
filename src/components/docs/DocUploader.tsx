"use client";

import { useRef, useState } from "react";
import { DOC_CATEGORIES, validateDocUpload } from "@/lib/validators";
import { getOwnerId, isBackendConfigured, uploadDoc } from "@/lib/api";

/**
 * Camera-first uploader: validates locally, then POSTs bytes through
 * `uploadDoc` (generateUploadUrl → PUT → documents:create).
 */
export function DocUploader({
  petId,
  onComplete,
}: {
  petId: string;
  onComplete?: (fileName: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("vaccine_record");
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    setError(null);
    setStatus(null);
    const file = files?.[0];
    if (!file) return;
    const problem = validateDocUpload({ mime: file.type, size: file.size });
    if (problem) {
      setError(problem);
      return;
    }
    if (file.type.startsWith("image/")) {
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });
    } else {
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    }

    const ownerId = getOwnerId();
    if (!ownerId || !isBackendConfigured) {
      setError("Sign in to save to the vault.");
      return;
    }

    setUploading(true);
    try {
      await uploadDoc({
        ownerId,
        petId,
        file,
        category,
        uploadedBy: ownerId,
      });
      setStatus(`Saved ${file.name} to the vault.`);
      onComplete?.(file.name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed — try again");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const message = error ?? status ?? "PDF or photo, up to 10MB. Saved to this pet's vault.";

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="min-h-[48px] flex-1 rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "📷 Take photo / upload"}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          // `capture` hints mobile browsers to open the camera first.
          capture="environment"
          className="hidden"
          aria-label="Upload a pet document"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Document type
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={uploading}
            className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3"
          >
            {DOC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Document preview"
            className="max-h-64 rounded-xl border border-ink/10 object-contain"
          />
        ) : null}
        <p
          role="status"
          aria-live="polite"
          className={
            error
              ? "text-sm font-medium text-red-600"
              : "text-sm text-ink-soft"
          }
        >
          {message}
        </p>
      </div>
    </div>
  );
}
