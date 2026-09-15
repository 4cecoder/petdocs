"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PetArt } from "@/components/art/PetArt";
import { DocUploader } from "@/components/docs/DocUploader";
import { ShareButton } from "@/components/share/ShareButton";
import { isBackendConfigured, getOwnerId } from "@/lib/api";
import {
  reminderCalendarEvent,
  vaccinationDueCalendarEvent,
} from "@/lib/calendar";
import { ROUTES, petSubrouteHref } from "@/lib/routes";
import { profileCompleteness } from "./completeness";
import { EditPetDialog } from "./EditPetDialog";
import { PetHero, type VaccineSummary } from "./PetHero";
import { PetToolNav } from "./tool-nav";
import { PetWorkspaceProvider, usePetWorkspace } from "./workspace";
import type { Medication, Pet, Reminder, Vaccination } from "@/lib/api";

function hubDerived(
  pet: Pet,
  vaccines: Vaccination[],
  reminders: Reminder[],
  medications: Medication[],
) {
  const upcoming = reminders
    .filter((r) => r.status === "scheduled")
    .sort((a, b) => a.dueAt - b.dueAt);

  const overdue = vaccines.filter((v) => v.status === "overdue");
  const due = vaccines.filter((v) => v.status === "due");
  const administered = vaccines.filter((v) => v.status === "administered");

  const vaccineSummary: VaccineSummary = overdue.length
    ? { label: `${overdue.length} overdue`, variant: "warning", detail: overdue[0].vaccineName }
    : due.length
      ? { label: `${due.length} due soon`, variant: "due", detail: due[0].vaccineName }
      : administered.length
        ? { label: "Up to date", variant: "ok", detail: `${administered.length} recorded` }
        : { label: "None recorded", variant: "neutral", detail: "Add vaccine certificate" };

  return {
    upcoming,
    vaccineSummary,
    activeMeds: medications.filter((m) => m.status === "active"),
  };
}

function PetHubChrome({
  children,
  onEdit,
  isEditOpen,
  onEditOpenChange,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  isEditOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
}) {
  const ws = usePetWorkspace();
  const { pet } = ws;
  const { upcoming, vaccineSummary, activeMeds } = hubDerived(
    pet,
    ws.vaccines,
    ws.reminders,
    ws.medications,
  );
  const { score: profileScore, missing } = profileCompleteness(
    pet,
    ws.docs,
    ws.vaccines,
    ws.visits,
  );

  // First due/overdue vaccine with a due date — powers the hero's
  // add-to-calendar control (#29/#50 wiring, preserved from the hub page).
  const nextVaccineEvent = useMemo(() => {
    const next = ws.vaccines
      .filter(
        (v) =>
          v.dueAt !== undefined &&
          (v.status === "due" || v.status === "overdue"),
      )
      .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))[0];
    if (!next || next.dueAt === undefined) return null;
    return vaccinationDueCalendarEvent(
      {
        id: next._id,
        vaccineName: next.vaccineName,
        dueAt: next.dueAt,
        provider: next.provider,
      },
      pet.name,
    );
  }, [ws.vaccines, pet.name]);

  const nextAppointment =
    upcoming.length > 0
      ? {
          title: upcoming[0].title,
          dueAt: upcoming[0].dueAt,
          calendar: reminderCalendarEvent(
            {
              id: upcoming[0]._id,
              title: upcoming[0].title,
              dueAt: upcoming[0].dueAt,
              kind: upcoming[0].kind,
            },
            pet.name,
          ),
        }
      : null;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Breadcrumb back to the hub ancestors: Pets / {pet} */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-ink-soft">
        <Link
          href={ROUTES.dashboard.pets}
          className="rounded-md font-medium hover:text-ink hover:underline"
        >
          Pets
        </Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page" className="truncate font-semibold text-ink">
          {pet.name}
        </span>
      </nav>

      {/* Hero: photo, name, key stats, health score — preserved across all
          tool sub-pages so deep links never lose context. */}
      <PetHero
        pet={pet}
        profileScore={profileScore}
        missingCount={missing.length}
        upcomingCount={upcoming.length}
        nextVaccineEvent={nextVaccineEvent}
        nextAppointment={nextAppointment}
        vaccineSummary={vaccineSummary}
        vaccineCount={ws.vaccines.length}
        activeMedCount={activeMeds.length}
        medCount={ws.medications.length}
        shareHref={petSubrouteHref(pet._id, "share")}
        documentsHref={petSubrouteHref(pet._id, "documents")}
        remindersHref={petSubrouteHref(pet._id, "reminders")}
        onEdit={onEdit}
      />

      <PetToolNav petId={pet._id} />

      {children}

      <EditPetDialog
        pet={pet}
        ownerId={ws.ownerId}
        open={isEditOpen}
        onOpenChange={onEditOpenChange}
        onSaved={(updated) => {
          ws.patchPet(updated);
          void ws.refreshPet();
        }}
      />
    </div>
  );
}

export default function PetProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ petId: string }>;
}) {
  const { petId } = use(params);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const fallbacks = useMemo(
    () => ({
      loading: (
        <div className="flex flex-col gap-6">
          <p role="status" aria-live="polite" className="text-sm text-ink-soft">
            Loading pet health profile…
          </p>
        </div>
      ),
      error: (message: string) => (
        <div className="flex flex-col gap-6">
          <p role="alert" aria-live="assertive" className="text-sm font-medium text-red-600">
            {message}
          </p>
        </div>
      ),
      missing: (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <PetArt name="lost" size={120} />
          <h2 className="mt-4 font-display text-xl font-bold text-ink">Pet not found</h2>
          <p className="mt-1 text-sm text-ink-soft">
            This pet profile may have been removed or transferred.
          </p>
          <Link
            href={ROUTES.dashboard.pets}
            className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to pets
          </Link>
        </div>
      ),
    }),
    [],
  );

  // Demo mode (no Convex URL / session): same placeholder surface the hub
  // page rendered before nested routes existed.
  const backendReady = isBackendConfigured && !!getOwnerId();
  if (!backendReady) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex items-center gap-4">
          <PetArt name="happy" size={80} />
          <div>
            <h1 className="font-display text-2xl font-bold">Pet profile</h1>
            <p className="text-sm text-ink-soft">
              ID: {petId} (wiring lands with Convex)
            </p>
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
              A vaccine cert photo is a perfect start.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <PetWorkspaceProvider
      petId={petId}
      renderFallback={(state) => {
        if (state.phase === "loading") return fallbacks.loading;
        if (state.phase === "error") return fallbacks.error(state.message);
        return fallbacks.missing;
      }}
    >
      <PetHubChrome
        isEditOpen={isEditOpen}
        onEdit={() => setIsEditOpen(true)}
        onEditOpenChange={setIsEditOpen}
      >
        {children}
      </PetHubChrome>
    </PetWorkspaceProvider>
  );
}
