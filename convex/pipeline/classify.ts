/**
 * Heuristic document classifier + structured field extractor.
 *
 * Pure regex/keyword heuristics over already-extracted text — no ML, no
 * network, fully deterministic so it is easy to test and to reason about.
 * Low-confidence results are flagged needsReview instead of guessing.
 */
import {
  type Classification,
  type ClassifyOptions,
  type DocType,
  type ExtractedField,
  REVIEW_THRESHOLD,
} from "./types";

const MAX_FIELDS = 12;
const MAX_VALUE_CHARS = 400;

const TYPE_KEYWORDS: Record<Exclude<DocType, "other">, string[]> = {
  vaccination: [
    "vaccination",
    "vaccine",
    "vaccinated",
    "rabies",
    "distemper",
    "parvo",
    "fvrcp",
    "dhpp",
    "felev",
    "bordetella",
    "leptospirosis",
    "kennel cough",
    "booster",
    "immunization",
  ],
  medication: [
    "prescription",
    "medication",
    "dispensed",
    "dosage",
    "twice daily",
    "once daily",
    "as needed",
    "antibiotic",
    "refill",
    "chewable",
    "tablet",
    "capsule",
  ],
  lab: [
    "lab",
    "laboratory",
    "bloodwork",
    "blood work",
    "chemistry panel",
    "complete blood count",
    "cbc",
    "urinalysis",
    "fecal",
    "heartworm test",
    "titer",
    "results",
    "reference range",
  ],
  vet_visit: [
    "physical exam",
    "examination",
    "checkup",
    "check-up",
    "veterinary",
    "veterinarian",
    "clinic",
    "animal hospital",
    "chief complaint",
    "diagnosis",
    "discharge",
    "follow-up",
    "dvm",
  ],
};

const VACCINE_NAMES = [
  "Rabies",
  "DHPP",
  "DHLPP",
  "FVRCP",
  "FeLV",
  "FIV",
  "Bordetella",
  "Leptospirosis",
  "Lyme",
  "Parvovirus",
  "Distemper",
  "Canine Influenza",
  "Giardia",
  "Chlamydia",
  "Feline Leukemia",
];

const LAB_TESTS = [
  "Complete Blood Count",
  "CBC",
  "Chemistry Panel",
  "Urinalysis",
  "Fecal Exam",
  "Fecal Flotation",
  "Heartworm Test",
  "Heartworm Antigen",
  "T4",
  "Blood Glucose",
  "Snap Test",
  "Cytology",
  "Biopsy",
];

const LAB_RESULT_WORDS =
  /\b(normal|abnormal|negative|positive|within normal limits|elevated|unremarkable|no growth|detected|not detected)\b/i;

const FREQUENCY_WORDS = [
  "twice daily",
  "once daily",
  "two times daily",
  "three times daily",
  "every 12 hours",
  "every 8 hours",
  "every 24 hours",
  "weekly",
  "monthly",
  "as needed",
];

const MED_SUFFIX_RE =
  /\b([A-Z][a-z]{3,}(?:cillin|mycin|floxacin|cycline|azole|prazole|pril|sartan|olol|statin|mab|fenac|oxicam))\b/;

const VET_NAME_RE =
  /([A-Z][a-z]+(?: [A-Z]\.)?(?: [A-Z][a-z]+)?,?\s{0,2}(?:DVM|VMD|D\.V\.M\.))/;

const PET_LABEL_RE =
  /\b(?:pet|patient|animal)(?:'s)?\s*name\s*[:#]\s*([A-Za-z][A-Za-z '\-.]{0,30})/i;

const CLINIC_LABEL_RE =
  /\b(?:clinic|hospital|practice|veterinary)\s*[:#]\s*([^\n]{2,80})/i;

const DATE_PATTERNS: RegExp[] = [
  /\b(\d{4}-\d{2}-\d{2})\b/,
  /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/,
  /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i,
  /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\b/i,
];

const NEXT_DUE_RE =
  /\b(?:next\s+(?:due|vaccination|dose|visit)|re(?:-)?vacinate|booster\s+due|follow[\s-]?up(?:\s+on)?|return\s+(?:by|on))\s*(?:by|on|:)?\s*([^.\n]{3,40})/i;

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

function pushField(
  fields: ExtractedField[],
  label: string,
  value: string | null,
): void {
  if (!value) return;
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, MAX_VALUE_CHARS);
  if (!trimmed) return;
  if (fields.some((f) => f.label === label && f.value === trimmed)) return;
  fields.push({ label, value: trimmed });
}

function guessPetName(
  text: string,
  lowerText: string,
  knownPetNames?: string[],
): string | null {
  const labeled = PET_LABEL_RE.exec(text);
  if (labeled) {
    const name = labeled[1]
      .trim()
      .replace(/\s+(?:DOB|Date|Species|Breed|Microchip).*$/i, "")
      .trim();
    if (name) return name;
  }
  if (knownPetNames && knownPetNames.length > 0) {
    let best: { name: string; count: number } | null = null;
    for (const raw of knownPetNames) {
      const name = raw.trim();
      if (name.length < 2) continue;
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      const count = (lowerText.match(re) ?? []).length;
      if (count > 0 && (!best || count > best.count)) best = { name, count };
    }
    if (best) return best.name;
  }
  return null;
}

function guessVaccineName(text: string): string | null {
  for (const name of VACCINE_NAMES) {
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) return name;
  }
  const generic = /\b([A-Z][A-Za-z-]{2,}(?:vax|vac|virus|globulin|serum))\b/.exec(text);
  return generic ? generic[1] : null;
}

