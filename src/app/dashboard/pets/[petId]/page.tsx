"use client";

import { use, useEffect, useState } from "react";
import { PetArt } from "@/components/art/PetArt";
import { DocList, type VaultDoc as VaultDocRow } from "@/components/docs/DocList";
import { DocUploader } from "@/components/docs/DocUploader";
import { PetTimeline, type TimelineEvent } from "@/components/pets/PetTimeline";
import { ShareButton } from "@/components/share/ShareButton";
import {
  api,
  getOwnerId,
  isBackendConfigured,
  type Pet,
  type Vaccination,
  type VaultDoc,
  type VetVisit,
} from "@/lib/api";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString();
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function toDocRow(doc: VaultDoc): VaultDocRow {
  return {
    id: doc._id,
    name: doc.name,
    category: doc.category ?? "other",
    date: formatDate(doc.createdAt),
    sizeLabel: formatBytes(doc.size),
  };
}

function buildTimeline(
  vaccines: Vaccination[],
  visits: VetVisit[],
  docs: VaultDoc[],
): TimelineEvent[] {
  const stamped: Array<{ ts: number; event: TimelineEvent }> = [];

  for (const v of vaccines) {
    const ts = v.administeredAt ?? v.dueAt ?? 0;
    stamped.push({
      ts,
      event: {
        id: `vaccine-${v._id}`,
        date: ts ? formatDate(ts) : "No date",
        kind: "vaccine",
        title: `${v.vaccineName} — ${v.status}`,
        detail: v.administeredAt
          ? `Given ${formatDate(v.administeredAt)}${v.provider ? ` · ${v.provider}` : ""}`
          : v.dueAt
            ? `Due ${formatDate(v.dueAt)}`
            : undefined,
      },
    });
  }

  for (const visit of visits) {
    stamped.push({
      ts: visit.visitedAt,
      event: {
        id: `visit-${visit._id}`,
        date: formatDate(visit.visitedAt),
        kind: "visit",
        title: visit.reason,
        detail:
          [visit.clinicName, visit.vetName, visit.diagnosis]
            .filter(Boolean)
            .join(" · ") || undefined,
      },
    });
  }

  for (const doc of docs) {
    stamped.push({
      ts: doc.createdAt,
      event: {
        id: `doc-${doc._id}`,
        date: formatDate(doc.createdAt),
        kind: "upload",
        title: doc.name,
        detail: (doc.category ?? "other").replace(/_/g, " "),
      },
    });
  }

  return stamped.sort((a, b) => b.ts - a.ts).map((s) => s.event);
}

/**
 * Pet profile: header + tabs (Timeline | Docs | Reminders) + share.
 */
export default function PetDetailPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = use(params);
  const ownerId = getOwnerId();
  const backend = isBackendConfigured;

  const [pet, setPet] = useState<Pet | null>(null);
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [vaccines, setVaccines] = useState<Vaccination[]>([]);
  const [visits, setVisits] = useState<VetVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId || !backend) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.pets.get(ownerId, petId),
      api.documents.list(ownerId, petId),
      api.vaccinations.list(ownerId, petId),
      api.visits.list(ownerId, petId),
    ])
      .then(([petRow, docRows, vaccineRows, visitRows]) => {
        if (cancelled) return;
        setPet(petRow);
        setDocs(docRows);
        setVaccines(vaccineRows);
        setVisits(visitRows);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load pet.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, backend, petId]);

  async function refetchDocs() {
    if (!ownerId || !backend) return;
    setDocsError(null);
    try {
      const rows = await api.documents.list(ownerId, petId);
      setDocs(rows);
    } catch (e: unknown) {
      setDocsError(e instanceof Error ? e.message : "Could not refresh documents.");
    }
  }

  if (!ownerId || !backend) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex items-center gap-4">
          <PetArt name="happy" size={80} />
          <div>
            <h1 className="font-display text-2xl font-bold">Pet profile</h1>
            <p className="text-sm text-ink-soft">ID: {petId} (wiring lands with Convex)</p>
          </div>
        </header>

        <div className="flex items-start gap-3">
          <PetArt name="link" size={96} className="shrink-0" />
          <div className="flex-1">
            <ShareButton petId={petId} petName="your pet" />
          </div>
        </div>

        <section aria-label="Upload">
          <h2 className="mb-2 font-display text-lg font-bold">Add a document</h2>
          <DocUploader petId={petId} />
        </section>

        <section aria-label="Documents">
          <h2 className="mb-2 font-display text-lg font-bold">Documents</h2>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
            <PetArt name="camera" size={120} />
            <p className="mt-2 font-semibold">Snap your first doc</p>
            <p className="text-sm text-ink-soft">
              A vaccine cert photo is a perfect start — it keeps this vault
              cozy and complete.
            </p>
          </div>
        </section>

        <section aria-label="Timeline">
          <h2 className="mb-2 font-display text-lg font-bold">Timeline</h2>
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
            <PetArt name="sleepy" size={120} />
            <p className="mt-2 font-display font-bold">Quiet for now</p>
            <p className="text-sm text-ink-soft">
              Uploads, visits, and vax will nap here until the story begins.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <p role="status" aria-live="polite" className="text-sm text-ink-soft">
          Loading pet…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <p role="alert" aria-live="assertive" className="text-sm font-medium text-red-600">
          {error}
        </p>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="flex flex-col gap-6">
        <p aria-live="polite" className="text-sm text-ink-soft">
          Pet not found.
        </p>
      </div>
    );
  }

  const timeline = buildTimeline(vaccines, visits, docs);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <PetArt name="happy" size={80} />
        <div>
          <h1 className="font-display text-2xl font-bold">{pet.name}</h1>
          <p className="text-sm capitalize text-ink-soft">
            {pet.species}
            {pet.breed ? ` · ${pet.breed}` : ""}
          </p>
        </div>
      </header>

      <div className="flex items-start gap-3">
        <PetArt name="link" size={96} className="shrink-0" />
        <div className="flex-1">
          <ShareButton petId={petId} petName={pet.name} />
        </div>
      </div>

      <section aria-label="Upload">
        <h2 className="mb-2 font-display text-lg font-bold">Add a document</h2>
        <DocUploader petId={petId} onComplete={() => void refetchDocs()} />
      </section>

      <section aria-label="Documents">
        <h2 className="mb-2 font-display text-lg font-bold">Documents</h2>
        {docsError ? (
          <p role="alert" className="mb-2 text-sm font-medium text-red-600">
            {docsError}
          </p>
        ) : null}
        {docs.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
            <PetArt name="camera" size={120} />
            <p className="mt-2 font-semibold">Snap your first doc</p>
            <p className="text-sm text-ink-soft">
              A vaccine cert photo is a perfect start — it keeps {pet.name}&apos;s
              vault cozy and complete.
            </p>
          </div>
        ) : (
          <DocList docs={docs.map(toDocRow)} />
        )}
      </section>

      <section aria-label="Timeline">
        <h2 className="mb-2 font-display text-lg font-bold">Timeline</h2>
        {timeline.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
            <PetArt name="sleepy" size={120} />
            <p className="mt-2 font-display font-bold">Quiet for now</p>
            <p className="text-sm text-ink-soft">
              Uploads, visits, and vax will nap here until {pet.name}&apos;s story
              begins.
            </p>
          </div>
        ) : (
          <PetTimeline events={timeline} />
        )}
      </section>
    </div>
  );
}
