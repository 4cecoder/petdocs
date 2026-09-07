// Deterministic on-device-style document classifier.
// Regex and lookup tables only. No network calls. No AI calls.
import type { DocCategory } from "./validators";
import { parseCertText, parseMedLabel } from "./parsers";

export interface ClassifyInput {
  filename: string;
  mime: string;
  textHint?: string;
}

export interface ClassifyResult {
  category: DocCategory;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface VaccineScheduleEntry {
  name: string;
  everyMonths: number;
}

export interface LastVaccine {
  name: string;
  administeredAt: string;
}

export interface VaccineDue {
  name: string;
  dueAt: string;
}

// Lookup tables for booster intervals in months.
export const VACCINE_SCHEDULES: Record<"dog" | "cat", VaccineScheduleEntry[]> = {
  dog: [
    { name: "Rabies", everyMonths: 12 },
    { name: "DHPP", everyMonths: 12 },
    { name: "Bordetella", everyMonths: 6 },
    { name: "Lyme", everyMonths: 12 },
  ],
  cat: [
    { name: "Rabies", everyMonths: 12 },
    { name: "FVRCP", everyMonths: 12 },
    { name: "FeLV", everyMonths: 12 },
  ],
};

const VACCINE_KEYWORDS: { label: string; re: RegExp }[] = [
  { label: "Rabies", re: /\brabies\b/i },
  { label: "DHPP", re: /\b(dhppv?|da2pp|dhlpp)\b/i },
  { label: "FVRCP", re: /\bfvrcp\b/i },
  { label: "FeLV", re: /\b(felv|feline leukemia)\b/i },
  { label: "Bordetella", re: /\bbordetella\b/i },
  { label: "Lyme", re: /\blyme\b/i },
  { label: "Lepto", re: /\blepto(spirosis)?\b/i },
  { label: "Canine Influenza", re: /\b(canine influenza|civ|h3n[28])\b/i },
  { label: "Distemper", re: /\bdistemper\b/i },
  { label: "Parvo", re: /\bparvo(virus)?\b/i },
  { label: "Adenovirus", re: /\badenovirus\b/i },
  { label: "Parainfluenza", re: /\bparainfluenza\b/i },
];

const VAX_GENERIC_RE = /(vax|vaccin|immuniz|booster|\bshots?\b)/i;
const CERT_RE = /\bcert(s|ificate(s)?)?\b/i;
const YEAR_RE = /\b((?:19|20)\d{2})\b/;

function findVaccineKeyword(hay: string): string | null {
  for (const v of VACCINE_KEYWORDS) {
    if (v.re.test(hay)) return v.label;
  }
  return null;
}

function yearIn(hay: string): string | null {
  const m = YEAR_RE.exec(hay);
  return m ? m[1] : null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseYMD(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

function toYMD(y: number, m: number, d: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(m)}-${p(d)}`;
}

function addMonths(ymd: string, months: number): string | null {
  const p = parseYMD(ymd);
  if (!p) return null;
  const total = p.y * 12 + (p.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const d = Math.min(p.d, daysInMonth(y, m));
  return toYMD(y, m, d);
}

// Classify one haystack string. parserText is the text to run the
// deterministic parsers on (usually the same as hay).
// Rule order is fixed so results are deterministic.
// R1 microchip word, R2 chip number or chip word, R3 insurance,
// R4 travel, R5 lab, R6 prescription keywords, R7 med label parser,
// R8 cert parser hit, R9 vaccine keywords, R10 photo. Default is other.
function classifyHaystack(hay: string, parserText: string): ClassifyResult | null {
  if (!hay.trim()) return null;
  // Underscores are word chars for \b, so treat them as spaces for matching.
  const norm = hay.replace(/_/g, " ");
  const parserNorm = parserText.replace(/_/g, " ");

  // R1: explicit microchip word.
  if (/micro\s*chip/i.test(norm)) {
    return { category: "microchip", confidence: "high", reason: "Found microchip keyword" };
  }

  // R2: chip number (985 prefix or 15 digit run) or bare chip word.
  if (/985\d{5,}/.test(norm) || /\b\d{15}\b/.test(norm)) {
    return { category: "microchip", confidence: "high", reason: "Found chip number" };
  }
  if (/\bchip\b/i.test(norm)) {
    if (/\d{9,}/.test(norm)) {
      return { category: "microchip", confidence: "high", reason: "Found chip number" };
    }
    return { category: "microchip", confidence: "medium", reason: "Mentions chip" };
  }

  // R3: insurance.
  if (/insurance/i.test(norm)) {
    return { category: "insurance", confidence: "high", reason: "Mentions insurance" };
  }
  if (/\bpolic(y|ies)\b/i.test(norm)) {
    return { category: "insurance", confidence: "high", reason: "Mentions policy" };
  }
  if (/\bclaims?\b/i.test(norm)) {
    return { category: "insurance", confidence: "medium", reason: "Mentions claim" };
  }

  // R4: travel certificate. Health certificate phrase stays here so it
  // does not get mistaken for a vaccine cert. Generic cert alone is R9.
  if (/usda/i.test(norm)) {
    return { category: "travel_certificate", confidence: "high", reason: "Mentions USDA travel form" };
  }
  if (/airlines?/i.test(norm)) {
    return { category: "travel_certificate", confidence: "high", reason: "Mentions airline travel" };
  }
  if (/\btravel\b/i.test(norm)) {
    return { category: "travel_certificate", confidence: "high", reason: "Mentions travel" };
  }
  if (/health\s*cert(ificate)?/i.test(norm)) {
    return { category: "travel_certificate", confidence: "medium", reason: "Mentions health certificate" };
  }
  if (/fit\s*to\s*fly/i.test(norm)) {
    return { category: "travel_certificate", confidence: "medium", reason: "Mentions fit to fly" };
  }

  // R5: lab results.
  if (/blood\s*work/i.test(norm) || /bloodwork/i.test(norm)) {
    return { category: "lab_result", confidence: "high", reason: "Mentions bloodwork" };
  }
  if (/\bcbc\b/i.test(norm)) {
    return { category: "lab_result", confidence: "high", reason: "Mentions CBC panel" };
  }
  if (/\bpanels?\b/i.test(norm)) {
    return { category: "lab_result", confidence: "high", reason: "Mentions panel" };
  }
  if (/\burinalysis\b/i.test(norm)) {
    return { category: "lab_result", confidence: "high", reason: "Mentions urinalysis" };
  }
  if (/\blabs?\b/i.test(norm) || /blood\s*test/i.test(norm)) {
    return { category: "lab_result", confidence: "high", reason: "Mentions lab work" };
  }

  // R6 + R7: prescriptions. Keywords plus parseMedLabel confirmation.
  const hasRxKw =
    /\brx\b/i.test(norm) ||
    /prescription/i.test(norm) ||
    /apoquel/i.test(norm) ||
    /dosage/i.test(norm) ||
    /\bdose\b/i.test(norm) ||
    /refill/i.test(norm) ||
    /pharmacy/i.test(norm);
  let medConfidence: "high" | "medium" | "low" = "low";
  let medName: string | undefined;
  let medDosage: string | undefined;
  if (parserNorm.trim()) {
    try {
      const med = parseMedLabel(parserNorm);
      medConfidence = med.confidence;
      medName = med.name;
      medDosage = med.dosage;
    } catch {
      medConfidence = "low";
    }
  }
  if (hasRxKw && (medConfidence === "high" || medConfidence === "medium")) {
    if (/apoquel/i.test(norm)) {
      return { category: "prescription", confidence: "high", reason: "Found Apoquel and dosage" };
    }
    return { category: "prescription", confidence: "high", reason: "Found prescription and dosage" };
  }
  if (hasRxKw) {
    if (/apoquel/i.test(norm)) {
      return { category: "prescription", confidence: "medium", reason: "Mentions Apoquel" };
    }
    if (/\brx\b/i.test(norm)) {
      return { category: "prescription", confidence: "medium", reason: "Mentions Rx" };
    }
    if (/prescription/i.test(norm)) {
      return { category: "prescription", confidence: "medium", reason: "Mentions prescription" };
    }
    return { category: "prescription", confidence: "medium", reason: "Mentions dosage" };
  }
  if (medConfidence === "high" && medName && medDosage) {
    return { category: "prescription", confidence: "medium", reason: `Found ${medName} and ${medDosage}` };
  }
  if (medConfidence === "high") {
    return { category: "prescription", confidence: "medium", reason: "Looks like a med label" };
  }

  // R8: cert parser hit. A vaccine name from parseCertText is strong
  // evidence even when the filename has no vaccine keyword.
  if (parserNorm.trim()) {
    try {
      const cert = parseCertText(parserNorm);
      if (cert.vaccineName) {
        if (cert.administeredAt) {
          const yr = cert.administeredAt.slice(0, 4);
          return {
            category: "vaccine_record",
            confidence: "high",
            reason: `Found ${cert.vaccineName} and a ${yr} date`,
          };
        }
        return {
          category: "vaccine_record",
          confidence: "medium",
          reason: `Found ${cert.vaccineName}`,
        };
      }
    } catch {
      // Fall through to keyword checks.
    }
  }

  // R9: vaccine keywords in filename or hint text.
  const vLabel = findVaccineKeyword(norm);
  if (vLabel) {
    const yr = yearIn(norm);
    if (yr) {
      return { category: "vaccine_record", confidence: "high", reason: `Found ${vLabel} and a ${yr} date` };
    }
    return { category: "vaccine_record", confidence: "medium", reason: `Mentions ${vLabel}` };
  }
  if (VAX_GENERIC_RE.test(norm)) {
    return { category: "vaccine_record", confidence: "medium", reason: "Mentions vaccine" };
  }
  if (CERT_RE.test(norm)) {
    return { category: "vaccine_record", confidence: "medium", reason: "Mentions certificate" };
  }

  // R10: photo filename patterns.
  if (
    /(photo|picture|selfie|portrait|screenshot)/i.test(norm) ||
    /\b(pic|img)\b/i.test(norm) ||
    /(^|[\s_.-])(img|dsc|dcim)([\s_.-]|\d)/i.test(norm)
  ) {
    return { category: "photo", confidence: "medium", reason: "Filename looks like a photo" };
  }

  return null;
}

export function suggestCategory(input: ClassifyInput): ClassifyResult {
  const filename = (input.filename ?? "").trim();
  const mime = (input.mime ?? "").trim().toLowerCase();
  const hint = (input.textHint ?? "").trim();

  // textHint wins over filename when it carries a usable signal.
  if (hint) {
    const hit = classifyHaystack(hint, hint);
    if (hit && hit.confidence !== "low") return hit;
  }

  if (filename) {
    const hit = classifyHaystack(filename, filename);
    if (hit) return hit;
  }

  // Mime fallback: generic images with no keywords are likely photos.
  if (mime.startsWith("image/")) {
    if (/(photo|picture|selfie|portrait|screenshot|\bpic\b|\bimg\b|^img[_-]|^dsc[_-]?|dcim)/i.test(filename)) {
      return { category: "photo", confidence: "medium", reason: "Filename looks like a photo" };
    }
    return { category: "photo", confidence: "low", reason: "Image file with no document keywords" };
  }

  return { category: "other", confidence: "low", reason: "No document keywords found" };
}

// Next due date per schedule entry from the latest known dose.
// Unknown vaccine names in last are skipped. Species other than
// dog or cat return []. Invalid dates are skipped.
export function nextDueVaccine(
  last: LastVaccine[],
  species: string,
): VaccineDue[] {
  const key = (species ?? "").trim().toLowerCase();
  const schedule =
    key === "dog" ? VACCINE_SCHEDULES.dog : key === "cat" ? VACCINE_SCHEDULES.cat : null;
  if (!schedule) return [];

  const latestByName = new Map<string, string>();
  for (const entry of last ?? []) {
    const nameKey = (entry?.name ?? "").trim().toLowerCase();
    const date = (entry?.administeredAt ?? "").trim();
    if (!nameKey || !parseYMD(date)) continue;
    const prev = latestByName.get(nameKey);
    if (!prev || date > prev) latestByName.set(nameKey, date);
  }

  const out: VaccineDue[] = [];
  for (const s of schedule) {
    const hit = latestByName.get(s.name.toLowerCase());
    if (!hit) continue;
    const dueAt = addMonths(hit, s.everyMonths);
    if (!dueAt) continue;
    out.push({ name: s.name, dueAt });
  }

  out.sort((a, b) => (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0));
  return out;
}
