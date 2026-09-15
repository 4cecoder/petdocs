"use client";

import {
  Calendar,
  ChevronRight,
  Pencil,
  Pill,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Progress } from "@seridian/ui-kit";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { formatAge, getSpeciesEmoji } from "./fmt";
import type { Pet } from "@/lib/api";

export interface VaccineSummary {
  label: string;
  variant: "warning" | "due" | "ok" | "neutral";
  detail: string;
}

/**
 * Above-the-fold overview card: photo, name, key stats and profile health
 * score. Everything else on the page lives behind the tools grid.
 */
export function PetHero({
  pet,
  profileScore,
  missingCount,
  upcomingCount,
  nextAppointment,
  vaccineSummary,
  vaccineCount,
  activeMedCount,
  medCount,
  onShare,
  onAddDocument,
  onEdit,
}: {
  pet: Pet;
  profileScore: number;
  missingCount: number;
  upcomingCount: number;
  nextAppointment: { title: string; dueAt: number } | null;
  vaccineSummary: VaccineSummary;
  vaccineCount: number;
  activeMedCount: number;
  medCount: number;
  onShare: () => void;
  onAddDocument: () => void;
  onEdit: () => void;
}) {
  return (
    <section
      aria-label="Pet overview"
      className="rounded-3xl border border-ink/10 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {/* Identity: photo, name, headline stats */}
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-cream-dark text-4xl shadow-inner">
            <span role="img" aria-label={pet.species}>
              {getSpeciesEmoji(pet.species)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
                {pet.name}
              </h1>
              <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs font-semibold capitalize text-ink-soft">
                {pet.species}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {pet.breed || "Breed unspecified"} · {formatAge(pet.birthdate)}
              {pet.weightKg ? ` · ${pet.weightKg} kg` : ""}
            </p>

            {/* Key stats — condensed from the old 3-card row */}
            <dl className="mt-4 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs">
                <Calendar size={15} aria-hidden="true" className="shrink-0 text-brand-600" />
                <div className="min-w-0">
                  <dt className="sr-only">Appointments</dt>
                  <dd className="truncate font-semibold text-ink">
                    {upcomingCount > 0
                      ? `${upcomingCount} upcoming`
                      : "No visits scheduled"}
                  </dd>
                  <dd className="truncate text-ink-soft">
                    {nextAppointment
                      ? nextAppointment.title
                      : "All checkups clear"}
                  </dd>
                </div>
                <a
                  href={ROUTES.dashboard.reminders}
                  className="ml-1 inline-flex shrink-0 items-center gap-0.5 font-semibold text-brand-700 hover:underline"
                >
                  Manage
                  <ChevronRight size={12} aria-hidden="true" />
                </a>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs">
                {vaccineSummary.variant === "warning" ? (
                  <ShieldAlert size={15} aria-hidden="true" className="shrink-0 text-red-600" />
                ) : (
                  <ShieldCheck
                    size={15}
                    aria-hidden="true"
                    className={cn(
                      "shrink-0",
                      vaccineSummary.variant === "due"
                        ? "text-amber-600"
                        : "text-teal-600",
                    )}
                  />
                )}
                <div className="min-w-0">
                  <dt className="sr-only">Vaccinations</dt>
                  <dd className="truncate font-semibold text-ink">
                    {vaccineSummary.label}
                  </dd>
                  <dd className="truncate text-ink-soft">
                    {vaccineSummary.detail} · {vaccineCount} logged
                  </dd>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs">
                <Pill size={15} aria-hidden="true" className="shrink-0 text-purple-600" />
                <div className="min-w-0">
                  <dt className="sr-only">Medications</dt>
                  <dd className="truncate font-semibold text-ink">
                    {activeMedCount > 0
                      ? `${activeMedCount} active`
                      : "No active meds"}
                  </dd>
                  <dd className="truncate text-ink-soft">
                    {medCount} total prescribed
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onShare}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-xs hover:bg-cream transition"
          >
            <Share2 size={16} aria-hidden="true" />
            <span>Share passport</span>
          </button>
          <button
            type="button"
            onClick={onAddDocument}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-xs hover:bg-cream transition"
          >
            <Upload size={16} aria-hidden="true" />
            <span>Add Document</span>
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-xs hover:bg-cream transition"
          >
            <Pencil size={16} aria-hidden="true" />
            <span>Edit Pet</span>
          </button>
        </div>
      </div>

      {/* Health score / profile completeness */}
      <div className="mt-5 rounded-2xl border border-brand-500/20 bg-linear-to-br from-brand-50/50 via-white to-cream p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} aria-hidden="true" className="text-amber-500" />
            <h2 className="text-sm font-bold text-ink">Profile completeness</h2>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">
              {profileScore}%
            </span>
          </div>
          <span className="text-xs font-medium text-ink-soft">
            {missingCount === 0
              ? "Fully documented, emergency ready"
              : `${missingCount} item${missingCount > 1 ? "s" : ""} to 100% · see Care checklist`}
          </span>
        </div>
        <Progress
          value={profileScore}
          className="mt-2.5 h-2.5 bg-cream-dark"
        />
      </div>
    </section>
  );
}
