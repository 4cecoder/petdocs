"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  ImageOff,
  ScanEye,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, type DocPipelineMetadata, type DocPipelineStatus } from "@/lib/api";

export interface VaultDoc {
  id: string;
  /** Real Convex document id; global rows may use a composite `id` for display. */
  documentId?: string;
  name: string;
  mime?: string;
  category: string;
  date: string;
  sizeLabel?: string;
  petName?: string;
  previewUrl?: string | null;
  /** Pipeline status (issue #23). Undefined = legacy row, shown as ready. */
  status?: DocPipelineStatus;
  statusError?: string;
  metadata?: DocPipelineMetadata;
}

const STATUS_CHIP: Record<
  DocPipelineStatus,
  { label: string; className: string }
> = {
  uploaded: {
    label: "Queued",
    className: "bg-cream text-ink-soft",
  },
  processing: {
    label: "Processing…",
    className: "bg-amber-100 text-amber-800",
  },
  ready: {
    label: "Ready",
    className: "bg-green-100 text-green-800",
  },
  needsReview: {
    label: "Review",
    className: "bg-amber-100 text-amber-900",
  },
  needsOcr: {
    label: "Needs OCR",
    className: "bg-purple-100 text-purple-800",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700",
  },
};

export function StatusChip({ status }: { status: DocPipelineStatus }) {
  const chip = STATUS_CHIP[status];
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        chip.className,
      )}
    >
      {chip.label}
    </span>
  );
}

function isReviewable(doc: VaultDoc): boolean {
  return (
    doc.status === "needsReview" ||
    doc.status === "needsOcr" ||
    doc.status === "failed"
  );
}

function isImage(doc: VaultDoc): boolean {
  return (
    doc.mime?.startsWith("image/") === true ||
    /\.(?:avif|gif|heic|jpe?g|png|webp)$/i.test(doc.name)
  );
}

function fileLabel(doc: VaultDoc): string {
  if (doc.mime === "application/pdf" || /\.pdf$/i.test(doc.name)) return "PDF";
  if (isImage(doc)) return "Photo";
  const extension = doc.name.split(".").pop();
  return extension && extension.length <= 5 ? extension.toUpperCase() : "File";
}

