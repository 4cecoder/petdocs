import type { Pet } from "@/lib/api";

/**
 * Profile completeness scoring (hero health bar + care gaps).
 * Shared by the pet hub layout (score bar) and overview (missing list).
 */
export function profileCompleteness(
  pet: Pet,
  docs: unknown[],
  vaccines: unknown[],
  visits: unknown[],
): { score: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];

  if (pet.name && pet.breed) {
    score += 20;
  } else if (pet.name) {
    score += 10;
    missing.push("Add pet breed");
  } else {
    missing.push("Complete basic details");
  }

  if (pet.birthdate) {
    score += 15;
  } else {
    missing.push("Set birthdate or adoption day");
  }

  if (pet.weightKg) {
    score += 10;
  } else {
    missing.push("Record current weight");
  }

  if (pet.microchipId) {
    score += 15;
  } else {
    missing.push("Register microchip ID");
  }

  if (vaccines.length > 0) {
    score += 15;
  } else {
    missing.push("Log core vaccinations (Rabies / DHPP)");
  }

  if (docs.length > 0) {
    score += 15;
  } else {
    missing.push("Upload vet record or certificate");
  }

  if (visits.length > 0) {
    score += 10;
  } else {
    missing.push("Record first wellness visit");
  }

  return { score: Math.min(100, score), missing };
}
