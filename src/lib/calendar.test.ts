import { describe, expect, it } from "vitest";
import {
  buildIcs,
  CALENDAR_UID_DOMAIN,
  escapeIcsText,
  foldIcsLine,
  formatIcsUtc,
  googleCalendarUrl,
  icsFilename,
  outlookCalendarUrl,
  reminderCalendarEvent,
  toIcsUid,
  vaccinationDueCalendarEvent,
  vetVisitCalendarEvent,
  type CalendarEventInput,
} from "@/lib/calendar";

const FIXED_NOW = Date.UTC(2026, 0, 1, 12, 0, 0); // 2026-01-01T12:00:00Z
const START = Date.UTC(2026, 8, 20, 15, 30, 0); // 2026-09-20T15:30:00Z

const baseEvent: CalendarEventInput = {
  uid: "reminder-abc123",
  title: "Rabies booster (Momo)",
  start: START,
};

describe("formatIcsUtc", () => {
  it("formats epoch ms as RFC 5545 UTC DATE-TIME", () => {
    expect(formatIcsUtc(START)).toBe("20260920T153000Z");
    expect(formatIcsUtc(FIXED_NOW)).toBe("20260101T120000Z");
  });
});

describe("escapeIcsText", () => {
  it("escapes backslashes first", () => {
    expect(escapeIcsText("C:\\docs\\file")).toBe("C:\\\\docs\\\\file");
  });

  it("escapes semicolons, commas, and newlines", () => {
    expect(escapeIcsText("a;b,c")).toBe("a\\;b\\,c");
    expect(escapeIcsText("line1\nline2")).toBe("line1\\nline2");
    expect(escapeIcsText("line1\r\nline2")).toBe("line1\\nline2");
  });

  it("handles combined hostile input", () => {
    expect(escapeIcsText("Vet; Dr. Smith, DVM\\best\nok"))
      .toBe("Vet\\; Dr. Smith\\, DVM\\\\best\\nok");
  });
});

describe("foldIcsLine", () => {
  it("leaves short lines untouched", () => {
    expect(foldIcsLine("SUMMARY:short")).toBe("SUMMARY:short");
    expect(foldIcsLine("x".repeat(75))).toBe("x".repeat(75));
  });

  it("folds long lines at 75 chars with space-prefixed continuations", () => {
    const folded = foldIcsLine("y".repeat(200));
    const parts = folded.split("\r\n");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(75); // first line: 75 chars
    expect(parts[1]).toHaveLength(75); // continuation: space + 74 chars
    expect(parts[2]).toHaveLength(52); // final continuation: space + remainder
    for (const part of parts.slice(1)) {
      expect(part).toMatch(/^ /);
      expect(part.length).toBeLessThanOrEqual(75);
    }
    // Unfolding (strip CRLF + leading space) restores the original.
    expect(folded.replace(/\r\n /g, "")).toBe("y".repeat(200));
  });
});

describe("toIcsUid", () => {
  it("is stable for the same input", () => {
    expect(toIcsUid("reminder-abc123")).toBe(toIcsUid("reminder-abc123"));
  });

  it("differs for different inputs", () => {
    expect(toIcsUid("reminder-1")).not.toBe(toIcsUid("reminder-2"));
  });

  it("appends the petdocs domain", () => {
    expect(toIcsUid("reminder-abc123")).toBe(
      `reminder-abc123@${CALENDAR_UID_DOMAIN}`,
    );
  });

  it("sanitizes disallowed characters and lowercases", () => {
    expect(toIcsUid("REMINDER_X:9")).toBe(`reminderx9@${CALENDAR_UID_DOMAIN}`);
  });

  it("falls back to a placeholder when the id is empty", () => {
    expect(toIcsUid("!!!")).toBe(`event@${CALENDAR_UID_DOMAIN}`);
  });
});

