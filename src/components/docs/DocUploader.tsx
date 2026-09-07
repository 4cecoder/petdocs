"use client";

import { useEffect, useRef, useState } from "react";
import { DOC_CATEGORIES, validateDocUpload } from "@/lib/validators";
import { api, getOwnerId, isBackendConfigured, uploadDoc, type Pet } from "@/lib/api";
import { FlowNav, WizardShell, useSteps } from "@/components/flow/Wizard";

const STEPS = ["Pet", "Capture", "Details", "Done"];
const CAPTURE_INDEX = 1;

/**
 * Camera-first uploader as a wizard: Pet (pick mode only) → Capture →
 * Details → Done. Validates locally, then POSTs bytes through `uploadDoc`
 * (generateUploadUrl → PUT → documents:create).
 */
export function DocUploader({
  petId,
  onComplete,
}: {
  petId: string;
  onComplete?: (fileName: string) => void;
}) {
  const needsPick = petId === "__pick__";
  const { step, next, back, go } = useSteps(STEPS.length, needsPick ? 0 : CAPTURE_INDEX);

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("vaccine_record");
  // TODO: picks up a notes field in the UI; uploadDoc has no notes param so this stays client-side only for now.
  const [notes, setNotes] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [pets, setPets] = useState<Pet[] | null>(null);
  const [petsLoading, setPetsLoading] = useState(false);
  const [petsError, setPetsError] = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId] = useState("");

  const ownerId = getOwnerId();
  const backend = isBackendConfigured;
  const effectivePetId = needsPick ? selectedPetId : petId;

  useEffect(() => {
    if (!needsPick) return;
    if (!ownerId || !backend) return;
    let cancelled = false;
    setPetsLoading(true);
    setPetsError(null);
    api.pets
      .list(ownerId)
      .then((rows) => {
        if (!cancelled) setPets(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setPetsError(e instanceof Error ? e.message : "Could not load pets.");
      })
      .finally(() => {
        if (!cancelled) setPetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsPick, ownerId, backend]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFiles(files: FileList | null) {
    setError(null);
    setStatus(null);
    const next_file = files?.[0];
    if (!next_file) return;
    const problem = validateDocUpload({ mime: next_file.type, size: next_file.size });
    if (problem) {
      setError(problem);
      return;
    }
    setFile(next_file);
    setSavedName(null);
    if (next_file.type.startsWith("image/")) {
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(next_file);
      });
    } else {
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    }
  }

  async function handleUpload() {
    setError(null);
    setStatus(null);
    if (!file) {
      setError("Choose a photo or PDF first.");
      return;
    }
    const problem = validateDocUpload({ mime: file.type, size: file.size });
    if (problem) {
      setError(problem);
      return;
    }
    const resolvedOwner = getOwnerId();
    if (!resolvedOwner || !isBackendConfigured) {
      setError("Sign in to save to the vault.");
      return;
    }
    if (!effectivePetId) {
      setError("Choose a pet first.");
      go(0);
      return;
    }
    setUploading(true);
    try {
      await uploadDoc({
        ownerId: resolvedOwner,
        petId: effectivePetId,
        file,
        category,
        uploadedBy: resolvedOwner,
      });
      setStatus(`Saved ${file.name} to the vault.`);
      setSavedName(file.name);
      onComplete?.(file.name);
      go(3);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed — try again");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function resetToCapture() {
    setError(null);
    setStatus(null);
    setSavedName(null);
    setFile(null);
    setNotes("");
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
    go(CAPTURE_INDEX);
  }

  function handleGo(n: number) {
    if (!needsPick && n === 0) return;
    if (n === 2 && !file) return;
    if (n === 3 && !savedName) return;
    go(n);
  }

  function handleBack() {
    if (step === CAPTURE_INDEX && !needsPick) return;
    back();
  }

  const message =
    error ?? status ?? "PDF or photo, up to 10MB. Saved to this pet's vault.";
  const canLeaveCapture = file !== null;

  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      {step === 0 && needsPick ? (
        <WizardShell
          steps={STEPS}
          current={step}
          onGo={handleGo}
          art="box"
          title="Which pet?"
          subtitle="Choose a vault for this document."
        >
          <div className="flex flex-col gap-3">
            {petsLoading ? (
              <p role="status" aria-live="polite" className="text-sm text-ink-soft">
                Loading pets…
              </p>
            ) : null}
            {petsError ? (
              <p role="alert" className="text-sm font-medium text-red-600">
                {petsError}
              </p>
            ) : null}
            {!ownerId || !backend ? (
              <p role="status" aria-live="polite" className="text-sm text-ink-soft">
                Sign in to save to the vault.
              </p>
            ) : (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Pet
                <select
                  value={selectedPetId}
                  onChange={(e) => setSelectedPetId(e.target.value)}
                  className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3"
                >
                  <option value="">Select a pet…</option>
                  {(pets ?? []).map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} · {p.species}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="mt-4">
            <FlowNav
              hideBack
              onNext={next}
              nextLabel="Continue"
              nextDisabled={!selectedPetId}
            />
          </div>
        </WizardShell>
      ) : null}

      {step === 1 ? (
        <WizardShell
          steps={STEPS}
          current={step}
          onGo={handleGo}
          art="camera"
          title="Snap or upload"
          subtitle="PDF or photo, up to 10MB."
        >
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="min-h-[48px] flex-1 rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "📷 Take photo / upload"}
            </button>
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
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Document preview"
                className="max-h-64 rounded-xl border border-ink/10 object-contain"
              />
            ) : null}
            {file && !preview ? (
              <p className="truncate text-sm text-ink-soft">📄 {file.name}</p>
            ) : null}
            <p
              role="status"
              aria-live="polite"
              className={
                error ? "text-sm font-medium text-red-600" : "text-sm text-ink-soft"
              }
            >
              {message}
            </p>
          </div>
          <div className="mt-4">
            <FlowNav
              hideBack={!needsPick}
              onBack={handleBack}
              onNext={next}
              nextLabel="Continue"
              nextDisabled={!canLeaveCapture}
            />
          </div>
        </WizardShell>
      ) : null}

      {step === 2 ? (
        <WizardShell
          steps={STEPS}
          current={step}
          onGo={handleGo}
          art="box"
          title="Document details"
          subtitle="Tell us what this is."
        >
          <div className="flex flex-col gap-3">
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
            <label className="flex flex-col gap-1 text-sm font-medium">
              Notes <span className="font-normal text-ink-soft">(optional)</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={uploading}
                placeholder="e.g. Annual checkup at Riverside"
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3"
              />
            </label>
            {file ? (
              <p className="truncate text-sm text-ink-soft">📎 {file.name}</p>
            ) : null}
            <p
              role="status"
              aria-live="polite"
              className={
                error ? "text-sm font-medium text-red-600" : "text-sm text-ink-soft"
              }
            >
              {message}
            </p>
          </div>
          <div className="mt-4">
            <FlowNav
              onBack={handleBack}
              onNext={() => void handleUpload()}
              nextLabel={uploading ? "Uploading…" : "Save to vault"}
              loading={uploading}
            />
          </div>
        </WizardShell>
      ) : null}

      {step === 3 ? (
        <WizardShell
          steps={STEPS}
          current={step}
          onGo={handleGo}
          art="happy"
          title="Saved to the vault"
          subtitle={savedName ? `🎉 ${savedName}` : undefined}
        >
          <p
            role="status"
            aria-live="polite"
            className={
              error ? "text-sm font-medium text-red-600" : "text-sm text-ink-soft"
            }
          >
            {message}
          </p>
          <div className="mt-4">
            <FlowNav hideBack onNext={resetToCapture} nextLabel="Add another" />
          </div>
        </WizardShell>
      ) : null}
    </div>
  );
}