function DocumentPreview({
  doc,
  url,
  onClose,
}: {
  doc: VaultDoc;
  url: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const image = isImage(doc);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${doc.name}`}
        className="flex max-h-[min(88vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink">
              {doc.name}
            </p>
            <p className="mt-1 text-xs capitalize text-ink-soft">
              {doc.category.replace(/_/g, " ")} · {doc.date}
              {doc.sizeLabel ? ` · ${doc.sizeLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close file preview"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-soft transition hover:bg-cream hover:text-ink"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="flex min-h-64 flex-1 items-center justify-center overflow-auto bg-cream/60 p-4 sm:min-h-96 sm:p-8">
          {image && url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={doc.name}
              className="max-h-[58vh] max-w-full rounded-xl object-contain shadow-sm"
            />
          ) : image ? (
            <div className="flex flex-col items-center gap-2 text-center text-sm text-ink-soft">
              <ImageOff size={36} aria-hidden="true" />
              <p>Preview unavailable for this image.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center text-ink-soft">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                <FileText size={30} aria-hidden="true" />
              </span>
              <p className="max-w-xs text-sm">
                This file is ready to open in a new tab.
              </p>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-5 py-4">
          <div>
            {doc.status ? <StatusChip status={doc.status} /> : null}
            {doc.petName ? (
              <span className="ml-2 text-xs text-ink-soft">{doc.petName}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-ink/15 bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-cream"
              >
                <ExternalLink size={16} aria-hidden="true" />
                Open original
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Done
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function DocList({
  docs,
  emptyHint = "No documents yet. Snap a vaccine cert photo to start.",
  ownerId,
  onTrash,
  onReview,
}: {
  docs: VaultDoc[];
  emptyHint?: string;
  ownerId?: string | null;
  onTrash?: (id: string) => void;
  /** Open the review drawer for docs needing attention or with metadata. */
  onReview?: (doc: VaultDoc) => void;
}) {
  const [previewUrls, setPreviewUrls] = useState<Record<string, string | null>>(
    {},
  );
  const [selectedDoc, setSelectedDoc] = useState<VaultDoc | null>(null);
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const documentKeys = docs
    .map((doc) => `${doc.id}:${doc.documentId ?? ""}:${doc.previewUrl ?? ""}`)
    .join("|");

  // Resolve owner-scoped storage URLs once per document set. The documents
  // query intentionally returns storage metadata, not public URLs.
  useEffect(() => {
    if (!ownerId) return;
    const candidates = docsRef.current.filter(
      (doc) =>
        doc.documentId &&
        !Object.prototype.hasOwnProperty.call(previewUrls, doc.id),
    );
    if (candidates.length === 0) return;

    let cancelled = false;
    void Promise.all(
      candidates.map(async (doc) => {
        if (doc.previewUrl !== undefined) {
          return [doc.id, doc.previewUrl] as const;
        }
        try {
          const url = await api.documents.getUrl(ownerId, doc.documentId!);
          return [doc.id, typeof url === "string" ? url : null] as const;
        } catch {
          return [doc.id, null] as const;
        }
      }),
    ).then((resolved) => {
      if (cancelled) return;
      setPreviewUrls((previous) => ({
        ...previous,
        ...Object.fromEntries(resolved),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [documentKeys, ownerId, previewUrls]);

  if (docs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
        <FileText
          size={32}
          aria-hidden="true"
          className="mx-auto text-ink-soft"
        />
        <p className="mt-2 font-semibold">Nothing here yet</p>
        <p className="text-sm text-ink-soft">{emptyHint}</p>
      </div>
    );
  }

  const photoCount = docs.filter(isImage).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Your files</p>
          <p className="text-xs text-ink-soft">
            Tap a photo or file to preview it.
          </p>
        </div>
        <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-ink-soft">
          {docs.length} {docs.length === 1 ? "file" : "files"}
          {photoCount ? ` · ${photoCount} ${photoCount === 1 ? "photo" : "photos"}` : ""}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {docs.map((doc) => {
        const reviewable = isReviewable(doc);
        const image = isImage(doc);
        const url = previewUrls[doc.id] ?? doc.previewUrl ?? null;
        const urlLoading = image && doc.documentId && !(doc.id in previewUrls);
        return (
          <li
            key={doc.id}
            className="group overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-xs transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm"
          >
            <button
              type="button"
              aria-label={`Open ${doc.name} preview`}
              onClick={() => setSelectedDoc(doc)}
              className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-cream-dark">
                {image && url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-soft">
                    {image ? (
                      <ImageIcon size={30} aria-hidden="true" />
                    ) : (
                      <FileText size={30} aria-hidden="true" />
                    )}
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                      {urlLoading ? "Loading" : fileLabel(doc)}
                    </span>
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink shadow-sm">
                  {fileLabel(doc)}
                </span>
                {doc.status ? (
                  <span className="absolute right-2 top-2">
                    <StatusChip status={doc.status} />
                  </span>
                ) : null}
              </div>
              <div className="px-3 pb-3 pt-2.5">
                <p className="truncate text-sm font-semibold text-ink">{doc.name}</p>
                <p className="mt-0.5 truncate text-xs capitalize text-ink-soft">
                  {doc.category.replace(/_/g, " ")} · {doc.date}
                </p>
                {doc.petName ? (
                  <p className="mt-1 truncate text-xs font-medium text-brand-700">
                    {doc.petName}
                  </p>
                ) : null}
                {doc.statusError ? (
                  <p className="mt-1 truncate text-xs font-medium text-red-600">
                    {doc.statusError}
                  </p>
                ) : null}
              </div>
            </button>
            <div className="flex items-center justify-end gap-1 border-t border-ink/10 px-2 py-1.5">
              {reviewable && onReview ? (
                <button
                  type="button"
                  aria-label={`Review ${doc.name}`}
                  onClick={() => onReview(doc)}
                  className={cn(
                    "flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl transition",
                    doc.status === "failed"
                      ? "text-ink-soft hover:bg-cream hover:text-red-600"
                      : "text-amber-700 hover:bg-amber-50",
                  )}
                >
                  {doc.status === "needsOcr" ? (
                    <ScanEye size={18} aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={18} aria-hidden="true" />
                  )}
                </button>
              ) : null}
              {onTrash ? (
                <button
                  type="button"
                  aria-label={`Move ${doc.name} to trash`}
                  onClick={() => {
                    if (selectedDoc?.id === doc.id) setSelectedDoc(null);
                    onTrash(doc.id);
                  }}
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-ink-soft transition hover:bg-cream hover:text-red-600"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
      </ul>

      {selectedDoc ? (
        <DocumentPreview
          doc={selectedDoc}
          url={previewUrls[selectedDoc.id] ?? selectedDoc.previewUrl ?? null}
          onClose={() => setSelectedDoc(null)}
        />
      ) : null}
    </>
  );
}
