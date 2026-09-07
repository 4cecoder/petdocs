/** Minimal classnames joiner (no ui-kit dep in petdocs). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
