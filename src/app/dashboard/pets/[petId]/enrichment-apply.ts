"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { EnrichmentSuggestion } from "@/lib/enrichment";
import { buildSuggestionsForDocs } from "@/lib/enrichment";
import type { VaultDoc } from "@/lib/api";
import { usePetWorkspace } from "./workspace";
import type { PetWorkspace } from "./workspace";

/**
 * Session-scoped record of applied suggestions. Client-only UX affordance:
 * the backend does not track "applied" state (extraction stays untouched),
 * so a chip stays checked for the current browser session once used.
 */
const appliedKeys = new Set<string>();

export function useEnrichment() {
  const ws = usePetWorkspace();
  const [, force] = useState(0);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Map<string, string>>(() => new Map());

  const suggestions = buildSuggestionsForDocs(ws.docs as VaultDoc[], {
    currentPetName: ws.pet.name,
  }).filter((s) => !appliedKeys.has(s.key));

  const apply = useCallback(
    async (s: EnrichmentSuggestion) => {
      setBusyKeys((current) => new Set(current).add(s.key));
      setErrors((current) => {
        const next = new Map(current);
        next.delete(s.key);
        return next;
      });
      try {
        await applySuggestion(ws, s);
        appliedKeys.add(s.key);
        force((n) => n + 1);
      } catch (e: unknown) {
        setErrors((current) =>
          new Map(current).set(
            s.key,
            e instanceof Error ? e.message : "Could not apply suggestion.",
          ),
        );
      } finally {
        setBusyKeys((current) => {
          const next = new Set(current);
          next.delete(s.key);
          return next;
        });
      }
    },
    [ws],
  );

  return {
    suggestions,
    apply,
    busyKeys,
    isBusy: (key: string) => busyKeys.has(key),
    isApplied: (key: string) => appliedKeys.has(key),
    errorFor: (key: string) => errors.get(key) ?? null,
    petId: ws.petId,
  };
}

async function applySuggestion(
  ws: PetWorkspace,
  s: EnrichmentSuggestion,
): Promise<void> {
  const { ownerId, petId } = ws;
  switch (s.kind) {
    case "pet_name":
      await api.pets.update({ ownerId, petId, name: s.value ?? "" });
      await ws.refreshPet();
      break;
    case "pet_breed":
      await api.pets.update({ ownerId, petId, breed: s.value });
      await ws.refreshPet();
      break;
    case "pet_weight":
      await api.pets.update({
        ownerId,
        petId,
        weightKg: s.value ? Number(s.value) : undefined,
      });
      await ws.refreshPet();
      break;
    case "vaccination": {
      const vaccinationId = await api.vaccinations.create({
        ownerId,
        petId,
        vaccineName: s.vaccineName ?? "Vaccination",
        provider: s.provider,
        suggestionKey: s.key,
      });
      if (s.administeredAt) {
        await api.vaccinations.markAdministered({
          ownerId,
          vaccinationId,
          administeredAt: s.administeredAt,
        });
      }
      await ws.refreshVaccines();
      break;
    }
    case "medication":
      if (!s.frequency) {
        throw new Error(
          "Frequency was not recognized. Open Medications to choose one before saving.",
        );
      }
      await api.medications.create({
        ownerId,
        petId,
        name: s.value ?? "Medication",
        dosage: s.dosage ?? "unspecified",
        frequency: s.frequency,
      });
      await ws.refreshMedications();
      break;
    case "visit":
      if (s.visitedAt === undefined) {
        throw new Error(
          "The document has no visit date. Open Visits to enter one before saving.",
        );
      }
      await api.visits.create({
        ownerId,
        petId,
        visitedAt: s.visitedAt,
        reason: `Vet visit (from ${s.docName})`,
        clinicName: s.clinicName,
        vetName: s.vetName,
      });
      await ws.refreshVisits();
      break;
    case "reminder":
      await api.reminders.create({
        ownerId,
        petId,
        kind: s.reminderKind ?? "custom",
        title: s.value ?? "Follow-up",
        dueAt: s.dueAt ?? Date.now(),
      });
      await ws.refreshReminders();
      break;
  }
}