describe("buildIcs", () => {
  it("emits the required VEVENT fields and a 60-minute alarm", () => {
    const ics = buildIcs(baseEvent, FIXED_NOW);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//petdocs//Calendar Export 1.0//EN");
    expect(ics).toContain(`UID:reminder-abc123@${CALENDAR_UID_DOMAIN}`);
    expect(ics).toContain("DTSTAMP:20260101T120000Z");
    expect(ics).toContain("DTSTART:20260920T153000Z");
    expect(ics).toContain("DTEND:20260920T163000Z"); // default 1h block
    expect(ics).toContain("SUMMARY:Rabies booster (Momo)");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT60M");
    expect(ics).toContain("ACTION:DISPLAY");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("uses an explicit end when provided", () => {
    const ics = buildIcs(
      { ...baseEvent, end: START + 3 * 60 * 60 * 1000 },
      FIXED_NOW,
    );
    expect(ics).toContain("DTEND:20260920T183000Z");
  });

  it("escapes description text into a single folded line", () => {
    const ics = buildIcs(
      {
        ...baseEvent,
        description: "Bring papers; tags, leash\nand treats",
      },
      FIXED_NOW,
    );
    expect(ics).toContain(
      "DESCRIPTION:Bring papers\\; tags\\, leash\\nand treats",
    );
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it("is deterministic for the same inputs", () => {
    const event = { ...baseEvent, description: "details" };
    expect(buildIcs(event, FIXED_NOW)).toBe(buildIcs(event, FIXED_NOW));
  });
});

describe("googleCalendarUrl", () => {
  it("builds a template URL with text and UTC dates", () => {
    const url = new URL(googleCalendarUrl(baseEvent));
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.pathname).toBe("/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Rabies booster (Momo)");
    expect(url.searchParams.get("dates")).toBe(
      "20260920T153000Z/20260920T163000Z",
    );
  });

  it("passes details and location through", () => {
    const url = new URL(
      googleCalendarUrl({
        ...baseEvent,
        description: "Bring; records",
        location: "Civic Vet, Room 2",
      }),
    );
    expect(url.searchParams.get("details")).toBe("Bring; records");
    expect(url.searchParams.get("location")).toBe("Civic Vet, Room 2");
  });
});

describe("outlookCalendarUrl", () => {
  it("builds an addevent deeplink with ISO datetimes", () => {
    const url = new URL(outlookCalendarUrl(baseEvent));
    expect(url.origin).toBe("https://outlook.live.com");
    expect(url.pathname).toBe("/calendar/0/deeplink/compose");
    expect(url.searchParams.get("path")).toBe("/calendar/action/compose");
    expect(url.searchParams.get("rru")).toBe("addevent");
    expect(url.searchParams.get("subject")).toBe("Rabies booster (Momo)");
    expect(url.searchParams.get("startdt")).toBe("2026-09-20T15:30:00.000Z");
    expect(url.searchParams.get("enddt")).toBe("2026-09-20T16:30:00.000Z");
  });
});

describe("icsFilename", () => {
  it("slugifies titles", () => {
    expect(icsFilename("Rabies booster (Momo)")).toBe(
      "rabies-booster-momo.ics",
    );
    expect(icsFilename("Annual checkup!")).toBe("annual-checkup.ics");
  });

  it("falls back for symbol-only titles", () => {
    expect(icsFilename("!!!")).toBe("petdocs-event.ics");
  });
});

describe("domain factories", () => {
  it("reminderCalendarEvent builds a stable, titled event", () => {
    const event = reminderCalendarEvent(
      {
        id: "jd7k0000000000",
        title: "Annual checkup",
        dueAt: START,
        kind: "vet_visit",
      },
      "Momo",
    );
    expect(event.uid).toBe("reminder-jd7k0000000000");
    expect(event.title).toBe("Annual checkup (Momo)");
    expect(event.start).toBe(START);
    expect(event.description).toContain("vet visit");
    expect(event.description).toContain("Momo");
  });

  it("vaccinationDueCalendarEvent returns null without a due date", () => {
    expect(
      vaccinationDueCalendarEvent(
        { id: "v1", vaccineName: "Rabies" },
        "Momo",
      ),
    ).toBeNull();
  });

  it("vaccinationDueCalendarEvent maps due dates and provider", () => {
    const event = vaccinationDueCalendarEvent(
      {
        id: "v2",
        vaccineName: "DHPP",
        dueAt: START,
        provider: "Civic Vet",
      },
      "Momo",
    );
    expect(event).not.toBeNull();
    expect(event?.uid).toBe("vaccination-v2");
    expect(event?.title).toBe("DHPP due (Momo)");
    expect(event?.description).toContain("at Civic Vet");
  });

  it("vetVisitCalendarEvent maps reason, clinic, and metadata", () => {
    const event = vetVisitCalendarEvent(
      {
        id: "vv9",
        visitedAt: START,
        reason: "Dental cleaning",
        clinicName: "Harbor Animal Hospital",
        vetName: "Dr. Chen",
        diagnosis: "Mild gingivitis",
      },
      "Momo",
    );
    expect(event.uid).toBe("vetvisit-vv9");
    expect(event.title).toBe("Vet visit: Dental cleaning (Momo)");
    expect(event.location).toBe("Harbor Animal Hospital");
    expect(event.description).toContain("Dr. Chen");
    expect(event.description).toContain("Mild gingivitis");
    const ics = buildIcs(event, FIXED_NOW);
    expect(ics).toContain("LOCATION:Harbor Animal Hospital");
    expect(ics).toContain("DTSTART:20260920T153000Z");
  });
});
