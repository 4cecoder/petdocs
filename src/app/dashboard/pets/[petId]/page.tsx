import { DocList } from "@/components/docs/DocList";
import { DocUploader } from "@/components/docs/DocUploader";
import { PetTimeline } from "@/components/pets/PetTimeline";
import { ShareButton } from "@/components/share/ShareButton";

/**
 * Pet profile: header + tabs (Timeline | Docs | Reminders) + share.
 * TODO(convex): pets.get + documents.listByPet + vaccinations.listByPet.
 */
export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-cream-dark text-4xl"
        >
          🐾
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Pet profile</h1>
          <p className="text-sm text-ink-soft">ID: {petId} (wiring lands with Convex)</p>
        </div>
      </header>

      <ShareButton petId={petId} petName="your pet" />

      <section aria-label="Upload">
        <h2 className="mb-2 font-display text-lg font-bold">Add a document</h2>
        <DocUploader petId={petId} />
      </section>

      <section aria-label="Documents">
        <h2 className="mb-2 font-display text-lg font-bold">Documents</h2>
        <DocList docs={[]} />
      </section>

      <section aria-label="Timeline">
        <h2 className="mb-2 font-display text-lg font-bold">Timeline</h2>
        <PetTimeline events={[]} />
      </section>
    </div>
  );
}
