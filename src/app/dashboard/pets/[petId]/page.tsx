"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  HeartPulse,
  Pencil,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { PetArt } from "@/components/art/PetArt";
import { DocList, type VaultDoc as VaultDocRow } from "@/components/docs/DocList";
import { DocUploader } from "@/components/docs/DocUploader";
import { OwnershipClaim } from "@/components/pets/OwnershipClaim";
import { PetTimeline, type TimelineEvent } from "@/components/pets/PetTimeline";
import { ShareButton } from "@/components/share/ShareButton";
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
import { cn } from "@/lib/utils";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatAge(birthdate?: number): string {
  if (!birthdate) return "Age not set";
  const diffDays = Math.floor((Date.now() - birthdate) / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365.25);
  const months = Math.floor((diffDays % 365.25) / 30.4375);

  if (years >= 1) {
    return months > 0 && years < 3
      ? `${years} yr${years > 1 ? "s" : ""} ${months} mo${months > 1 ? "s" : ""}`
      : `${years} yr${years > 1 ? "s" : ""} old`;
  }
  if (months >= 1) return `${months} mo${months > 1 ? "s" : ""} old`;
  return `${diffDays} days old`;
}

function getSpeciesEmoji(species: string): string {
  const s = species.toLowerCase();
  if (s === "dog") return "🐕";
  if (s === "cat") return "🐈";
  if (s === "bird") return "🦜";
  if (s === "rabbit") return "🐇";
  if (s === "reptile") return "🦎";
  return "🐾";
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
        title: `${v.vaccineName}: ${v.status}`,
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

interface CareItem {
  id: string;
  title: string;
  description: string;
  category: "checkup" | "vaccine" | "parasite" | "identification";
  isFulfilled: boolean;
}

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
  const [manualCheckOverrides, setManualCheckOverrides] = useState<
    Record<string, boolean>
  >({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editMicrochip, setEditMicrochip] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const uploadSectionRef = useRef<HTMLElement>(null);

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

        if (petRow) {
          setEditName(petRow.name);
          setEditBreed(petRow.breed ?? "");
          setEditWeight(petRow.weightKg ? String(petRow.weightKg) : "");
          setEditMicrochip(petRow.microchipId ?? "");
        }
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

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerId || !backend || !pet) return;
    setEditSaving(true);
    setEditError(null);

    try {
      const weightNum = editWeight ? parseFloat(editWeight) : undefined;
      await api.pets.update({
        ownerId,
        petId,
        name: editName.trim() || pet.name,
        breed: editBreed.trim() || undefined,
        weightKg: Number.isNaN(weightNum) ? undefined : weightNum,
        microchipId: editMicrochip.trim() || undefined,
      });

      setPet((prev) =>
        prev
          ? {
              ...prev,
              name: editName.trim() || prev.name,
              breed: editBreed.trim() || undefined,
              weightKg: Number.isNaN(weightNum) ? undefined : weightNum,
              microchipId: editMicrochip.trim() || undefined,
            }
          : null,
      );
      setIsEditOpen(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update pet.");
    } finally {
      setEditSaving(false);
    }
  }

  // Calculate Profile Completion Score & Recommendations
  const { profileScore, missingRecommendations } = useMemo(() => {
    let score = 0;
    const missing: string[] = [];

    // 1. Basic Details (Name + Breed): 20%
    if (pet?.name && pet?.breed) {
      score += 20;
    } else if (pet?.name) {
      score += 10;
      missing.push("Add pet breed");
    } else {
      missing.push("Complete basic details");
    }

    // 2. Birthdate / Age: 15%
    if (pet?.birthdate) {
      score += 15;
    } else {
      missing.push("Set birthdate or adoption day");
    }

    // 3. Weight: 10%
    if (pet?.weightKg) {
      score += 10;
    } else {
      missing.push("Record current weight");
    }

    // 4. Microchip ID: 15%
    if (pet?.microchipId) {
      score += 15;
    } else {
      missing.push("Register microchip ID");
    }

    // 5. Vaccines recorded: 15%
    if (vaccines.length > 0) {
      score += 15;
    } else {
      missing.push("Log core vaccinations (Rabies / DHPP)");
    }

    // 6. Documents in Vault: 15%
    if (docs.length > 0) {
      score += 15;
    } else {
      missing.push("Upload vet record or certificate");
    }

    // 7. Vet visits logged: 10%
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

  // Recommended Care Checklist calculation
  const careItems = useMemo<CareItem[]>(() => {
    const hasRabies =
      vaccines.some((v) => v.vaccineName.toLowerCase().includes("rabies")) ||
      !!manualCheckOverrides["rabies"];

    const hasDHPP =
      vaccines.some(
        (v) =>
          v.vaccineName.toLowerCase().includes("dhpp") ||
          v.vaccineName.toLowerCase().includes("distemper") ||
          v.vaccineName.toLowerCase().includes("fvrcp") ||
          v.vaccineName.toLowerCase().includes("core"),
      ) || !!manualCheckOverrides["dhpp"];

    const hasWellness =
      visits.length > 0 || !!manualCheckOverrides["wellness"];

    const hasDental =
      visits.some(
        (v) =>
          v.reason.toLowerCase().includes("dental") ||
          v.diagnosis?.toLowerCase().includes("dental"),
      ) || !!manualCheckOverrides["dental"];

    const hasHeartworm =
      medications.some(
        (m) =>
          m.name.toLowerCase().includes("heart") ||
          m.name.toLowerCase().includes("interceptor"),
      ) || !!manualCheckOverrides["heartworm"];

    const hasFleaTick =
      medications.some(
        (m) =>
          m.name.toLowerCase().includes("flea") ||
          m.name.toLowerCase().includes("tick") ||
          m.name.toLowerCase().includes("nexgard") ||
          m.name.toLowerCase().includes("bravecto") ||
          m.name.toLowerCase().includes("simparica"),
      ) || !!manualCheckOverrides["flea_tick"];

    const hasMicrochip = !!pet?.microchipId || !!manualCheckOverrides["microchip"];

    return [
      {
        id: "wellness",
        title: "Annual Wellness Checkup",
        description: "Comprehensive physical exam, weight check & vitals",
        category: "checkup",
        isFulfilled: hasWellness,
      },
      {
        id: "rabies",
        title: "Rabies Core Vaccine",
        description: "Mandatory rabies immunization (1-year or 3-year booster)",
        category: "vaccine",
        isFulfilled: hasRabies,
      },
      {
        id: "dhpp",
        title: pet?.species === "cat" ? "FVRCP Core Vaccine" : "DHPP Core Vaccine",
        description:
          pet?.species === "cat"
            ? "Feline Rhinotracheitis, Calicivirus & Panleukopenia"
            : "Distemper, Hepatitis, Parvovirus & Parainfluenza",
        category: "vaccine",
        isFulfilled: hasDHPP,
      },
      {
        id: "dental",
        title: "Dental Examination",
        description: "Plaque, tartar assessment and gum health inspection",
        category: "checkup",
        isFulfilled: hasDental,
      },
      {
        id: "heartworm",
        title: "Heartworm Prevention",
        description: "Monthly chewable or topical parasite preventive",
        category: "parasite",
        isFulfilled: hasHeartworm,
      },
      {
        id: "flea_tick",
        title: "Flea & Tick Prevention",
        description: "Year-round defense against vector-borne disease",
        category: "parasite",
        isFulfilled: hasFleaTick,
      },
      {
        id: "microchip",
        title: "Microchip Registration",
        description: "Permanent 15-digit ISO identification transponder",
        category: "identification",
        isFulfilled: hasMicrochip,
      },
    ];
  }, [vaccines, visits, medications, pet, manualCheckOverrides]);

  function toggleCareItem(id: string) {
    setManualCheckOverrides((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  // 3-Card Status Summary calculations
  const upcomingAppointments = useMemo(() => {
    const upcomingReminders = reminders.filter((r) => r.status === "scheduled");
    return upcomingReminders.sort((a, b) => a.dueAt - b.dueAt);
  }, [reminders]);

  const activeMeds = useMemo(() => {
    return medications.filter((m) => m.status === "active");
  }, [medications]);

  const vaccineSummary = useMemo(() => {
    const overdue = vaccines.filter((v) => v.status === "overdue");
    const due = vaccines.filter((v) => v.status === "due");
    const administered = vaccines.filter((v) => v.status === "administered");

    if (overdue.length > 0) {
      return {
        label: `${overdue.length} overdue`,
        variant: "warning" as const,
        detail: overdue[0].vaccineName,
      };
    }
    if (due.length > 0) {
      return {
        label: `${due.length} due soon`,
        variant: "due" as const,
        detail: due[0].vaccineName,
      };
    }
    if (administered.length > 0) {
      return {
        label: "Up to date",
        variant: "ok" as const,
        detail: `${administered.length} recorded`,
      };
    }
    return {
      label: "None recorded",
      variant: "neutral" as const,
      detail: "Add vaccine certificate",
    };
  }, [vaccines]);

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

  const timeline = buildTimeline(vaccines, visits, docs);

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Top Header & Clean Action Buttons */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cream-dark text-3xl shadow-inner">
            <span role="img" aria-label={pet.species}>
              {getSpeciesEmoji(pet.species)}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">
                {pet.name}
              </h1>
              <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs font-semibold capitalize text-ink-soft">
                {pet.species}
              </span>
            </div>
            <p className="text-sm text-ink-soft">
              {pet.breed || "Breed unspecified"} · {formatAge(pet.birthdate)}
              {pet.weightKg ? ` · ${pet.weightKg} kg` : ""}
            </p>
          </div>
        </div>

        {/* Action Buttons: Share Passport, Add Document, Edit Pet */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="shrink-0">
            <ShareButton petId={petId} petName={pet.name} />
          </div>

          <button
            type="button"
            onClick={() => {
              uploadSectionRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-xs hover:bg-cream transition"
          >
            <Upload size={16} />
            <span>Add Document</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-xs hover:bg-cream transition"
          >
            <Pencil size={16} />
            <span>Edit Pet</span>
          </button>
        </div>
      </header>

      {/* Total Profile Score Progress Bar */}
      <section
        aria-label="Profile completion"
        className="rounded-2xl border border-brand-500/20 bg-linear-to-br from-brand-50/50 via-white to-cream p-5 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              <h2 className="font-display text-base font-bold text-ink">
                Profile Completeness
              </h2>
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800">
                {profileScore}% Complete
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              A comprehensive profile guarantees emergency preparedness and rapid vet
              admissions.
            </p>
          </div>

          {profileScore === 100 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
              <CheckCircle2 size={16} />
              Fully Documented
            </span>
          ) : (
            <span className="text-xs font-medium text-ink-soft">
              {missingRecommendations.length} item
              {missingRecommendations.length > 1 ? "s" : ""} to 100%
            </span>
          )}
        </div>

        {/* Progress Bar Line */}
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-cream-dark">
          <div
            className="h-full rounded-full bg-linear-to-r from-brand-500 to-teal-600 transition-all duration-500"
            style={{ width: `${profileScore}%` }}
          />
        </div>

        {/* Remaining Recommendations */}
        {missingRecommendations.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 text-xs">
            <span className="font-semibold text-ink-soft mr-1">Recommended:</span>
            {missingRecommendations.map((rec, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-lg bg-white/80 border border-ink/10 px-2.5 py-1 font-medium text-ink"
              >
                + {rec}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 3-Card Status Summary Row */}
      <section
        aria-label="Status Summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {/* Card 1: Upcoming Appointments */}
        <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-white p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Appointments
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Calendar size={18} />
              </div>
            </div>

            <p className="mt-2 font-display text-lg font-bold text-ink">
              {upcomingAppointments.length > 0
                ? `${upcomingAppointments.length} Upcoming`
                : "No visits scheduled"}
            </p>

            <p className="mt-1 text-xs text-ink-soft truncate">
              {upcomingAppointments.length > 0
                ? `${upcomingAppointments[0].title} (${formatDate(upcomingAppointments[0].dueAt)})`
                : "All checkups clear"}
            </p>
          </div>

          <Link
            href={ROUTES.dashboard.reminders}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
          >
            <span>Manage appointments</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Card 2: Vaccine Expirations */}
        <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-white p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Vaccines
              </span>
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  vaccineSummary.variant === "warning"
                    ? "bg-red-50 text-red-600"
                    : vaccineSummary.variant === "due"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-teal-50 text-teal-600",
                )}
              >
                {vaccineSummary.variant === "warning" ? (
                  <ShieldAlert size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )}
              </div>
            </div>

            <p className="mt-2 font-display text-lg font-bold text-ink">
              {vaccineSummary.label}
            </p>

            <p className="mt-1 text-xs text-ink-soft truncate">
              {vaccineSummary.detail}
            </p>
          </div>

          <div className="mt-4 text-xs font-medium text-ink-soft">
            {vaccines.length} total vaccines logged
          </div>
        </div>

        {/* Card 3: Active Medications */}
        <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-white p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Medications
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Pill size={18} />
              </div>
            </div>

            <p className="mt-2 font-display text-lg font-bold text-ink">
              {activeMeds.length > 0
                ? `${activeMeds.length} Active`
                : "No active meds"}
            </p>

            <p className="mt-1 text-xs text-ink-soft truncate">
              {activeMeds.length > 0
                ? activeMeds.map((m) => m.name).join(", ")
                : "No current prescriptions"}
            </p>
          </div>

          <div className="mt-4 text-xs font-medium text-ink-soft">
            {medications.length} total prescribed
          </div>
        </div>
      </section>

      {/* Recommended Care Checklist */}
      <section aria-label="Recommended Care" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-ink flex items-center gap-2">
              <HeartPulse size={20} className="text-brand-600" />
              Recommended Care Checklist
            </h2>
            <p className="text-sm text-ink-soft">
              Veterinary preventive standards based on AAHA and AVMA guidelines.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {careItems.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleCareItem(item.id)}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4 transition cursor-pointer select-none",
                item.isFulfilled
                  ? "border-teal-200 bg-teal-50/40 hover:bg-teal-50/70"
                  : "border-ink/10 bg-white hover:border-brand-300",
              )}
            >
              <button
                type="button"
                aria-label={`Toggle ${item.title}`}
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition",
                  item.isFulfilled
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-ink/20 bg-white text-transparent",
                )}
              >
                <CheckCircle2 size={16} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "font-semibold text-sm",
                      item.isFulfilled ? "text-teal-900" : "text-ink",
                    )}
                  >
                    {item.title}
                  </p>
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                      item.isFulfilled
                        ? "bg-teal-100 text-teal-800"
                        : "bg-amber-100 text-amber-800",
                    )}
                  >
                    {item.isFulfilled ? "Up to date" : "Recommended"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ownership & Transfer Section */}
      <section aria-label="Ownership">
        <OwnershipClaim
          petId={petId}
          petName={pet.name}
          microchipKnown={!!pet.microchipId}
        />
      </section>

      {/* Upload Document Section */}
      <section ref={uploadSectionRef} aria-label="Upload">
        <h2 className="mb-2 font-display text-xl font-bold text-ink">
          Add a document
        </h2>
        <DocUploader petId={petId} onComplete={() => void refetchDocs()} />
      </section>

      {/* Documents Vault Section */}
      <section aria-label="Documents">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-xl font-bold text-ink">
            Vault Documents
          </h2>
          <span className="text-xs text-ink-soft">
            {docs.length} file{docs.length === 1 ? "" : "s"} stored
          </span>
        </div>

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
              A vaccine certificate or vet invoice photo is a great start.
            </p>
          </div>
        ) : (
          <DocList docs={docs.map(toDocRow)} />
        )}
      </section>

      {/* Timeline Section */}
      <section aria-label="Timeline">
        <h2 className="mb-2 font-display text-xl font-bold text-ink">
          Medical History Timeline
        </h2>
        {timeline.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
            <PetArt name="sleepy" size={120} />
            <p className="mt-2 font-display font-bold">Quiet for now</p>
            <p className="text-sm text-ink-soft">
              Uploads, vet visits, and vaccine boosters will appear here in chronological
              order.
            </p>
          </div>
        ) : (
          <PetTimeline events={timeline} />
        )}
      </section>

      {/* Edit Pet Modal Dialog */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-xs"
            onClick={() => !editSaving && setIsEditOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-pet-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl z-10"
          >
            <div className="flex items-center justify-between pb-3 border-b border-ink/10">
              <h2 id="edit-pet-title" className="font-display font-bold text-lg text-ink">
                Edit {pet.name}&apos;s Profile
              </h2>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl p-1 text-ink-soft hover:bg-cream"
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1">
                  Pet Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1">
                  Breed
                </label>
                <input
                  type="text"
                  value={editBreed}
                  onChange={(e) => setEditBreed(e.target.value)}
                  placeholder="e.g. Golden Retriever, French Bulldog"
                  className="w-full rounded-xl border border-ink/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    placeholder="e.g. 12.5"
                    className="w-full rounded-xl border border-ink/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1">
                    Microchip ID
                  </label>
                  <input
                    type="text"
                    value={editMicrochip}
                    onChange={(e) => setEditMicrochip(e.target.value)}
                    placeholder="15-digit ID"
                    className="w-full rounded-xl border border-ink/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 pt-3 border-t border-ink/10">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-ink-soft hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition"
                >
                  {editSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
