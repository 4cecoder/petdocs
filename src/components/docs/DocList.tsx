import { AlertTriangle, FileText, ScanEye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocPipelineMetadata, DocPipelineStatus } from "@/lib/api";

export interface VaultDoc {
  id: string;
  name: string;
  category: string;
  date: string;
  sizeLabel?: string;
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

export function DocList({
  docs,
  emptyHint = "No documents yet. Snap a vaccine cert photo to start.",
  onTrash,
  onReview,
}: {
  docs: VaultDoc[];
  emptyHint?: string;
  onTrash?: (id: string) => void;
  /** Open the review drawer for docs needing attention or with metadata. */
  onReview?: (doc: VaultDoc) => void;
}) {
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
  return (
    <ul className="flex flex-col gap-2">
      {docs.map((doc) => {
        const reviewable = isReviewable(doc);
        return (
          <li
            key={doc.id}
            className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3"
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream-dark"
            >
              <FileText size={20} aria-hidden="true" className="text-ink-soft" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{doc.name}</p>
              <p className="truncate text-xs capitalize text-ink-soft">
                {doc.category.replace(/_/g, " ")} · {doc.date}
                {doc.sizeLabel ? ` · ${doc.sizeLabel}` : ""}
              </p>
              {doc.statusError ? (
                <p className="truncate text-xs font-medium text-red-600">
                  {doc.statusError}
                </p>
              ) : null}
            </div>
            {doc.status ? <StatusChip status={doc.status} /> : null}
            {reviewable && onReview ? (
              <button
                type="button"
                aria-label={`Review ${doc.name}`}
                onClick={() => onReview(doc)}
                className={cn(
                  "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition",
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
                onClick={() => onTrash(doc.id)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-ink-soft hover:bg-cream hover:text-red-600 transition"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
