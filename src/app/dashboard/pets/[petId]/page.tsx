"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  FileText,
  HeartPulse,
  History,
  ShieldCheck,
  Share2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@seridian/ui-kit";
import { PetArt } from "@/components/art/PetArt";
import { DocUploader } from "@/components/docs/DocUploader";
import { ShareButton } from "@/components/share/ShareButton";
import { EditPetDialog } from "./EditPetDialog";
import { PetHero, type VaccineSummary } from "./PetHero";
import {
  reminderCalendarEvent,
  vaccinationDueCalendarEvent,
} from "@/lib/calendar";
import {
  api,
  getOwnerId,
  isBackendConfigured,
  type Medication,
  type Pet,
  type Reminder,
  type Vaccination,
  type VaultDoc,
  type VetVisit,
} from "@/lib/api";
import { ROUTES } from "@/lib/routes";

/**
 * Tool panels are code-split AND only mounted when their tool is active
 * (Radix Tabs unmounts inactive panels), so the hero paints first and each
 * tool loads its own section lazily.
 */
const DocumentsPanel = dynamic(() => import("./panels/DocumentsPanel"), {
  ssr: false,
  loading: () => <PanelSkeleton label="Loading documents…" />,
});
const SharePanel = dynamic(() => import("./panels/SharePanel"), {
  ssr: false,
  loading: () => <PanelSkeleton label="Loading share…" />,
});
const TimelinePanel = dynamic(() => import("./panels/TimelinePanel"), {
  ssr: false,
  loading: () => <PanelSkeleton label="Loading timeline…" />,
});
const CarePanel = dynamic(() => import("./panels/CarePanel"), {
  ssr: false,
  loading: () => <PanelSkeleton label="Loading care checklist…" />,
});
const OwnershipPanel = dynamic(() => import("./panels/OwnershipPanel"), {
  ssr: false,
  loading: () => <PanelSkeleton label="Loading ownership…" />,
});

function PanelSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[220px] flex-col gap-3 rounded-2xl border border-ink/10 bg-white/60 p-5"
    >
      <span className="text-sm text-ink-soft">{label}</span>
      <div className="h-20 animate-pulse rounded-2xl bg-cream-dark/70" />
      <div className="h-12 animate-pulse rounded-2xl bg-cream-dark/50" />
    </div>
  );
}

type ToolKey = "documents" | "share" | "timeline" | "care" | "ownership";

