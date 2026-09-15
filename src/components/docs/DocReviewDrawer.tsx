"use client";

import { useEffect, useState } from "react";
import { RotateCw, Save, X } from "lucide-react";
import {
  type DocPipelineMetadata,
  type ExtractedFieldRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { StatusChip } from "./DocList";
import type { DocPipelineStatus } from "@/lib/api";

const DOC_TYPES = [
  { value: "vaccination", label: "Vaccination" },
  { value: "vet_visit", label: "Vet visit" },
  { value: "medication", label: "Medication" },
  { value: "lab", label: "Lab result" },
  { value: "other", label: "Other" },
] as const;

export interface DocReviewTarget {
  documentId: string;
  name: string;
  status?: DocPipelineStatus;
  statusError?: string;
  metadata?: DocPipelineMetadata;
}

/**
 * Minimal review drawer: confirm/edit the pipeline's extracted type and
 * fields. Confirm marks the doc "ready" with the corrected ground truth;
 * Retry re-runs the pipeline (failed/needsOcr docs).
 */
export function DocReviewDrawer({
  target,
  onClose,
  onSubmit,
  onRetry,
}: {
  target: DocReviewTarget;
  onClose: () => void;
  onSubmit: (input: {
    documentId: string;
    type: (typeof DOC_TYPES)[number]["value"];
    fields: ExtractedFieldRow[];
  }) => Promise<void>;
  onRetry?: (documentId: string) => Promise<void>;
}) {
  const [type, setType] = useState<string>(target.metadata?.type ?? "other");
  const [fields, setFields] = useState<ExtractedFieldRow[]>(
    target.metadata?.fields?.length
      ? target.metadata.fields.map((f) => ({ ...f }))
      : [{ label: "", value: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local edits whenever a different doc is opened.
  useEffect(() => {
    setType(target.metadata?.type ?? "other");
    setFields(
      target.metadata?.fields?.length
        ? target.metadata.fields.map((f) => ({ ...f }))
        : [{ label: "", value: "" }],
    );
    setError(null);
  }, [target.documentId, target.metadata]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function updateField(index: number, patch: Partial<ExtractedFieldRow>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        documentId: target.documentId,
        type: type as (typeof DOC_TYPES)[number]["value"],
        fields: fields.filter((f) => f.label.trim() && f.value.trim()),
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save review.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRetry() {
    if (!onRetry) return;
    setSaving(true);
    setError(null);
    try {
      await onRetry(target.documentId);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reprocess.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/40"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Review ${target.name}`}
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-5 shadow-xl"
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">
              {target.name}
            </p>
            <div className="mt-1 flex items-center gap-2">
              {target.status ? <StatusChip status={target.status} /> : null}
              {target.metadata ? (
                <span className="text-xs text-ink-soft">
                  confidence {Math.round(target.metadata.confidence * 100)}%
                  {target.metadata.ocrUsed ? " · OCR" : ""}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close review drawer"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-cream"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {target.statusError ? (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {target.statusError}
          </p>
        ) : null}
        {target.status === "needsOcr" ? (
          <p className="rounded-xl bg-purple-50 p-3 text-sm text-purple-800">
            This looks like a scanned document. No OCR provider is configured
            yet — confirm the details manually or retry after OCR is set up.
          </p>
        ) : null}

        <label className="flex flex-col gap-1 text-sm font-semibold">
          Document type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="min-h-[44px] rounded-xl border border-ink/15 bg-white px-3 text-sm font-normal"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Extracted fields</p>
          {fields.map((field, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={field.label}
                onChange={(e) => updateField(i, { label: e.target.value })}
                placeholder="Label"
                aria-label={`Field ${i + 1} label`}
                className="w-28 shrink-0 rounded-xl border border-ink/15 px-2.5 py-2 text-sm sm:w-36"
              />
              <input
                value={field.value}
                onChange={(e) => updateField(i, { value: e.target.value })}
                placeholder="Value"
                aria-label={`Field ${i + 1} value`}
                className="min-w-0 flex-1 rounded-xl border border-ink/15 px-2.5 py-2 text-sm"
              />
              <button
                type="button"
                aria-label={`Remove field ${i + 1}`}
                onClick={() =>
                  setFields((prev) => prev.filter((_, j) => j !== i))
                }
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-cream hover:text-red-600"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFields((prev) => [...prev, { label: "", value: "" }])}
            className="self-start rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold hover:bg-cream"
          >
            + Add field
          </button>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={cn(
              "flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white",
              saving && "opacity-60",
            )}
          >
            <Save size={16} aria-hidden="true" />
            {saving ? "Saving…" : "Confirm details"}
          </button>
          {onRetry &&
          (target.status === "failed" || target.status === "needsOcr") ? (
            <button
              type="button"
              onClick={handleRetry}
              disabled={saving}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-ink/15 px-4 text-sm font-semibold hover:bg-cream"
            >
              <RotateCw size={16} aria-hidden="true" />
              Retry pipeline
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
