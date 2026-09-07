import { describe, expect, it } from "vitest";
import { nextDueVaccine, suggestCategory, VACCINE_SCHEDULES } from "./classify";

describe("suggestCategory filenames", () => {
  it("classifies a rabies filename as vaccine_record", () => {
    const out = suggestCategory({ filename: "rabies_cert.pdf", mime: "application/pdf" });
    expect(out.category).toBe("vaccine_record");
    expect(["high", "medium"]).toContain(out.confidence);
    expect(out.reason).toMatch(/rabies/i);
  });

  it("classifies DHPP and Bordetella filenames as vaccine_record", () => {
    expect(
      suggestCategory({ filename: "DHPP_booster.pdf", mime: "application/pdf" }).category,
    ).toBe("vaccine_record");
    expect(
      suggestCategory({ filename: "bordetella-shot.pdf", mime: "application/pdf" }).category,
    ).toBe("vaccine_record");
  });

  it("classifies an FVRCP filename as vaccine_record", () => {
    const out = suggestCategory({ filename: "fvrcp_record.pdf", mime: "application/pdf" });
    expect(out.category).toBe("vaccine_record");
    expect(out.reason).toMatch(/fvrcp/i);
  });

  it("classifies an Rx Apoquel filename as prescription", () => {
    const out = suggestCategory({ filename: "rx_apoquel.pdf", mime: "application/pdf" });
    expect(out.category).toBe("prescription");
    expect(["high", "medium"]).toContain(out.confidence);
  });

  it("classifies a microchip filename as microchip", () => {
    const out = suggestCategory({ filename: "microchip_certificate.pdf", mime: "application/pdf" });
    expect(out.category).toBe("microchip");
    expect(out.confidence).toBe("high");
  });

  it("classifies USDA and insurance and lab filenames", () => {
    expect(
      suggestCategory({ filename: "usda_health_cert.pdf", mime: "application/pdf" }).category,
    ).toBe("travel_certificate");
    expect(
      suggestCategory({ filename: "insurance_policy.pdf", mime: "application/pdf" }).category,
    ).toBe("insurance");
    expect(
      suggestCategory({ filename: "bloodwork_panel.pdf", mime: "application/pdf" }).category,
    ).toBe("lab_result");
  });
});

describe("suggestCategory textHint and mime", () => {
  it("uses parseCertText hit with a year in the reason", () => {
    const out = suggestCategory({
      filename: "scan.pdf",
      mime: "application/pdf",
      textHint: "RABIES VACCINATION CERTIFICATE\nGiven: 03/15/2025\nHappy Paws Animal Hospital\nLot A1B2",
    });
    expect(out.category).toBe("vaccine_record");
    expect(out.confidence).toBe("high");
    expect(out.reason).toMatch(/Rabies/);
    expect(out.reason).toMatch(/2025/);
  });

  it("lets textHint override a conflicting filename", () => {
    const out = suggestCategory({
      filename: "policy.pdf",
      mime: "application/pdf",
      textHint: "Rabies vaccine given 2025-03-01 at Riverside Clinic lot X1",
    });
    expect(out.category).toBe("vaccine_record");
  });

  it("confirms prescription with parseMedLabel for high confidence", () => {
    const out = suggestCategory({
      filename: "scan.pdf",
      mime: "application/pdf",
      textHint: "AMOXICILLIN\n250 mg capsules\nGive one capsule by mouth twice daily\nRefills: 1\nRx #123",
    });
    expect(out.category).toBe("prescription");
    expect(out.confidence).toBe("high");
  });

  it("detects a chip number in textHint", () => {
    const out = suggestCategory({
      filename: "scan.pdf",
      mime: "application/pdf",
      textHint: "Chip: 985141012345678",
    });
    expect(out.category).toBe("microchip");
    expect(out.confidence).toBe("high");
  });

  it("falls back to photo for generic image mime", () => {
    const out = suggestCategory({ filename: "scan", mime: "image/jpeg" });
    expect(out.category).toBe("photo");
  });

  it("classifies a photo filename as photo", () => {
    const out = suggestCategory({ filename: "IMG_1234.jpg", mime: "image/jpeg" });
    expect(out.category).toBe("photo");
    expect(["high", "medium"]).toContain(out.confidence);
  });

  it("returns other with low confidence when nothing matches", () => {
    const out = suggestCategory({
      filename: "random_notes.pdf",
      mime: "application/pdf",
      textHint: "fluffy is a good cat",
    });
    expect(out).toMatchObject({ category: "other", confidence: "low" });
    expect(out.reason).toMatch(/No document keywords/i);
  });
});

describe("VACCINE_SCHEDULES", () => {
  it("has dog and cat intervals", () => {
    const dog = Object.fromEntries(VACCINE_SCHEDULES.dog.map((s) => [s.name, s.everyMonths]));
    expect(dog).toMatchObject({ Rabies: 12, DHPP: 12, Bordetella: 6, Lyme: 12 });
    const cat = Object.fromEntries(VACCINE_SCHEDULES.cat.map((s) => [s.name, s.everyMonths]));
    expect(cat).toMatchObject({ Rabies: 12, FVRCP: 12, FeLV: 12 });
  });
});

describe("nextDueVaccine", () => {
  it("adds 12 months for Rabies", () => {
    expect(nextDueVaccine([{ name: "Rabies", administeredAt: "2024-03-15" }], "dog")).toEqual([
      { name: "Rabies", dueAt: "2025-03-15" },
    ]);
  });

  it("adds 6 months for Bordetella", () => {
    expect(nextDueVaccine([{ name: "Bordetella", administeredAt: "2024-01-15" }], "dog")).toEqual([
      { name: "Bordetella", dueAt: "2024-07-15" },
    ]);
  });

  it("computes cat FVRCP dues", () => {
    expect(nextDueVaccine([{ name: "FVRCP", administeredAt: "2024-05-10" }], "cat")).toEqual([
      { name: "FVRCP", dueAt: "2025-05-10" },
    ]);
  });

  it("returns [] for unknown species", () => {
    expect(nextDueVaccine([{ name: "Rabies", administeredAt: "2024-01-01" }], "bird")).toEqual([]);
    expect(nextDueVaccine([{ name: "Rabies", administeredAt: "2024-01-01" }], "lizard")).toEqual([]);
  });

  it("skips unknown vaccine names", () => {
    const out = nextDueVaccine(
      [
        { name: "Unicorn Shot", administeredAt: "2024-01-01" },
        { name: "Rabies", administeredAt: "2024-01-01" },
      ],
      "dog",
    );
    expect(out).toEqual([{ name: "Rabies", dueAt: "2025-01-01" }]);
  });

  it("picks the latest dose and matches names case insensitively", () => {
    const out = nextDueVaccine(
      [
        { name: "rabies", administeredAt: "2023-01-01" },
        { name: "Rabies", administeredAt: "2024-02-10" },
      ],
      "DOG",
    );
    expect(out).toEqual([{ name: "Rabies", dueAt: "2025-02-10" }]);
  });

  it("skips invalid dates", () => {
    expect(nextDueVaccine([{ name: "Rabies", administeredAt: "not-a-date" }], "dog")).toEqual([]);
  });
});