const TOOLS: Array<{
  key: ToolKey;
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  { key: "documents", label: "Documents", hint: "Vault & uploads", icon: FileText },
  { key: "share", label: "Share", hint: "Read-only passport links", icon: Share2 },
  { key: "timeline", label: "Timeline", hint: "Vaccines, visits, uploads", icon: History },
  { key: "care", label: "Care", hint: "Preventive care checklist", icon: HeartPulse },
  { key: "ownership", label: "Ownership", hint: "Transfer & claims", icon: ShieldCheck },
];

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
  const [medications, setMedications] = useState<Medication[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Hub state: which tool panel is open ("" = none — hero + grid only).
  const [activeTool, setActiveTool] = useState<ToolKey | "">("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
      api.medications.list(ownerId, petId),
      api.reminders.listByPet(ownerId, petId),
    ])
      .then(([petRow, docRows, vaccineRows, visitRows, medRows, reminderRows]) => {
        if (cancelled) return;
        setPet(petRow);
        setDocs(docRows);
        setVaccines(vaccineRows);
        setVisits(visitRows);
        setMedications(medRows);
        setReminders(reminderRows);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load pet.");
        }
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

  async function handleTrashDoc(docId: string) {
    if (!ownerId) return;
    try {
      await api.documents.moveToTrash(ownerId, docId);
    } catch {
      // optimistic update
    }
    setDocs((prev) => prev.filter((d) => d._id !== docId));
  }

  /** Switch to a tool and bring its focused view into view. */
  function openTool(tool: ToolKey) {
    setActiveTool(tool);
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Profile completeness score (hero health score).
  const { profileScore, missingRecommendations } = useMemo(() => {
    let score = 0;
    const missing: string[] = [];

    if (pet?.name && pet?.breed) {
      score += 20;
    } else if (pet?.name) {
      score += 10;
      missing.push("Add pet breed");
    } else {
      missing.push("Complete basic details");
    }

    if (pet?.birthdate) {
      score += 15;
    } else {
      missing.push("Set birthdate or adoption day");
    }

    if (pet?.weightKg) {
      score += 10;
    } else {
      missing.push("Record current weight");
    }

    if (pet?.microchipId) {
      score += 15;
    } else {
      missing.push("Register microchip ID");
    }

    if (vaccines.length > 0) {
      score += 15;
    } else {
      missing.push("Log core vaccinations (Rabies / DHPP)");
    }

    if (docs.length > 0) {
      score += 15;
    } else {
      missing.push("Upload vet record or certificate");
    }

    if (visits.length > 0) {
      score += 10;
    } else {
      missing.push("Record first wellness visit");
    }

    return {
      profileScore: Math.min(100, score),
      missingRecommendations: missing,
    };
  }, [pet, vaccines, docs, visits]);

  const upcomingAppointments = useMemo(() => {
    return reminders
      .filter((r) => r.status === "scheduled")
      .sort((a, b) => a.dueAt - b.dueAt);
  }, [reminders]);

  const activeMeds = useMemo(() => {
    return medications.filter((m) => m.status === "active");
  }, [medications]);

  const vaccineSummary = useMemo<VaccineSummary>(() => {
    const overdue = vaccines.filter((v) => v.status === "overdue");
    const due = vaccines.filter((v) => v.status === "due");
    const administered = vaccines.filter((v) => v.status === "administered");

    if (overdue.length > 0) {
      return {
        label: `${overdue.length} overdue`,
        variant: "warning",
        detail: overdue[0].vaccineName,
      };
    }
    if (due.length > 0) {
      return {
        label: `${due.length} due soon`,
        variant: "due",
        detail: due[0].vaccineName,
      };
    }
    if (administered.length > 0) {
      return {
        label: "Up to date",
        variant: "ok",
        detail: `${administered.length} recorded`,
      };
    }
    return {
      label: "None recorded",
      variant: "neutral",
      detail: "Add vaccine certificate",
    };
  }, [vaccines]);

  // First due/overdue vaccine with a due date — powers the card's
  // add-to-calendar control.
  const nextDueVaccineEvent = useMemo(() => {
    const next = vaccines
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
      pet?.name ?? "your pet",
    );
  }, [vaccines, pet]);

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
              A vaccine cert photo is a perfect start.
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
          Loading pet health profile…
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
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Hero: photo, name, key stats, health score — nothing competes. */}
      <PetHero
        pet={pet}
        profileScore={profileScore}
        missingCount={missingRecommendations.length}
        upcomingCount={upcomingAppointments.length}
        nextVaccineEvent={nextDueVaccineEvent}
        nextAppointment={
          upcomingAppointments.length > 0
            ? {
                title: upcomingAppointments[0].title,
                dueAt: upcomingAppointments[0].dueAt,
                calendar: reminderCalendarEvent(
                  {
                    id: upcomingAppointments[0]._id,
                    title: upcomingAppointments[0].title,
                    dueAt: upcomingAppointments[0].dueAt,
                    kind: upcomingAppointments[0].kind,
                  },
                  pet.name,
                ),
              }
            : null
        }
        vaccineSummary={vaccineSummary}
        vaccineCount={vaccines.length}
        activeMedCount={activeMeds.length}
        medCount={medications.length}
        onShare={() => openTool("share")}
        onAddDocument={() => openTool("documents")}
        onEdit={() => setIsEditOpen(true)}
      />

      {/* Tools grid: each tile opens a focused, lazily-loaded view. */}
      <Tabs
        value={activeTool}
        onValueChange={(value) => setActiveTool(value as ToolKey | "")}
        className="flex flex-col gap-6"
      >
        <TabsList
          className="grid h-auto w-full grid-cols-2 gap-3 rounded-3xl border-0 bg-transparent p-0 sm:grid-cols-3 lg:grid-cols-5"
          aria-label="Pet tools"
        >
          {TOOLS.map((tool) => (
            <TabsTrigger
              key={tool.key}
              value={tool.key}
              className="h-auto w-full flex-col items-start justify-start gap-1 rounded-2xl border border-ink/10 bg-white p-4 text-left shadow-xs transition data-[state=active]:border-brand-500/60 data-[state=active]:bg-brand-50/60"
            >
              <tool.icon
                size={20}
                aria-hidden="true"
                className="text-brand-600"
              />
              <span className="font-display text-sm font-bold text-ink">
                {tool.label}
              </span>
              <span className="text-xs font-normal text-ink-soft">
                {tool.hint}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div ref={panelRef} className="scroll-mt-24">
          <TabsContent value="documents">
            <DocumentsPanel
              petId={petId}
              petName={pet.name}
              docs={docs}
              docsError={docsError}
              onUploadComplete={() => void refetchDocs()}
              onTrash={handleTrashDoc}
            />
          </TabsContent>

          <TabsContent value="share">
            <SharePanel petId={petId} petName={pet.name} />
          </TabsContent>

          <TabsContent value="timeline">
            <TimelinePanel
              vaccines={vaccines}
              visits={visits}
              docs={docs}
              petName={pet.name}
              onAddDocument={() => openTool("documents")}
            />
          </TabsContent>

          <TabsContent value="care">
            <CarePanel
              pet={pet}
              vaccines={vaccines}
              visits={visits}
              medications={medications}
              missingRecommendations={missingRecommendations}
            />
          </TabsContent>

          <TabsContent value="ownership">
            <OwnershipPanel
              petId={petId}
              petName={pet.name}
              microchipKnown={!!pet.microchipId}
            />
          </TabsContent>
        </div>
      </Tabs>

      <EditPetDialog
        pet={pet}
        ownerId={ownerId}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSaved={(updated) => {
          setPet((prev) => (prev ? { ...prev, ...updated } : prev));
          setIsEditOpen(false);
        }}
      />
    </div>
  );
}
