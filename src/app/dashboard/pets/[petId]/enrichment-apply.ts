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
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const suggestions = buildSuggestionsForDocs(ws.docs as VaultDoc[], {
    currentPetName: ws.pet.name,
  }).filter((s) => !appliedKeys.has(s.key));

  const apply = useCallback(
    async (s: EnrichmentSuggestion) => {
      setBusyKey(s.key);
      setErrorKey(null);
      try {
        await applySuggestion(ws, s);
        appliedKeys.add(s.key);
        force((n) => n + 1);
      } catch (e: unknown) {
        setErrorKey(
          e instanceof Error ? `${s.key}:${e.message}` : `${s.key}:failed`,
        );
      } finally {
        setBusyKey(null);
      }
    },
    [ws],
  );

  return {
    suggestions,
    apply,
    busyKey,
    isApplied: (key: string) => appliedKeys.has(key),
    errorFor: (key: string) =>
      errorKey?.startsWith(`${key}:`) ? errorKey.slice(key.length + 1) : null,
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
      await api.medications.create({
        ownerId,
        petId,
        name: s.value ?? "Medication",
        dosage: s.dosage ?? "unspecified",
        frequency: s.frequency ?? "once_daily",
      });
      await ws.refreshMedications();
      break;
    case "visit":
      await api.visits.create({
        ownerId,
        petId,
        visitedAt: s.visitedAt ?? Date.now(),
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
