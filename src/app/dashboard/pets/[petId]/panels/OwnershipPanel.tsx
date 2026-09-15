"use client";

import { OwnershipClaim } from "@/components/pets/OwnershipClaim";

/** Ownership tool: transfer/claim KYC card. */
export default function OwnershipPanel({
  petId,
  petName,
  microchipKnown,
}: {
  petId: string;
  petName: string;
  microchipKnown: boolean;
}) {
  return (
    <section aria-label="Ownership" className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">
          Ownership &amp; transfer
        </h2>
        <p className="text-sm text-ink-soft">
          Prove you own {petName} to claim this profile or accept a transfer.
        </p>
      </div>
      <OwnershipClaim
        petId={petId}
        petName={petName}
        microchipKnown={microchipKnown}
      />
    </section>
  );
}
