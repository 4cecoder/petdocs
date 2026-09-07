import { describe, expect, it } from "vitest";
import { findDates, parseCertText, parseMedLabel, parseMicrochip } from "./parsers";

describe("parseCertText", () => {
  it("parses a full rabies cert block with high confidence", () => {
    const out = parseCertText(
      "RABIES VACCINATION CERTIFICATE\nGiven: 03/15/2024\nHappy Paws Animal Hospital\nLot A1B2C3\n",
    );
    expect(out.vaccineName).toBe("Rabies");
    expect(out.administeredAt).toBe("2024-03-15");
    expect(out.provider).toContain("Happy Paws");
    expect(out.lot).toBe("A1B2C3");
    expect(out.confidence).toBe("high");
    expect(out.unmatched).toEqual([]);
  });

  it("matches abbreviated DHPP (DA2PP) with medium confidence", () => {
    const out = parseCertText("DA2PP booster\nDate: 06/01/2024\n");
    expect(out.vaccineName).toBe("DHPP");
    expect(out.administeredAt).toBe("2024-06-01");
    expect(out.provider).toBeUndefined();
    expect(out.confidence).toBe("medium");
  });

  it("prefers a labeled administered date over other dates", () => {
    const out = parseCertText(
      "Bordetella\nExpires 01/10/2026\nAdministered: 02/20/2024\n",
    );
    expect(out.vaccineName).toBe("Bordetella");
    expect(out.administeredAt).toBe("2024-02-20");
  });

  it("falls back to the latest past date and ignores future dates", () => {
    const out = parseCertText("Lyme\n01/05/2023\n04/11/2024\n01/01/2099\n");
    expect(out.administeredAt).toBe("2024-04-11");
  });

  it("finds a DVM provider line and a Lot token", () => {
    const out = parseCertText(
      "FeLV vaccine\nDate: 09/09/2024\nDr Smith, DVM\nLot #XZ-99\n",
    );
    expect(out.provider).toContain("DVM");
    expect(out.lot).toBe("XZ-99");
    expect(out.confidence).toBe("high");
  });

  it("collects unmatched lines capped at 5", () => {
    const out = parseCertText("a\nb\nc\nd\ne\nf\ng\n");
    expect(out.confidence).toBe("low");
    expect(out.unmatched).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("returns low confidence for empty text", () => {
    const out = parseCertText("   \n ");
    expect(out).toMatchObject({ confidence: "low", unmatched: [] });
    expect(out.vaccineName).toBeUndefined();
    expect(out.administeredAt).toBeUndefined();
  });
});

describe("parseMedLabel", () => {
  it("parses a BID med label with high confidence", () => {
    const out = parseMedLabel(
      "AMOXICILLIN\n250 mg capsules\nGive one capsule by mouth twice daily\n",
    );
    expect(out.name).toBe("AMOXICILLIN");
    expect(out.dosage).toBe("250 mg");
    expect(out.frequency).toBe("twice_daily");
    expect(out.confidence).toBe("high");
  });

  it("maps q24h/SID wording to once_daily", () => {
    expect(parseMedLabel("OTIC OINTMENT\nGive SID with food").frequency).toBe("once_daily");
    expect(parseMedLabel("PREDNISONE 5MG\nq24h").frequency).toBe("once_daily");
  });

  it("maps weekly, monthly, and as-needed wording", () => {
    expect(parseMedLabel("SELAMECTIN\nApply monthly").frequency).toBe("monthly");
    expect(parseMedLabel("CHEMO DRUG\nGive weekly").frequency).toBe("weekly");
    expect(parseMedLabel("GABAPENTIN 100MG\nGive as needed").frequency).toBe("as_needed");
  });

  it("returns low confidence when no name, dosage, or frequency is found", () => {
    expect(parseMedLabel("fluffy is a good cat").confidence).toBe("low");
    expect(parseMedLabel("").confidence).toBe("low");
  });
});

describe("parseMicrochip", () => {
  it("prefers a 15-digit chip starting with 9", () => {
    expect(parseMicrochip("Chip: 985141012345678")).toBe("985141012345678");
  });

  it("falls back to 10-digit then 9-digit runs, null when absent", () => {
    expect(parseMicrochip("id 1234567890 ok")).toBe("1234567890");
    expect(parseMicrochip("tag 123456789 end")).toBe("123456789");
    expect(parseMicrochip("no chip here")).toBeNull();
  });
});

describe("findDates", () => {
  it("normalizes MM/DD/YYYY, Mon DD YYYY, and ISO, sorted and deduped", () => {
    expect(findDates("Seen Mar 5 2024, again 03/05/2024, then 2024-01-02")).toEqual([
      "2024-01-02",
      "2024-03-05",
    ]);
  });

  it("handles full month names and rejects invalid dates", () => {
    expect(findDates("December 25, 2024")).toEqual(["2024-12-25"]);
    expect(findDates("02/30/2024")).toEqual([]);
  });
});
