/**
 * Doc-driven profile enrichment (issue #41).
 *
 * Consumes the extracted metadata produced by convex/docPipeline.ts
 * (READ-ONLY: this module never touches extraction logic) and turns each
 * document's `metadata.fields` into one-click suggestions for the pet
 * profile: name/breed/weight via pets:update, vaccinations, medications,
 * vet visits, and follow-up reminders via the existing create mutations.
 *
 * Field labels mirror convex/pipeline/classify.ts pushField calls:
 *   "Vaccine" | "Pet name" | "Date" | "Next due" | "Clinic" |
 *   "Veterinarian" | "Medication" | "Dosage" | "Frequency" | "Test" |
 *   "Result" | "Next visit" | "Weight" | "Breed"
 */
import type { DocPipelineMetadata } from "@/lib/api";

export type EnrichmentKind =
  | "pet_name"
  | "pet_weight"
  | "pet_breed"
  | "vaccination"
  | "medication"
  | "visit"
  | "reminder";

export interface EnrichmentSuggestion {
  /** Stable apply-tracking key: `${docId}:${fieldSeed}`. */
  key: string;
  kind: EnrichmentKind;
  docId: string;
  docName: string;
  /** Short label for the chip, e.g. "Add vaccination: Rabies". */
  label: string;
  /** Payload pieces, per kind. */
  value?: string;
  vaccineName?: string;
  administeredAt?: number;
  provider?: string;
  dosage?: string;
  frequency?: "once_daily" | "twice_daily" | "weekly" | "monthly" | "as_needed";
  visitedAt?: number;
  clinicName?: string;
  vetName?: string;
  dueAt?: number;
  reminderKind?: "vaccination" | "vet_visit";
}

export type DocType = "vaccination" | "vet_visit" | "medication" | "lab" | "other";

interface DocWithMetadata {
  _id: string;
  name: string;
  metadata?: DocPipelineMetadata;
}

function fieldMap(fields: Array<{ label: string; value: string }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of fields) {
    const label = f.label.trim().toLowerCase();
    if (label && f.value.trim() && !map.has(label)) map.set(label, f.value.trim());
  }
  return map;
}

/**
 * Parses the date shapes the pipeline emits (ISO, US M/D/Y, "Jan 5, 2026",
 * "5 Jan 2026") plus loose "Mon 2026" / "Jan 5" forms. Returns null when
 * the value carries no usable date — a suggestion just omits the date.
 */
export function parseLooseDate(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  // Loose forms first: engines resolve year-less dates to a 2001 fallback,
  // so "Mar 5" must never hit Date.parse directly.
  const monthYear = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})$/i.exec(
    value,
  );
  if (monthYear) {
    const ts = Date.parse(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (!Number.isNaN(ts)) return ts;
  }

  const monthDay = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})$/i.exec(
    value,
  );
  if (monthDay) {
    const ts = Date.parse(`${monthDay[1]} ${monthDay[2]}, ${new Date().getFullYear()}`);
    if (!Number.isNaN(ts)) return ts;
  }

  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return direct;

  return null;
}

function parseWeight(raw: string): { kg: number; source: string } | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilograms?|lb|lbs|pounds?)\b/i.exec(raw);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;

  const unit = m[2].toLowerCase();
  const kg = unit === "lb" || unit === "lbs" || unit.startsWith("pound")
    ? n * 0.45359237
    : n;
  return kg < 500 ? { kg, source: raw.trim() } : null;
}

const FREQUENCY_MAP: Record<string, EnrichmentSuggestion["frequency"]> = {
  once_daily: "once_daily",
  "once a day": "once_daily",
  daily: "once_daily",
  twice_daily: "twice_daily",
  "twice a day": "twice_daily",
  weekly: "weekly",
  "once a week": "weekly",
  monthly: "monthly",
  "once a month": "monthly",
  as_needed: "as_needed",
  "as needed": "as_needed",
  prn: "as_needed",
};

function mapFrequency(raw: string | undefined): EnrichmentSuggestion["frequency"] {
  if (!raw) return undefined;
  return FREQUENCY_MAP[raw.trim().toLowerCase()];
}

/**
 * Builds the one-click suggestions for one processed document. Order is
 * stable so chips render deterministically. `currentPetName` suppresses
 * name suggestions that merely restate the pet's existing name.
 */
