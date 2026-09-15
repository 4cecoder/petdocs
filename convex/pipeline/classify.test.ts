/// <reference types="vite/client" />
import { expect, describe, test } from "vitest";
import { classifyDocument } from "./classify";
import { REVIEW_THRESHOLD } from "./types";
import {
  FIXTURE_LOW_SIGNAL_TEXT,
  FIXTURE_LAB_TEXT,
  FIXTURE_MEDICATION_TEXT,
  FIXTURE_VET_VISIT_TEXT,
  FIXTURE_VACCINE_TEXT,
} from "./fixtures";

function fieldOf(fields: { label: string; value: string }[], label: string) {
  return fields.find((f) => f.label === label)?.value;
}

describe("classifyDocument", () => {
  test("vaccination certificate: type, confidence, and key fields", () => {
    const c = classifyDocument(FIXTURE_VACCINE_TEXT, {
      knownPetNames: ["Maple"],
    });
    expect(c.type).toBe("vaccination");
    expect(c.confidence).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
    expect(c.needsReview).toBe(false);
    expect(fieldOf(c.fields, "Vaccine")).toBe("Rabies");
    expect(fieldOf(c.fields, "Pet name")).toBe("Maple");
    expect(fieldOf(c.fields, "Date")).toBe("03/14/2026");
    expect(fieldOf(c.fields, "Next due")).toContain("03/14/2027");
    expect(fieldOf(c.fields, "Clinic")).toMatch(/veterinary clinic/i);
    expect(fieldOf(c.fields, "Veterinarian")).toContain("Elena Ruiz");
  });

  test("medication prescription: dosage and frequency extracted", () => {
    const c = classifyDocument(FIXTURE_MEDICATION_TEXT);
    expect(c.type).toBe("medication");
    expect(c.needsReview).toBe(false);
    expect(fieldOf(c.fields, "Medication")).toBe("Amoxicillin");
    expect(fieldOf(c.fields, "Dosage")).toBe("125 mg");
    expect(fieldOf(c.fields, "Frequency")).toBe("twice daily");
    expect(fieldOf(c.fields, "Date")).toBe("2026-02-02");
  });

  test("lab result: test name and result extracted", () => {
    const c = classifyDocument(FIXTURE_LAB_TEXT);
    expect(c.type).toBe("lab");
    expect(c.needsReview).toBe(false);
    expect(fieldOf(c.fields, "Test")).toBe("Complete Blood Count");
    expect(fieldOf(c.fields, "Result")).toBe("within normal limits");
    expect(fieldOf(c.fields, "Date")).toContain("September 2, 2026");
  });

  test("vet visit: clinic, vet, and follow-up date extracted", () => {
    const c = classifyDocument(FIXTURE_VET_VISIT_TEXT, {
      knownPetNames: ["Maple"],
    });
    expect(c.type).toBe("vet_visit");
    expect(c.needsReview).toBe(false);
    expect(fieldOf(c.fields, "Clinic")).toMatch(/animal hospital/i);
    expect(fieldOf(c.fields, "Veterinarian")).toContain("Patel");
    expect(fieldOf(c.fields, "Next visit")).toContain("10/10/2026");
    expect(fieldOf(c.fields, "Pet name")).toBe("Maple");
  });

  test("unrelated text classifies as other and needs review", () => {
    const c = classifyDocument(FIXTURE_LOW_SIGNAL_TEXT);
    expect(c.type).toBe("other");
    expect(c.confidence).toBeLessThan(REVIEW_THRESHOLD);
    expect(c.needsReview).toBe(true);
  });

  test("empty text classifies as other with minimal confidence", () => {
    const c = classifyDocument("");
    expect(c.type).toBe("other");
    expect(c.confidence).toBeLessThan(REVIEW_THRESHOLD);
    expect(c.needsReview).toBe(true);
    expect(c.fields).toEqual([]);
  });

  test("known pet name hint wins for unlabeled docs", () => {
    const text = "Patient presented for a rabies booster. Vim was calm.";
    const c = classifyDocument(text, { knownPetNames: ["Vim"] });
    expect(c.type).toBe("vaccination");
    expect(fieldOf(c.fields, "Pet name")).toBe("Vim");
  });

  test("labeled pet name beats known-name hint", () => {
    const c = classifyDocument(FIXTURE_VACCINE_TEXT, {
      knownPetNames: ["Biscuit"],
    });
    expect(fieldOf(c.fields, "Pet name")).toBe("Maple");
  });

  test("confidence grows with signal count", () => {
    const weak = classifyDocument("vaccine given"); // 1-2 signals
    const strong = classifyDocument(FIXTURE_VACCINE_TEXT); // many signals
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
    expect(weak.confidence).toBeGreaterThanOrEqual(0.45);
  });
});
