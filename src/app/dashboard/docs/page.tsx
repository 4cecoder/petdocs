"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PetArt } from "@/components/art/PetArt";
import {
  DocList,
  type VaultDoc as VaultDocRow,
} from "@/components/docs/DocList";
import {
  DocReviewDrawer,
  type DocReviewTarget,
} from "@/components/docs/DocReviewDrawer";
import { api, getOwnerId, isBackendConfigured, type Pet } from "@/lib/api";
import { cn } from "@/lib/utils";

interface GlobalDoc {
  petId: string;
  row: VaultDocRow;
  sortKey: number;
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 6;

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function toRow(docId: string, doc: {
  _id: string;
  name: string;
  mime: string;
  category?: string;
  createdAt: number;
  size: number;
  status?: VaultDocRow["status"];
  statusError?: string;
  metadata?: VaultDocRow["metadata"];
}): VaultDocRow {
  return {
    id: docId,
    documentId: doc._id,
    name: doc.name,
    mime: doc.mime,
    category: doc.category ?? "other",
    // Pinned locale: render output must not depend on server vs browser
    // locale, or a future SSR of this tree becomes a hydration mismatch.
    date: new Date(doc.createdAt).toLocaleDateString("en-US"),
    sizeLabel: formatBytes(doc.size),
    status: doc.status,
    statusError: doc.statusError,
    metadata: doc.metadata,
  };
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
  const [reviewTarget, setReviewTarget] = useState<DocReviewTarget | null>(null);
  const pollsRef = useRef(0);

  const load = useCallback(
    async (cancelled: { current: boolean }) => {
      if (!ownerId || !backend) return;
      setError(null);
      const petRows = await api.pets.list(ownerId);
      if (cancelled.current) return;
      if (petRows.length === 0) {
        setPets([]);
        setAllDocs([]);
        return;
      }
      const perPet = await Promise.all(
        petRows.map(async (pet) => {
          const docs = await api.documents.list(ownerId, pet._id);
          return docs.map((doc) => ({
            petId: pet._id,
            sortKey: doc.createdAt,
              row: {
                ...toRow(`${pet._id}:${doc._id}`, doc),
                name: `${pet.name}: ${doc.name}`,
                petName: pet.name,
              } satisfies VaultDocRow,
          }));
        }),
      );
      if (cancelled.current) return;
      setPets(petRows);
      setAllDocs(perPet.flat().sort((a, b) => b.sortKey - a.sortKey));
    },
    [ownerId, backend],
  );

  useEffect(() => {
    if (!ownerId || !backend) return;
    const cancelled = { current: false };
    setLoading(true);
    pollsRef.current = 0;
    load(cancelled)
      .catch((e: unknown) => {
        if (!cancelled.current)
          setError(e instanceof Error ? e.message : "Could not load documents.");
      })
      .finally(() => {
        if (!cancelled.current) setLoading(false);
      });
    return () => {
      cancelled.current = true;
    };
  }, [ownerId, backend, load]);

  // Poll while any document is queued/processing so status chips settle.
  useEffect(() => {
    if (!ownerId || !backend) return;
    const active = allDocs.some(
      (d) => d.row.status === "uploaded" || d.row.status === "processing",
    );
    if (!active || pollsRef.current >= MAX_POLLS) return;
    const cancelled = { current: false };
    const timer = setTimeout(() => {
      pollsRef.current += 1;
      load(cancelled).catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled.current = true;
      clearTimeout(timer);
    };
  }, [allDocs, ownerId, backend, load]);

  const filtered = useMemo(
    () =>
      selected === "all"
        ? allDocs.map((d) => d.row)
        : allDocs.filter((d) => d.petId === selected).map((d) => d.row),
    [allDocs, selected],
  );

  async function handleTrash(id: string) {
    if (!ownerId) return;
    const docId = id.includes(":") ? id.split(":")[1] : id;
    try {
      await api.documents.moveToTrash(ownerId, docId);
    } catch {
      // Allow optimistic removal even if mock/offline
    }
    setAllDocs((prev) => prev.filter((d) => d.row.id !== id));
  }

  function handleReview(row: VaultDocRow) {
    const docId = row.id.includes(":") ? row.id.split(":")[1] : row.id;
    setReviewTarget({
      documentId: docId,
      name: row.name,
      status: row.status,
      statusError: row.statusError,
      metadata: row.metadata,
    });
  }

  async function handleReviewSubmit(input: {
    documentId: string;
    type: "vaccination" | "vet_visit" | "medication" | "lab" | "other";
    fields: { label: string; value: string }[];
  }) {
    if (!ownerId) return;
    await api.documents.reviewSubmit({
      ownerId,
      documentId: input.documentId,
      type: input.type,
      fields: input.fields,
    });
    pollsRef.current = 0;
    await load({ current: false });
  }

  async function handleRetry(documentId: string) {
    if (!ownerId) return;
    await api.documents.reprocess(ownerId, documentId);
    pollsRef.current = 0;
    await load({ current: false });
  }

  if (!ownerId || !backend) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold">Documents</h1>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by pet">
          <span className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
            All pets
          </span>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
          <PetArt name="camera" size={120} />
          <p className="mt-2 font-semibold">Snap your first doc</p>
          <p className="text-sm text-ink-soft">
            Snap a vaccine cert photo to start the vault.
          </p>
        </div>
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
      {!loading && !error ? (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
            <PetArt name="camera" size={120} />
            <p className="mt-2 font-semibold">Snap your first doc</p>
            <p className="text-sm text-ink-soft">
              Snap a vaccine cert photo to start the vault.
            </p>
          </div>
        ) : (
          <DocList
            docs={filtered}
            ownerId={ownerId}
            onTrash={handleTrash}
            onReview={handleReview}
          />
        )
      ) : null}
      {reviewTarget ? (
        <DocReviewDrawer
          target={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleReviewSubmit}
          onRetry={handleRetry}
        />
      ) : null}
    </div>
  );
}
