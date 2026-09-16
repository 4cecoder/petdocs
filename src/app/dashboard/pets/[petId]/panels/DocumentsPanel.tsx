"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  EmptyState,
} from "@seridian/ui-kit";
import { PetArt } from "@/components/art/PetArt";
import { DocList, type VaultDoc as VaultDocRow } from "@/components/docs/DocList";
import { DocUploader } from "@/components/docs/DocUploader";
import { formatBytes, formatDate } from "../fmt";
import type { VaultDoc } from "@/lib/api";

function toDocRow(doc: VaultDoc): VaultDocRow {
  return {
    id: doc._id,
    documentId: doc._id,
    name: doc.name,
    mime: doc.mime,
    category: doc.category ?? "other",
    date: formatDate(doc.createdAt),
    sizeLabel: formatBytes(doc.size),
  };
}

/** Documents tool: uploader + vault list, with a confirm before trashing. */
export default function DocumentsPanel({
  petId,
  petName,
  ownerId,
  docs,
  docsError,
  onUploadComplete,
  onTrash,
}: {
  petId: string;
  petName: string;
  ownerId: string;
  docs: VaultDoc[];
  docsError: string | null;
  onUploadComplete: () => void;
  onTrash: (docId: string) => Promise<void>;
}) {
  const uploaderRef = useRef<HTMLDivElement>(null);
  const [pendingTrash, setPendingTrash] = useState<VaultDoc | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);

  function focusUploader() {
    uploaderRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    uploaderRef.current?.querySelector("button")?.focus();
  }

  async function confirmTrash() {
    if (!pendingTrash) return;
    setTrashError(null);
    try {
      await onTrash(pendingTrash._id);
      setPendingTrash(null);
    } catch (e: unknown) {
      setTrashError(
        e instanceof Error
          ? `Couldn’t move the document to trash: ${e.message}`
          : "Couldn’t move the document to trash. Check your connection and try again.",
      );
    }
  }

  return (
    <section aria-label="Documents" className="flex flex-col gap-4">
      <div ref={uploaderRef}>
        <DocUploader petId={petId} onComplete={() => onUploadComplete()} />
      </div>

      {docsError ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {docsError}
        </p>
      ) : null}

      {trashError ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {trashError}
        </p>
      ) : null}

      {docs.length === 0 ? (
        <EmptyState
          icon={<PetArt name="camera" size={110} aria-hidden="true" />}
          title="Snap your first doc"
          description={`A vaccine certificate or vet invoice photo is a great start for ${petName}'s vault.`}
          actions={
            <button
              type="button"
              onClick={focusUploader}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 transition"
            >
              <Camera size={16} aria-hidden="true" />
              Add your first document
            </button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">
              Vault documents
            </h2>
            <span className="text-xs text-ink-soft">
              {docs.length} file{docs.length === 1 ? "" : "s"} stored
            </span>
          </div>
          <DocList
            docs={docs.map(toDocRow)}
            ownerId={ownerId}
            onTrash={(id) => {
              setTrashError(null);
              setPendingTrash(docs.find((d) => d._id === id) ?? null);
            }}
          />
        </>
      )}

      {/* Destructive confirm: trashing a document is instant, so gate it. */}
      <AlertDialog
        open={pendingTrash !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTrash(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move “{pendingTrash?.name}” to trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the document from {petName}&apos;s vault. Anyone with
              a shared passport link will no longer see it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => void confirmTrash()}
            >
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
