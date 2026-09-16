"use client";

import { EnrichmentSuggestions } from "../EnrichmentSuggestions";
import DocumentsPanel from "../panels/DocumentsPanel";
import { usePetWorkspace } from "../workspace";

/**
 * Documents tool at /dashboard/pets/[petId]/documents.
 * Uploader + vault list + trash confirm, plus extraction-driven
 * "Add to pet profile" suggestions from processed documents.
 */
export default function PetDocumentsPage() {
  const ws = usePetWorkspace();

  return (
    <div className="flex flex-col gap-6">
      <EnrichmentSuggestions />
      <DocumentsPanel
        petId={ws.petId}
        petName={ws.pet.name}
        ownerId={ws.ownerId}
        docs={ws.docs}
        docsError={ws.docsError}
        onUploadComplete={() => void ws.refreshDocs()}
        onTrash={ws.trashDoc}
      />
    </div>
  );
}
