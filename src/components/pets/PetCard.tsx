import Link from "next/link";
import { petHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { VaccineBadge, type VaccineStatus } from "./VaccineBadge";

export interface PetCardPet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  photoUrl?: string;
}

export function PetCard({
  pet,
  dueCount = 0,
  vaccineStatus = "valid",
}: {
  pet: PetCardPet;
  dueCount?: number;
  vaccineStatus?: VaccineStatus;
}) {
  return (
    <Link
      href={petHref(pet.id)}
      className="block overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="flex h-32 items-center justify-center bg-cream-dark text-5xl">
        {pet.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pet.photoUrl}
            alt={`${pet.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">🐾</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-4">
        <div>
          <p className="font-display text-lg font-bold">{pet.name}</p>
          <p className="text-sm capitalize text-ink-soft">
            {pet.species}
            {pet.breed ? ` · ${pet.breed}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <VaccineBadge status={vaccineStatus} />
          <span
            className={cn(
              "text-xs font-medium",
              dueCount > 0 ? "text-accent-600" : "text-ink-soft",
            )}
          >
            {dueCount > 0 ? `${dueCount} due soon` : "All clear"}
          </span>
        </div>
      </div>
    </Link>
  );
}