export function buildDocSuggestions(
  doc: DocWithMetadata,
  options: { currentPetName?: string } = {},
): EnrichmentSuggestion[] {
  const meta = doc.metadata;
  if (!meta || meta.fields.length === 0) return [];

  const fields = fieldMap(meta.fields);
  const get = (label: string) => fields.get(label.toLowerCase());
  const suggestions: EnrichmentSuggestion[] = [];
  const seed = (n: string) => `${doc._id}:${n}`;

  const petName = get("Pet name");
  if (petName) {
    const current = options.currentPetName?.trim().toLowerCase();
    if (!current || petName.toLowerCase() !== current) {
      suggestions.push({
        key: seed("pet_name"),
        kind: "pet_name",
        docId: doc._id,
        docName: doc.name,
        label: `Set name to “${petName}”`,
        value: petName,
      });
    }
  }

  const breed = get("Breed");
  if (breed) {
    suggestions.push({
      key: seed("pet_breed"),
      kind: "pet_breed",
      docId: doc._id,
      docName: doc.name,
      label: `Set breed to “${breed}”`,
      value: breed,
    });
  }

  const weightRaw = get("Weight");
  const weight = weightRaw ? parseWeight(weightRaw) : null;
  if (weightRaw && weight !== null) {
    suggestions.push({
      key: seed("pet_weight"),
      kind: "pet_weight",
      docId: doc._id,
      docName: doc.name,
      label: `Record weight ${weight.source} (${weight.kg} kg)`,
      value: String(weight.kg),
    });
  }

  const vaccine = get("Vaccine");
  const dateValue = get("Date");
  const dateTs = dateValue ? parseLooseDate(dateValue) : null;
  const vet = get("Veterinarian");
  const clinic = get("Clinic");

  if (vaccine) {
    suggestions.push({
      key: seed("vaccination"),
      kind: "vaccination",
      docId: doc._id,
      docName: doc.name,
      label: `Add vaccination: ${vaccine}${dateTs ? "" : " (no date yet)"}`,
      vaccineName: vaccine,
      administeredAt: dateTs ?? undefined,
      provider: vet ?? clinic,
    });
  }

  const medication = get("Medication");
  if (medication) {
    const frequency = mapFrequency(get("Frequency"));
    suggestions.push({
      key: seed("medication"),
      kind: "medication",
      docId: doc._id,
      docName: doc.name,
      label: frequency
        ? `Add medication: ${medication}`
        : `Review medication: ${medication} (frequency needed)`,
      value: medication,
      dosage: get("Dosage") ?? "unspecified",
      frequency,
    });
  }

  // A visit record: either the pipeline classified it as a vet_visit, or a
  // non-vaccination doc carries clinic/vet context with a date.
  if (meta.type === "vet_visit" || (!vaccine && !medication && (vet || clinic))) {
    if (vet || clinic || dateTs) {
      suggestions.push({
        key: seed("visit"),
        kind: "visit",
        docId: doc._id,
        docName: doc.name,
        label: dateTs ? "Log vet visit" : "Review vet visit (date needed)",
        visitedAt: dateTs ?? undefined,
        clinicName: clinic,
        vetName: vet,
      });
    }
  }

  const nextDue = get("Next due");
  if (nextDue) {
    const ts = parseLooseDate(nextDue);
    if (ts !== null) {
      suggestions.push({
        key: seed("reminder_next_due"),
        kind: "reminder",
        docId: doc._id,
        docName: doc.name,
        label: `Remind me ${nextDue}`,
        dueAt: ts,
        reminderKind: "vaccination",
        value: `${vaccine ?? "Vaccination"} booster due`,
      });
    }
  }

  const nextVisit = get("Next visit");
  if (nextVisit) {
    const ts = parseLooseDate(nextVisit);
    if (ts !== null) {
      suggestions.push({
        key: seed("reminder_next_visit"),
        kind: "reminder",
        docId: doc._id,
        docName: doc.name,
        label: `Remind me ${nextVisit}`,
        dueAt: ts,
        reminderKind: "vet_visit",
        value: "Follow-up vet visit",
      });
    }
  }

  return suggestions;
}

/** Suggestions across a document list, processed docs first. */
export function buildSuggestionsForDocs(
  docs: DocWithMetadata[],
  options: { currentPetName?: string } = {},
): EnrichmentSuggestion[] {
  return docs.flatMap((doc) => buildDocSuggestions(doc, options));
}
