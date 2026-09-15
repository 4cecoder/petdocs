"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, HeartPulse, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Medication, Pet, Vaccination, VetVisit } from "@/lib/api";

interface CareItem {
  id: string;
  title: string;
  description: string;
  category: "checkup" | "vaccine" | "parasite" | "identification";
  isFulfilled: boolean;
}

/** Care tool: preventive-care checklist + what's missing for a 100% profile. */
export default function CarePanel({
  pet,
  vaccines,
  visits,
  medications,
  missingRecommendations,
}: {
  pet: Pet;
  vaccines: Vaccination[];
  visits: VetVisit[];
  medications: Medication[];
  missingRecommendations: string[];
}) {
  const [manualCheckOverrides, setManualCheckOverrides] = useState<
    Record<string, boolean>
  >({});

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

    const hasWellness = visits.length > 0 || !!manualCheckOverrides["wellness"];

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

    const hasMicrochip = !!pet.microchipId || !!manualCheckOverrides["microchip"];

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
        title: pet.species === "cat" ? "FVRCP Core Vaccine" : "DHPP Core Vaccine",
        description:
          pet.species === "cat"
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
    setManualCheckOverrides((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <section aria-label="Care checklist" className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <HeartPulse size={18} aria-hidden="true" className="text-brand-600" />
          Recommended care checklist
        </h2>
        <p className="text-sm text-ink-soft">
          Veterinary preventive standards based on AAHA and AVMA guidelines.
          Tap an item to mark it handled.
        </p>
      </div>

      {missingRecommendations.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Sparkles size={15} aria-hidden="true" />
            To reach a 100% profile for {pet.name}:
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {missingRecommendations.map((rec) => (
              <li
                key={rec}
                className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-ink"
              >
                + {rec}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {careItems.map((item) => (
          <button
            key={item.id}
            type="button"
            role="checkbox"
            aria-checked={item.isFulfilled}
            aria-label={`${item.title}: ${item.isFulfilled ? "up to date" : "recommended"}`}
            onClick={() => toggleCareItem(item.id)}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4 text-left transition select-none",
              item.isFulfilled
                ? "border-teal-200 bg-teal-50/40 hover:bg-teal-50/70"
                : "border-ink/10 bg-white hover:border-brand-300",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition",
                item.isFulfilled
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-ink/20 bg-white text-transparent",
              )}
            >
              <CheckCircle2 size={16} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    item.isFulfilled ? "text-teal-900" : "text-ink",
                  )}
                >
                  {item.title}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    item.isFulfilled
                      ? "bg-teal-100 text-teal-800"
                      : "bg-amber-100 text-amber-800",
                  )}
                >
                  {item.isFulfilled ? "Up to date" : "Recommended"}
                </span>
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                {item.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
