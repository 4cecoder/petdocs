"use client";

import { VaccineBadge, type VaccineStatus } from "@/components/pets/VaccineBadge";

export interface ApartmentPacketVaccine {
  name: string;
  status: VaccineStatus;
  administeredAt?: string;
}

export interface ApartmentPacketProps {
  petName: string;
  species: string;
  breed?: string;
  /** ISO date string (YYYY-MM-DD). Age is computed from it. */
  birthdate?: string;
  weightKg?: number;
  /** Last 4 of the microchip number only — never pass the full chip. */
  microchipLast4?: string;
  /** true = spayed/neutered, false = intact, null/undefined = unknown ("Ask vet"). */
  spayNeuter?: boolean | null;
  vaccines: ApartmentPacketVaccine[];
  photoUrl?: string;
}

function formatAge(birthdate?: string): string {
  if (!birthdate) return "—";
  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return "—";
  const now = new Date();
  let months =
    (now.getFullYear() - born.getFullYear()) * 12 +
    (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return "—";
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years} yr` : `${years} yr ${rem} mo`;
}

function formatVaccineDate(administeredAt?: string): string {
  if (!administeredAt) return "—";
  const d = new Date(administeredAt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Printable "Pet Resume" for rental applications.
 * Covers what landlords ask for: breed, weight, age, spay/neuter,
 * vaccines (esp. rabies), microchip, photo.
 * Never renders owner email / phone / address.
 */
export function ApartmentPacket({
  petName,
  species,
  breed,
  birthdate,
  weightKg,
  microchipLast4,
  spayNeuter,
  vaccines,
  photoUrl,
}: ApartmentPacketProps) {
  const spayNeuterLabel =
    spayNeuter === true
      ? "Spayed / Neutered"
      : spayNeuter === false
        ? "Intact"
        : "Ask vet";

  return (
    <article
      aria-label={`${petName}'s pet resume for rental applications`}
      className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm print:border-ink/30 print:p-0 print:shadow-none"
    >
      {/* Header: photo + identity */}
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cream-dark text-4xl print:border print:border-ink/20">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={`Photo of ${petName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">🐾</span>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Pet resume · Rental application
          </p>
          <h2 className="font-display text-2xl font-bold">{petName}</h2>
          <p className="text-sm capitalize text-ink-soft">
            {species}
            {breed ? ` · ${breed}` : ""}
          </p>
        </div>
      </header>

      {/* Fact grid */}
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-cream px-3 py-2.5 print:border print:border-ink/20 print:bg-white">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Age
          </dt>
          <dd className="text-sm font-semibold">{formatAge(birthdate)}</dd>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2.5 print:border print:border-ink/20 print:bg-white">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Weight
          </dt>
          <dd className="text-sm font-semibold">
            {weightKg == null
              ? "—"
              : `${weightKg} kg (${Math.round(weightKg * 2.20462)} lb)`}
          </dd>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2.5 print:border print:border-ink/20 print:bg-white">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Spay / Neuter
          </dt>
          <dd className="text-sm font-semibold">{spayNeuterLabel}</dd>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2.5 print:border print:border-ink/20 print:bg-white">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Microchip
          </dt>
          <dd className="text-sm font-semibold">
            {microchipLast4 ? `••••${microchipLast4.slice(-4)}` : "Not listed"}
          </dd>
        </div>
      </dl>

      {/* Vaccines */}
      <section aria-label="Vaccinations" className="mt-4">
        <h3 className="font-display font-bold">Vaccinations</h3>
        {vaccines.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">
            No vaccination records added yet.
          </p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-soft">
                <th scope="col" className="pb-2 pr-2 font-semibold">
                  Vaccine
                </th>
                <th scope="col" className="pb-2 pr-2 font-semibold">
                  Status
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Given
                </th>
              </tr>
            </thead>
            <tbody>
              {vaccines.map((v) => (
                <tr key={v.name} className="border-t border-ink/10">
                  <td className="py-2 pr-2 font-medium">{v.name}</td>
                  <td className="py-2 pr-2">
                    <VaccineBadge status={v.status} label={v.status} />
                  </td>
                  <td className="py-2 text-ink-soft">
                    {formatVaccineDate(v.administeredAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Landlord CTA — explainer prints, button is screen-only */}
      <section
        aria-label="For landlords"
        className="mt-4 rounded-2xl bg-cream p-4 print:border print:border-ink/20 print:bg-white"
      >
        <h3 className="font-display font-bold">For landlords</h3>
        <p className="mt-1 text-sm text-ink-soft">
          {petName} is part of a documented, vaccinated household. Ask the owner
          for the read-only passport link or vet contact to verify any detail
          above.
        </p>
        {/* TODO(convex): wire to shareLinks.createToken once codegen exists */}
        <button
          type="button"
          className="mt-3 min-h-[48px] w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm font-semibold hover:bg-cream-dark print:hidden sm:w-auto"
        >
          🔗 Copy share link (coming soon)
        </button>
      </section>

      {/* Screen-only: no point printing a print button */}
      <div className="mt-4 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-[48px] w-full rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 sm:w-auto"
        >
          🖨️ Print / Download
        </button>
      </div>
    </article>
  );
}
