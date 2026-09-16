import { describe, expect, it } from "vitest";
import { dateValueToTs } from "./tool-dialog";

describe("dateValueToTs", () => {
  it("parses date-only dialog values at local midnight", () => {
    const value = dateValueToTs("2026-03-05");
    expect(value).toBe(new Date(2026, 2, 5).getTime());
    expect(new Date(value!).getHours()).toBe(0);
  });

  it("rejects invalid date-only values", () => {
    expect(dateValueToTs("2026-02-30")).toBeUndefined();
  });
});
