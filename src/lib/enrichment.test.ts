import { describe, expect, it } from "vitest";
import {
  buildDocSuggestions,
  buildSuggestionsForDocs,
  parseLooseDate,
} from "./enrichment";
import type { DocPipelineMetadata } from "./api";

function meta(
  type: DocPipelineMetadata["type"],
  fields: Array<[string, string]>,
  overrides: Partial<DocPipelineMetadata> = {},
): DocPipelineMetadata {
  return {
    type,
    confidence: 0.9,
    needsReview: false,
    processedAt: Date.now(),
    fields: fields.map(([label, value]) => ({ label, value })),
    ...overrides,
  };
}

describe("parseLooseDate", () => {
  it("parses ISO dates", () => {
    expect(parseLooseDate("2026-03-05")).toBe(Date.parse("2026-03-05"));
  });

  it("parses US dates", () => {
    expect(parseLooseDate("3/5/2026")).toBe(Date.parse("03/05/2026"));
  });

  it("parses long-form dates", () => {
    expect(parseLooseDate("Jan 5, 2026")).toBe(Date.parse("Jan 5, 2026"));
  });

  it("parses loose month + year to the first of the month", () => {
    expect(parseLooseDate("Sep 2026")).toBe(Date.parse("Sep 1, 2026"));
  });

  it("parses month + day in the current year", () => {
    expect(parseLooseDate("Mar 5")).toBe(
      Date.parse(`Mar 5, ${new Date().getFullYear()}`),
    );
  });

  it("returns null for prose or empty values", () => {
    expect(parseLooseDate("within 6 months")).toBeNull();
    expect(parseLooseDate("")).toBeNull();
  });
});

