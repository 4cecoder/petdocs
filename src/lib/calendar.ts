/**
 * One-click add-to-calendar helpers — issue #19 v1 (no OAuth, no
 * bidirectional sync). Google Calendar + Outlook are share-deeplinks; the
 * universal fallback is a standards-compliant ICS (RFC 5545) download with a
 * 60-minute display alarm.
 *
 * Everything here is pure and dependency-free (the only DOM touch is
 * `downloadIcsFile`, guarded for SSR). The `*Like` input shapes structurally
 * match the Convex rows in `convex/reminders.ts`, `convex/vaccinations.ts`,
 * and `convex/vetVisits.ts` (and their client mirrors in `src/lib/api.ts`)
 * without importing them, so unit tests stay hermetic.
 */

export const CALENDAR_UID_DOMAIN = "petdocs.seridian.dev";

const DEFAULT_DURATION_MS = 60 * 60 * 1000; // point events get a 1h block
const RFC5545_MAX_LINE = 75; // SHOULD-limit per RFC 5545 §3.1
const ALARM_TRIGGER = "-PT60M"; // reminder 60 minutes before start

export interface CalendarEventInput {
  /** Stable unique id — becomes the ICS UID (same input ⇒ same UID). */
  uid: string;
  title: string;
  description?: string;
  location?: string;
  /** Epoch milliseconds. */
  start: number;
  /** Epoch milliseconds; defaults to `start + 1h`. */
  end?: number;
  url?: string;
}

/** Structural subset of a `reminders` row (convex/reminders.ts). */
export interface ReminderLike {
  id: string;
  title: string;
  dueAt: number;
  kind?: string;
}

/** Structural subset of a `vaccinations` row (convex/vaccinations.ts). */
export interface VaccinationDueLike {
  id: string;
  vaccineName: string;
  dueAt?: number;
  provider?: string;
}

/** Structural subset of a `vetVisits` row (convex/vetVisits.ts). */
export interface VetVisitLike {
  id: string;
  visitedAt: number;
  reason: string;
  clinicName?: string;
  vetName?: string;
  diagnosis?: string;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Deterministic ICS UID: same document id always yields the same UID, which
 * keeps re-exports as *updates* of the same calendar entry instead of
 * duplicates. `1234` → `1234@petdocs.seridian.dev`.
 */
export function toIcsUid(uid: string): string {
  const sanitized = uid.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${sanitized || "event"}@${CALENDAR_UID_DOMAIN}`;
}

/** Epoch ms → `YYYYMMDDTHHMMSSZ` (UTC, RFC 5545 DATE-TIME). */
export function formatIcsUtc(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** RFC 5545 §3.3.11 TEXT escaping. Backslash must be escaped first. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold content lines longer than 75 chars (RFC 5545 §3.1, CRLF + space). */
export function foldIcsLine(line: string): string {
  if (line.length <= RFC5545_MAX_LINE) return line;
  const chunks: string[] = [line.slice(0, RFC5545_MAX_LINE)];
  let rest = line.slice(RFC5545_MAX_LINE);
  while (rest.length > RFC5545_MAX_LINE - 1) {
    chunks.push(` ${rest.slice(0, RFC5545_MAX_LINE - 1)}`);
    rest = rest.slice(RFC5545_MAX_LINE - 1);
  }
  if (rest.length > 0) chunks.push(` ${rest}`);
  return chunks.join("\r\n");
}

/** Safe download filename for an event title. */
export function icsFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "petdocs-event"}.ics`;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** Build a complete VCALENDAR string (CRLF line endings per RFC 5545). */
export function buildIcs(event: CalendarEventInput, now = Date.now()): string {
  const end = event.end ?? event.start + DEFAULT_DURATION_MS;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//petdocs//Calendar Export 1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${toIcsUid(event.uid)}`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART:${formatIcsUtc(event.start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.description !== undefined && event.description !== "") {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.location !== undefined && event.location !== "") {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  if (event.url !== undefined && event.url !== "") {
    lines.push(`URL:${event.url}`);
  }
  lines.push(
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(event.title)}`,
    `TRIGGER:${ALARM_TRIGGER}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

/** Google Calendar "add event" template URL. */
export function googleCalendarUrl(event: CalendarEventInput): string {
  const end = event.end ?? event.start + DEFAULT_DURATION_MS;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatIcsUtc(event.start)}/${formatIcsUtc(end)}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook web deeplink (compose → add event). */
export function outlookCalendarUrl(event: CalendarEventInput): string {
  const end = event.end ?? event.start + DEFAULT_DURATION_MS;
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: new Date(event.start).toISOString(),
    enddt: new Date(end).toISOString(),
  });
  if (event.description) params.set("body", event.description);
  if (event.location) params.set("location", event.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Trigger a browser download of the event as `.ics`. Client-side only —
 * no-ops during SSR. `now` is injectable for tests.
 */
export function downloadIcsFile(
  event: CalendarEventInput,
  now?: number,
): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([buildIcs(event, now)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = icsFilename(event.title);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Domain factories (reminders / vaccination due dates / vet visits)
// ---------------------------------------------------------------------------

/** Calendar event for a reminder row (any kind, incl. vet_visit). */
export function reminderCalendarEvent(
  reminder: ReminderLike,
  petName: string,
): CalendarEventInput {
  const kindLabel = reminder.kind ? reminder.kind.replace(/_/g, " ") : "custom";
  return {
    uid: `reminder-${reminder.id}`,
    title: `${reminder.title} (${petName})`,
    description: `petdocs reminder (${kindLabel}) for ${petName}. Manage it at ${CALENDAR_UID_DOMAIN}/dashboard/reminders.`,
    start: reminder.dueAt,
  };
}

/** Calendar event for a vaccination due date; null when no due date is set. */
export function vaccinationDueCalendarEvent(
  vaccination: VaccinationDueLike,
  petName: string,
): CalendarEventInput | null {
  if (vaccination.dueAt === undefined) return null;
  const providerNote = vaccination.provider ? ` at ${vaccination.provider}` : "";
  return {
    uid: `vaccination-${vaccination.id}`,
    title: `${vaccination.vaccineName} due (${petName})`,
    description: `${vaccination.vaccineName} is due for ${petName}${providerNote}. Track boosters in your petdocs vault.`,
    start: vaccination.dueAt,
  };
}

/** Calendar event for a vet visit (clinic as location). */
export function vetVisitCalendarEvent(
  visit: VetVisitLike,
  petName: string,
): CalendarEventInput {
  const detail = [visit.clinicName, visit.vetName, visit.diagnosis]
    .filter(Boolean)
    .join(" · ");
  return {
    uid: `vetvisit-${visit.id}`,
    title: `Vet visit: ${visit.reason} (${petName})`,
    description: detail
      ? `${detail}\nLogged in petdocs.`
      : "Logged in petdocs.",
    location: visit.clinicName,
    start: visit.visitedAt,
  };
}
