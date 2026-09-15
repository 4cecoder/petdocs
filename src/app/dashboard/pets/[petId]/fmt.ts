/** Shared formatting helpers for the pet profile hub (hero + tool panels). */

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function formatAge(birthdate?: number): string {
  if (!birthdate) return "Age not set";
  const diffDays = Math.floor((Date.now() - birthdate) / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365.25);
  const months = Math.floor((diffDays % 365.25) / 30.4375);

  if (years >= 1) {
    return months > 0 && years < 3
      ? `${years} yr${years > 1 ? "s" : ""} ${months} mo${months > 1 ? "s" : ""}`
      : `${years} yr${years > 1 ? "s" : ""} old`;
  }
  if (months >= 1) return `${months} mo${months > 1 ? "s" : ""} old`;
  return `${diffDays} days old`;
}

export function getSpeciesEmoji(species: string): string {
  const s = species.toLowerCase();
  if (s === "dog") return "🐕";
  if (s === "cat") return "🐈";
  if (s === "bird") return "🦜";
  if (s === "rabbit") return "🐇";
  if (s === "reptile") return "🦎";
  return "🐾";
}
