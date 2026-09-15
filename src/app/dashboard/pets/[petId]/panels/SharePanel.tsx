"use client";

import { ShareButton } from "@/components/share/ShareButton";

/** Share tool: the 3-step passport link wizard. */
export default function SharePanel({
  petId,
  petName,
}: {
  petId: string;
  petName: string;
}) {
  return (
    <section aria-label="Share passport" className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">
          Share {petName}&apos;s passport
        </h2>
        <p className="text-sm text-ink-soft">
          A read-only link for vets, groomers, or landlords — revoke anytime.
        </p>
      </div>
      <ShareButton petId={petId} petName={petName} />
    </section>
  );
}
