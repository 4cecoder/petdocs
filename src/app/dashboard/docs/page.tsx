"use client";

import { useEffect, useMemo, useState } from "react";
import { DocList, type VaultDoc as VaultDocRow } from "@/components/docs/DocList";
import { api, getOwnerId, isBackendConfigured, type Pet } from "@/lib/api";
import { cn } from "@/lib/utils";

interface GlobalDoc {
  petId: string;
  row: VaultDocRow;
  sortKey: number;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** Global filterable doc list. */
export default function DocsPage() {
  const ownerId = getOwnerId();
  const backend = isBackendConfigured;

  const [pets, setPets] = useState<Pet[]>([]);
  const [allDocs, setAllDocs] = useState<GlobalDoc[]>([]);
  const [selected, setSelected] = useState<string | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId || !backend) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.pets
      .list(ownerId)
      .then((petRows) => {
        if (cancelled) return null;
        if (petRows.length === 0) {
          setPets([]);
          setAllDocs([]);
          return null;
        }
        return Promise.all(
          petRows.map(async (pet) => {
            const docs = await api.documents.list(ownerId, pet._id);
            return docs.map((doc) => ({
              petId: pet._id,
              sortKey: doc.createdAt,
              row: {
                id: `${pet._id}:${doc._id}`,
                name: `${pet.name} — ${doc.name}`,
                category: doc.category ?? "other",
                date: new Date(doc.createdAt).toLocaleDateString(),
                sizeLabel: formatBytes(doc.size),
              } satisfies VaultDocRow,
            }));
          }),
        ).then((perPet) => {
          if (cancelled) return;
          setPets(petRows);
          setAllDocs(
            perPet
              .flat()
              .sort((a, b) => b.sortKey - a.sortKey),
          );
        });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load documents.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, backend]);

  const filtered = useMemo(
    () =>
      selected === "all"
        ? allDocs.map((d) => d.row)
        : allDocs.filter((d) => d.petId === selected).map((d) => d.row),
    [allDocs, selected],
  );

  if (!ownerId || !backend) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold">Documents</h1>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by pet">
          <span className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
            All pets
          </span>
        </div>
        <DocList docs={[]} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Documents</h1>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter by pet"
      >
        <button
          type="button"
          onClick={() => setSelected("all")}
          aria-pressed={selected === "all"}
          className={cn(
            "min-h-[44px] shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
            selected === "all"
              ? "bg-brand-600 text-white"
              : "border border-ink/15 bg-white text-ink",
          )}
        >
          All pets
        </button>
        {pets.map((pet) => (
          <button
            key={pet._id}
            type="button"
            onClick={() => setSelected(pet._id)}
            aria-pressed={selected === pet._id}
            className={cn(
              "min-h-[44px] shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
              selected === pet._id
                ? "bg-brand-600 text-white"
                : "border border-ink/15 bg-white text-ink",
            )}
          >
            {pet.name}
          </button>
        ))}
      </div>
      <div aria-live="polite">
        {loading ? (
          <p role="status" className="text-sm text-ink-soft">
            Loading documents…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}
      </div>
      {!loading && !error ? <DocList docs={filtered} /> : null}
    </div>
  );
}
