"use client";

import OwnershipPanel from "./panels/OwnershipPanel";
import CarePanel from "./panels/CarePanel";
import TimelinePanel from "./panels/TimelinePanel";
import { EnrichmentSuggestions } from "./EnrichmentSuggestions";
import { profileCompleteness } from "./completeness";
import { petSubrouteHref } from "@/lib/routes";
import { usePetWorkspace } from "./workspace";

/**
 * Overview hub at /dashboard/pets/[petId].
 *
 * The hero, tool navigation, and edit dialog live in the shared layout so
 * every nested tool page (/vaccinations, /medications, /visits, /documents,
 * /share, /reminders) keeps the pet context. This page adds the hub-only
 * views: extraction suggestions, the medical history timeline, the care
 * checklist, and ownership transfer.
 */
export default function PetOverviewPage() {
  const ws = usePetWorkspace();
  const { missing } = profileCompleteness(ws.pet, ws.docs, ws.vaccines, ws.visits);

  return (
    <div className="flex flex-col gap-8">
      <EnrichmentSuggestions />

      <TimelinePanel
        vaccines={ws.vaccines}
        visits={ws.visits}
        docs={ws.docs}
        petName={ws.pet.name}
        documentsHref={petSubrouteHref(ws.petId, "documents")}
      />

      <CarePanel
        pet={ws.pet}
        vaccines={ws.vaccines}
        visits={ws.visits}
        medications={ws.medications}
        missingRecommendations={missing}
      />

      <OwnershipPanel
        petId={ws.petId}
        petName={ws.pet.name}
        microchipKnown={!!ws.pet.microchipId}
      />
    </div>
  );
}
