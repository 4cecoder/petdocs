import { FileText } from "lucide-react";

export interface VaultDoc {
  id: string;
  name: string;
  category: string;
  date: string;
  sizeLabel?: string;
}

export function DocList({
  docs,
  emptyHint = "No documents yet. Snap a vaccine cert photo to start.",
}: {
  docs: VaultDoc[];
  emptyHint?: string;
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
      {docs.map((doc) => (
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
            <p className="text-xs capitalize text-ink-soft">
              {doc.category.replace(/_/g, " ")} · {doc.date}
              {doc.sizeLabel ? ` · ${doc.sizeLabel}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
