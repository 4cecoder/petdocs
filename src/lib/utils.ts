/** Minimal classnames joiner (no ui-kit dep in petdocs). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * UTC day key ("YYYY-MM-DD") — matches the backend's `todayUtc`
 * (convex/outboxQuota.ts) so clients address the same daily counter bucket.
 * The email quota rolls over exactly at UTC midnight.
 */
export function utcDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Milliseconds from now until the next UTC midnight (>= 1ms). */
export function msUntilUtcMidnight(now: Date = new Date()): number {
  const nextMidnight =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) +
    86_400_000;
  return Math.max(1, nextMidnight - now.getTime());
}

/** "6h 12m"-style human gap, coarse (hours + minutes). */
export function humanDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
