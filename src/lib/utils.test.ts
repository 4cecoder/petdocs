import { describe, expect, test } from "vitest";
import { humanDuration, msUntilUtcMidnight, utcDayKey } from "./utils";

describe("utcDayKey", () => {
  test("formats the UTC date as YYYY-MM-DD", () => {
    expect(utcDayKey(new Date(Date.UTC(2026, 8, 15, 12, 30)))).toBe(
      "2026-09-15",
    );
  });

  test("rolls over exactly at UTC midnight", () => {
    expect(utcDayKey(new Date(Date.UTC(2026, 8, 15, 23, 59, 59, 999)))).toBe(
      "2026-09-15",
    );
    expect(utcDayKey(new Date(Date.UTC(2026, 8, 16, 0, 0, 0, 0)))).toBe(
      "2026-09-16",
    );
  });

  test("keys on UTC, not local time (a 20:00Z instant is next day in UTC+8)", () => {
    expect(utcDayKey(new Date(Date.UTC(2026, 8, 15, 20, 0, 0)))).toBe(
      "2026-09-15",
    );
    expect(utcDayKey(new Date("2026-09-16T01:30:00+08:00"))).toBe("2026-09-15");
  });
});

describe("msUntilUtcMidnight", () => {
  test("measures the gap to the next UTC midnight", () => {
    const noon = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));
    expect(msUntilUtcMidnight(noon)).toBe(12 * 60 * 60 * 1000);
  });

  test("one millisecond before midnight is 1ms", () => {
    const almost = new Date(Date.UTC(2026, 8, 15, 23, 59, 59, 999));
    expect(msUntilUtcMidnight(almost)).toBe(1);
  });

  test("at exactly midnight the reset is a full day away", () => {
    const midnight = new Date(Date.UTC(2026, 8, 16, 0, 0, 0));
    expect(msUntilUtcMidnight(midnight)).toBe(24 * 60 * 60 * 1000);
  });
});

describe("humanDuration", () => {
  test("renders hours and minutes", () => {
    expect(humanDuration((6 * 60 + 12) * 60_000)).toBe("6h 12m");
  });

  test("renders sub-hour gaps in minutes", () => {
    expect(humanDuration(45 * 60_000)).toBe("45m");
  });

  test("clamps tiny gaps to at least one minute", () => {
    expect(humanDuration(0)).toBe("1m");
  });
});