function guessMedicationName(text: string): string | null {
  const labeled =
    /\b(?:medication|drug|rx|prescription)\s*[:#]\s*([A-Za-z][\w\-]{1,40})/i.exec(text);
  if (labeled) return labeled[1].trim();
  const suffix = MED_SUFFIX_RE.exec(text);
  if (suffix) return suffix[1];
  const generic =
    /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+\d+(?:\.\d+)?\s*(?:mg|ml|mcg)\b/.exec(text);
  return generic ? generic[1] : null;
}

function guessLabTest(text: string): string | null {
  for (const name of LAB_TESTS) {
    if (new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`, "i").test(text)) return name;
  }
  return null;
}

function guessLabResult(text: string): string | null {
  const labeled = /\b(?:result|outcome|impression)\s*[:#]\s*([^\n]{2,80})/i.exec(text);
  if (labeled) return labeled[1].trim();
  const word = LAB_RESULT_WORDS.exec(text);
  return word ? word[1] : null;
}

function guessClinic(text: string): string | null {
  const labeled = CLINIC_LABEL_RE.exec(text);
  if (labeled) return labeled[1].trim();
  const lineRe =
    /^.*\b(veterinary clinic|veterinary hospital|animal hospital|pet clinic|[A-Za-z]+\s+(?:veterinary|animal)(?:\s+(?:clinic|hospital))?)\b.*$/gim;
  const line = lineRe.exec(text);
  return line ? line[0].trim().slice(0, 80) : null;
}

function guessVetName(text: string): string | null {
  const labeled =
    /\b(?:veterinarian|vet|doctor|examiner)\s*[:#]\s*([^\n]{2,60})/i.exec(text);
  if (labeled) return labeled[1].trim();
  const dvm = VET_NAME_RE.exec(text);
  if (dvm) return dvm[1].trim().replace(/,$/, "");
  const dr = /\b(Dr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/.exec(text);
  return dr ? dr[1] : null;
}

function guessDosage(text: string): string | null {
  const m =
    /\b(\d+(?:\.\d+)?\s*(?:mg|ml|mcg|units?)\b(?:\s*[x×]\s*\d+(?:\.\d+)?)?)/i.exec(text);
  return m ? m[1] : null;
}

function guessFrequency(lowerText: string): string | null {
  for (const word of FREQUENCY_WORDS) {
    if (lowerText.includes(word)) return word;
  }
  return null;
}

/**
 * Classify extracted text into a doc type and pull out structured fields.
 * Confidence is deterministic: keyword signal count + small bonuses for
 * dates and pet names, clamped to [0, 0.95]. No signals => "other" + low
 * confidence so the doc lands in the review queue instead of guessing.
 */
export function classifyDocument(
  rawText: string,
  options: ClassifyOptions = {},
): Classification {
  const text = rawText ?? "";
  const lowerText = text.toLowerCase();
  const scores = scoreTypes(lowerText);

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = ranked[0] ?? (["other" as const, 0] as const);

  const fields: ExtractedField[] = [];
  const date = firstMatch(text, DATE_PATTERNS);
  const nextDue = NEXT_DUE_RE.exec(text)?.[1]?.trim() ?? null;

  let type: DocType = "other";
  if (bestScore >= 1) {
    type = bestType;
    switch (type) {
      case "vaccination":
        pushField(fields, "Vaccine", guessVaccineName(text));
        pushField(fields, "Pet name", guessPetName(text, lowerText, options.knownPetNames));
        pushField(fields, "Date", date);
        pushField(fields, "Next due", nextDue);
        pushField(fields, "Clinic", guessClinic(text));
        pushField(fields, "Veterinarian", guessVetName(text));
        break;
      case "medication":
        pushField(fields, "Medication", guessMedicationName(text));
        pushField(fields, "Pet name", guessPetName(text, lowerText, options.knownPetNames));
        pushField(fields, "Dosage", guessDosage(text));
        pushField(fields, "Frequency", guessFrequency(lowerText));
        pushField(fields, "Date", date);
        pushField(fields, "Clinic", guessClinic(text));
        break;
      case "lab":
        pushField(fields, "Test", guessLabTest(text));
        pushField(fields, "Result", guessLabResult(text));
        pushField(fields, "Pet name", guessPetName(text, lowerText, options.knownPetNames));
        pushField(fields, "Date", date);
        pushField(fields, "Clinic", guessClinic(text));
        break;
      case "vet_visit":
        pushField(fields, "Clinic", guessClinic(text));
        pushField(fields, "Veterinarian", guessVetName(text));
        pushField(fields, "Pet name", guessPetName(text, lowerText, options.knownPetNames));
        pushField(fields, "Date", date);
        pushField(fields, "Next visit", nextDue);
        break;
    }
  } else {
    pushField(fields, "Pet name", guessPetName(text, lowerText, options.knownPetNames));
    pushField(fields, "Date", date);
  }

  let confidence: number;
  if (bestScore === 0) {
    confidence = fields.length > 0 ? 0.35 : 0.3;
  } else {
    confidence = Math.min(0.9, 0.45 + 0.12 * bestScore);
    if (date) confidence += 0.04;
    if (fields.some((f) => f.label === "Pet name")) confidence += 0.03;
    if (fields.length >= 3) confidence += 0.03;
    confidence = Math.min(0.95, confidence);
  }

  return {
    type,
    confidence: Math.round(confidence * 100) / 100,
    fields: fields.slice(0, MAX_FIELDS),
    needsReview: confidence < REVIEW_THRESHOLD || type === "other",
  };
}

function scoreTypes(lowerText: string): Map<Exclude<DocType, "other">, number> {
  const scores = new Map<Exclude<DocType, "other">, number>();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS) as [
    Exclude<DocType, "other">,
    string[],
  ][]) {
    let score = 0;
    for (const kw of keywords) {
      if (lowerText.includes(kw)) score += 1;
    }
    scores.set(type, score);
  }
  return scores;
}