describe("buildDocSuggestions", () => {
  it("returns nothing for unprocessed or field-less docs", () => {
    expect(buildDocSuggestions({ _id: "d1", name: "a.pdf" })).toEqual([]);
    expect(
      buildDocSuggestions({
        _id: "d1",
        name: "a.pdf",
        metadata: meta("other", []),
      }),
    ).toEqual([]);
  });

  it("suggests a vaccination with date and provider from a cert", () => {
    const doc = {
      _id: "doc1",
      name: "rabies-cert.pdf",
      metadata: meta("vaccination", [
        ["Vaccine", "Rabies"],
        ["Pet name", "Miso"],
        ["Date", "2026-02-14"],
        ["Clinic", "Riverside Animal Clinic"],
        ["Veterinarian", "Dr. Kim, DVM"],
        ["Next due", "2027-02-14"],
      ]),
    };
    const s = buildDocSuggestions(doc);
    const vaccination = s.find((x) => x.kind === "vaccination");
    expect(vaccination).toMatchObject({
      vaccineName: "Rabies",
      administeredAt: Date.parse("2026-02-14"),
      provider: "Dr. Kim, DVM",
    });
    expect(s.some((x) => x.kind === "reminder" && x.dueAt === Date.parse("2027-02-14"))).toBe(
      true,
    );
    expect(s.some((x) => x.kind === "pet_name" && x.value === "Miso")).toBe(true);
    // Vaccination docs do not double-book the clinic as a visit.
    expect(s.some((x) => x.kind === "visit")).toBe(false);
  });

  it("suppresses pet-name suggestions matching the current pet name", () => {
    const doc = {
      _id: "doc2",
      name: "intake.pdf",
      metadata: meta("other", [["Pet name", "Miso"]]),
    };
    expect(buildDocSuggestions(doc, { currentPetName: "Miso" }).some(
      (x) => x.kind === "pet_name",
    )).toBe(false);
    expect(buildDocSuggestions(doc, { currentPetName: "miso " }).some(
      (x) => x.kind === "pet_name",
    )).toBe(false);
    expect(buildDocSuggestions(doc, { currentPetName: "Biscuit" }).some(
      (x) => x.kind === "pet_name",
    )).toBe(true);
  });

  it("maps medication docs with dosage and known frequencies", () => {
    const doc = {
      _id: "doc3",
      name: "rx.pdf",
      metadata: meta("medication", [
        ["Medication", "Interceptor"],
        ["Dosage", "6.5 mg"],
        ["Frequency", "monthly"],
      ]),
    };
    const s = buildDocSuggestions(doc);
    expect(s.find((x) => x.kind === "medication")).toMatchObject({
      value: "Interceptor",
      dosage: "6.5 mg",
      frequency: "monthly",
    });
  });

  it("falls back to an honest dosage when none was extracted", () => {
    const doc = {
      _id: "doc4",
      name: "rx.pdf",
      metadata: meta("medication", [["Medication", "Apoquel"]]),
    };
    expect(buildDocSuggestions(doc).find((x) => x.kind === "medication")).toMatchObject({
      dosage: "unspecified",
      frequency: undefined,
    });
  });

  it("logs a visit for vet_visit docs with clinic/vet/date", () => {
    const doc = {
      _id: "doc5",
      name: "invoice.pdf",
      metadata: meta("vet_visit", [
        ["Clinic", "Lakeview Vet Hospital"],
        ["Veterinarian", "Dr. Patel"],
        ["Date", "Jan 5, 2026"],
        ["Next visit", "Jul 2026"],
      ]),
    };
    const s = buildDocSuggestions(doc);
    expect(s.find((x) => x.kind === "visit")).toMatchObject({
      clinicName: "Lakeview Vet Hospital",
      vetName: "Dr. Patel",
      visitedAt: Date.parse("Jan 5, 2026"),
    });
    expect(s.find((x) => x.kind === "reminder")).toMatchObject({
      reminderKind: "vet_visit",
      dueAt: Date.parse("Jul 1, 2026"),
    });
  });

  it("suggests weight only when a sane number is present", () => {
    const withWeight = {
      _id: "doc6",
      name: "chart.pdf",
      metadata: meta("lab", [["Weight", "4.8 kg"]]),
    };
    expect(buildDocSuggestions(withWeight).find((x) => x.kind === "pet_weight")).toMatchObject(
      { value: "4.8" },
    );

    const junk = {
      _id: "doc7",
      name: "chart.pdf",
      metadata: meta("lab", [["Weight", "heavy"]]),
    };
    expect(buildDocSuggestions(junk).some((x) => x.kind === "pet_weight")).toBe(false);
  });

  it("converts recognized pounds to kilograms and rejects unsupported units", () => {
    const pounds = {
      _id: "doc9",
      name: "chart.pdf",
      metadata: meta("lab", [["Weight", "10 lb"]]),
    };
    expect(buildDocSuggestions(pounds).find((x) => x.kind === "pet_weight")).toMatchObject({
      value: String(10 * 0.45359237),
    });

    const unsupported = {
      _id: "doc10",
      name: "chart.pdf",
      metadata: meta("lab", [["Weight", "10 stone"]]),
    };
    expect(buildDocSuggestions(unsupported).some((x) => x.kind === "pet_weight")).toBe(false);
  });

  it("does not make direct medication or visit suggestions without required input", () => {
    const medicationDoc = {
      _id: "doc11",
      name: "record.pdf",
      metadata: meta("vet_visit", [
        ["Medication", "Apoquel"],
      ]),
    };
    const medicationSuggestions = buildDocSuggestions(medicationDoc);
    expect(medicationSuggestions.find((x) => x.kind === "medication")).toMatchObject({
      frequency: undefined,
    });

    const visitDoc = {
      _id: "doc12",
      name: "visit.pdf",
      metadata: meta("vet_visit", [["Clinic", "Lakeview Vet Hospital"]]),
    };
    const visitSuggestions = buildDocSuggestions(visitDoc);
    expect(visitSuggestions.find((x) => x.kind === "visit")).toMatchObject({
      visitedAt: undefined,
    });
  });

  it("skips reminder suggestions whose dates are unparseable prose", () => {
    const doc = {
      _id: "doc8",
      name: "cert.pdf",
      metadata: meta("vaccination", [
        ["Vaccine", "Bordetella"],
        ["Next due", "within 6 months"],
      ]),
    };
    expect(buildDocSuggestions(doc).some((x) => x.kind === "reminder")).toBe(false);
  });
});

describe("buildSuggestionsForDocs", () => {
  it("flattens across docs with stable keys", () => {
    const docs = [
      {
        _id: "a",
        name: "a.pdf",
        metadata: meta("vaccination", [["Vaccine", "Rabies"]]),
      },
      { _id: "b", name: "b.pdf" },
      {
        _id: "c",
        name: "c.pdf",
        metadata: meta("medication", [["Medication", "Apoquel"]]),
      },
    ];
    const all = buildSuggestionsForDocs(docs, { currentPetName: "Miso" });
    expect(all.map((x) => x.kind)).toEqual(["vaccination", "medication"]);
    expect(all.every((x) => x.key.startsWith(x.docId + ":"))).toBe(true);
  });
});
