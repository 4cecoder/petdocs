"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
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

export interface PetWorkspace {
  petId: string;
  ownerId: string;
  pet: Pet;
  docs: VaultDoc[];
  vaccines: Vaccination[];
  visits: VetVisit[];
  medications: Medication[];
  reminders: Reminder[];
  docsError: string | null;
  refreshPet: () => Promise<void>;
  refreshDocs: () => Promise<void>;
  refreshVaccines: () => Promise<void>;
  refreshVisits: () => Promise<void>;
  refreshMedications: () => Promise<void>;
  refreshReminders: () => Promise<void>;
  trashDoc: (docId: string) => Promise<void>;
  patchPet: (patch: Partial<Pick<Pet, "name" | "breed" | "weightKg" | "microchipId">>) => void;
}

const PetWorkspaceContext = createContext<PetWorkspace | null>(null);

export function usePetWorkspace(): PetWorkspace {
  const ctx = useContext(PetWorkspaceContext);
  if (!ctx) {
    throw new Error("usePetWorkspace must be used inside a pet profile route");
  }
  return ctx;
}

/**
 * Shared data layer for the pet profile hub and its nested tool pages
 * (/vaccinations, /medications, /visits, /documents, /share, /reminders).
 * Loads once per pet and exposes per-list refreshers so sub-pages can
 * update their slice after a create without refetching the world.
 *
 * While loading/error/not-found, children are NOT rendered — sub-pages can
 * assume a fully loaded workspace in their body.
 */
export function PetWorkspaceProvider({
  petId,
  children,
  renderFallback,
}: {
  petId: string;
  children: ReactNode;
  renderFallback: (state: { phase: "loading" } | { phase: "error"; message: string } | { phase: "missing" }) => ReactNode;
}) {
  const ownerId = getOwnerId();
  const backend = isBackendConfigured;

  const [pet, setPet] = useState<Pet | null>(null);
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [vaccines, setVaccines] = useState<Vaccination[]>([]);
  const [visits, setVisits] = useState<VetVisit[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!ownerId || !backend) return;
    let cancelled = false;
    setLoadError(null);

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
        setMissing(!petRow);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Could not load pet.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ownerId, backend, petId]);

  const refreshPet = useCallback(async () => {
    if (!ownerId || !backend) return;
    try {
      const row = await api.pets.get(ownerId, petId);
      if (row) setPet(row);
    } catch {
      /* keep stale row */
    }
  }, [ownerId, backend, petId]);

  const refreshDocs = useCallback(async () => {
    if (!ownerId || !backend) return;
    setDocsError(null);
    try {
      setDocs(await api.documents.list(ownerId, petId));
    } catch (e: unknown) {
      setDocsError(e instanceof Error ? e.message : "Could not refresh documents.");
    }
  }, [ownerId, backend, petId]);

  const refreshVaccines = useCallback(async () => {
    if (!ownerId || !backend) return;
    try {
      setVaccines(await api.vaccinations.list(ownerId, petId));
    } catch {
      /* keep stale list */
    }
  }, [ownerId, backend, petId]);

  const refreshVisits = useCallback(async () => {
    if (!ownerId || !backend) return;
    try {
      setVisits(await api.visits.list(ownerId, petId));
    } catch {
      /* keep stale list */
    }
  }, [ownerId, backend, petId]);

  const refreshMedications = useCallback(async () => {
    if (!ownerId || !backend) return;
    try {
      setMedications(await api.medications.list(ownerId, petId));
    } catch {
      /* keep stale list */
    }
  }, [ownerId, backend, petId]);

  const refreshReminders = useCallback(async () => {
    if (!ownerId || !backend) return;
    try {
      setReminders(await api.reminders.listByPet(ownerId, petId));
    } catch {
      /* keep stale list */
    }
  }, [ownerId, backend, petId]);

  const trashDoc = useCallback(
    async (docId: string) => {
      if (!ownerId) return;
      try {
        await api.documents.moveToTrash(ownerId, docId);
      } catch (e: unknown) {
        setDocsError(
          e instanceof Error
            ? `Couldn’t move the document to trash: ${e.message}`
            : "Couldn’t move the document to trash. Check your connection and try again.",
        );
        throw e;
      }
      setDocs((prev) => prev.filter((d) => d._id !== docId));
    },
    [ownerId],
  );

  const patchPet = useCallback(
    (patch: Parameters<PetWorkspace["patchPet"]>[0]) => {
      setPet((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [],
  );

  const workspace = useMemo<PetWorkspace | null>(() => {
    if (!pet || !ownerId) return null;
    return {
      petId,
      ownerId,
      pet,
      docs,
      vaccines,
      visits,
      medications,
      reminders,
      docsError,
      refreshPet,
      refreshDocs,
      refreshVaccines,
      refreshVisits,
      refreshMedications,
      refreshReminders,
      trashDoc,
      patchPet,
    };
  }, [
    pet,
    ownerId,
    petId,
    docs,
    vaccines,
    visits,
    medications,
    reminders,
    docsError,
    refreshPet,
    refreshDocs,
    refreshVaccines,
    refreshVisits,
    refreshMedications,
    refreshReminders,
    trashDoc,
    patchPet,
  ]);

  const value = useMemo(() => {
    if (workspace) return { phase: "ready" as const, workspace };
    if (missing) return { phase: "missing" as const };
    if (loadError) return { phase: "error" as const, message: loadError };
    return { phase: "loading" as const };
  }, [workspace, missing, loadError]);

  if (value.phase !== "ready") {
    return (
      <PetWorkspaceContext.Provider value={null}>
        {renderFallback(value)}
      </PetWorkspaceContext.Provider>
    );
  }

  return (
    <PetWorkspaceContext.Provider value={value.workspace}>
      {children}
    </PetWorkspaceContext.Provider>
  );
}
