/** Owner manages active share links. TODO(convex): shareLinks.listByPet + revoke. */
import { ApartmentPacket } from "@/components/share/ApartmentPacket";

export default function SharePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Shared links</h1>
      <p className="text-sm text-ink-soft">
        One link per recipient — revoke one without breaking the others.
      </p>
      <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-8 text-center text-sm text-ink-soft">
        No active links yet. Create one from a pet&apos;s profile.
      </div>

      <section aria-label="Apartment packet" className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-bold">Apartment packet</h2>
        <p className="text-sm text-ink-soft">
          A printable pet resume for rental applications.
        </p>
        {/* TODO(convex): wire pets.get + vaccinations.listByPet, replace DEMO props below. */}
        <ApartmentPacket
          petName="Mochi"
          species="dog"
          breed="Shiba Inu"
          birthdate="2021-04-12"
          weightKg={9}
          microchipLast4="1234"
          spayNeuter={true}
          vaccines={[
            { name: "Rabies", status: "valid", administeredAt: "2025-06-01" },
            { name: "DHPP", status: "valid", administeredAt: "2025-06-01" },
            { name: "Bordetella", status: "expiring" },
          ]}
        />
      </section>
    </div>
  );
}
