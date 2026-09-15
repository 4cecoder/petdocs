"use client";

import { FilePlus2 } from "lucide-react";
import {
  EmptyState,
} from "@seridian/ui-kit";
import { PetArt } from "@/components/art/PetArt";
import { PetTimeline, type TimelineEvent } from "@/components/pets/PetTimeline";
import {
  vaccinationDueCalendarEvent,
  vetVisitCalendarEvent,
} from "@/lib/calendar";
import { formatDate } from "../fmt";
import type { Vaccination, VaultDoc, VetVisit } from "@/lib/api";

function buildTimeline(
  vaccines: Vaccination[],
  visits: VetVisit[],
  docs: VaultDoc[],
  petName: string,
): TimelineEvent[] {
  const stamped: Array<{ ts: number; event: TimelineEvent }> = [];

  for (const v of vaccines) {
    const ts = v.administeredAt ?? v.dueAt ?? 0;
    // Only pending due dates get a calendar entry — administered shots are
    // history, not something to schedule.
    const calendar =
      !v.administeredAt && v.dueAt !== undefined
        ? (vaccinationDueCalendarEvent(
            {
              id: v._id,
              vaccineName: v.vaccineName,
              dueAt: v.dueAt,
              provider: v.provider,
            },
            petName,
          ) ?? undefined)
        : undefined;
    stamped.push({
      ts,
      event: {
        id: `vaccine-${v._id}`,
        date: ts ? formatDate(ts) : "No date",
        kind: "vaccine",
        title: `${v.vaccineName}: ${v.status}`,
        detail: v.administeredAt
          ? `Given ${formatDate(v.administeredAt)}${v.provider ? ` · ${v.provider}` : ""}`
          : v.dueAt
            ? `Due ${formatDate(v.dueAt)}`
            : undefined,
        calendar,
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
        calendar: vetVisitCalendarEvent(
          {
            id: visit._id,
            visitedAt: visit.visitedAt,
            reason: visit.reason,
            clinicName: visit.clinicName,
            vetName: visit.vetName,
            diagnosis: visit.diagnosis,
          },
          petName,
        ),
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

/** Timeline tool: reverse-chronological medical history. */
export default function TimelinePanel({
  vaccines,
  visits,
  docs,
  petName,
  onAddDocument,
}: {
  vaccines: Vaccination[];
  visits: VetVisit[];
  docs: VaultDoc[];
  petName: string;
  onAddDocument: () => void;
}) {
  const timeline = buildTimeline(vaccines, visits, docs, petName);

  return (
    <section aria-label="Health timeline" className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">
          Medical history timeline
        </h2>
        <p className="text-sm text-ink-soft">
          Vaccinations, vet visits, and uploads in chronological order.
        </p>
      </div>

      {timeline.length === 0 ? (
        <EmptyState
          icon={<PetArt name="sleepy" size={110} aria-hidden="true" />}
          title="Quiet for now"
          description="Uploads, vet visits, and vaccine boosters will appear here as they happen."
          actions={
            <button
              type="button"
              onClick={onAddDocument}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 transition"
            >
              <FilePlus2 size={16} aria-hidden="true" />
              Add a document
            </button>
          }
        />
      ) : (
        <PetTimeline events={timeline} />
      )}
    </section>
  );
}
