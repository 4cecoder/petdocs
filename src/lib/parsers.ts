// Deterministic text parsers for pet-doc OCR output and pasted cert text.
// Regex/template only. No AI calls. Dates normalize to YYYY-MM-DD.

export interface CertFindings {
  vaccineName?: string;
  administeredAt?: string;
  provider?: string;
  lot?: string;
  confidence: "high" | "medium" | "low";
  unmatched: string[];
}

export interface MedFindings {
  name?: string;
  dosage?: string;
  frequency?: "once_daily" | "twice_daily" | "weekly" | "monthly" | "as_needed";
  confidence: "high" | "medium" | "low";
}

const VACCINES: { name: string; re: RegExp }[] = [
  { name: "Rabies", re: /\brabies\b/i },
  { name: "DHPP", re: /\b(dhppv?|da2pp)\b/i },
  { name: "FVRCP", re: /\bfvrcp\b/i },
  { name: "Bordetella", re: /\bbordetella\b/i },
  { name: "Lepto", re: /\blepto(?:spirosis)?\b/i },
  { name: "Lyme", re: /\blyme\b/i },
  { name: "FeLV", re: /\b(felv|feline\s+leukemia)\b/i },
  { name: "Canine Influenza", re: /\b(canine\s+influenza|civ|h3n[28])\b/i },
];

const MONTHS: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

const MONTH_NAME_SRC = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidYMD(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function toYMD(y: number, m: number, d: number): string | null {
  if (!isValidYMD(y, m, d)) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** All dates in text, normalized to YYYY-MM-DD, deduped, sorted asc. */
export function findDates(text: string): string[] {
  const found = new Set<string>();
  const push = (y: number, m: number, d: number) => {
    const iso = toYMD(y, m, d);
    if (iso) found.add(iso);
  };

  // Already ISO: YYYY-MM-DD
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    push(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  // Numeric: MM/DD/YYYY (also MM-DD-YYYY, MM.DD.YYYY), US order
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g)) {
    push(Number(m[3]), Number(m[1]), Number(m[2]));
  }
  // Month name: Mar 5 2024, March 5, 2024
  const monRe = new RegExp(
    `\\b(${MONTH_NAME_SRC})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
    "gi",
  );
  for (const m of text.matchAll(monRe)) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon) push(Number(m[3]), Number(mon), Number(m[2]));
  }
  return [...found].sort();
}

function linesOf(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim());
}

function labeledCertDate(line: string): string | null {
  if (!/(given|administered|vaccinated\s+on|date\s+of\s+(vaccination|service)|shot\s+date|date\s*[:\-])/i.test(line)) {
    return null;
  }
  return findDates(line)[0] ?? null;
}

function findVaccine(text: string): string | undefined {
  let best: { name: string; at: number } | null = null;
  for (const v of VACCINES) {
    const m = v.re.exec(text);
    if (m && (!best || m.index < best.at)) best = { name: v.name, at: m.index };
  }
  return best?.name;
}

function findProviderLine(lines: string[]): string | undefined {
  const line = lines.find((l) => /\b(vet|clinic|animal hospital|dvm)\b/i.test(l));
  if (!line) return undefined;
  return line.replace(/^(provider|clinic|veterinarian|vet|hospital)\s*[:\-]\s*/i, "").trim() || line;
}

function findLot(text: string): string | undefined {
  const m = /lot\s*(?:#|no\.?|number)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-]*)/i.exec(text);
  return m?.[1].replace(/[.,;:]+$/, "");
}

export function parseCertText(text: string): CertFindings {
  const lines = linesOf(text).filter(Boolean);
  const vaccineName = text.trim() ? findVaccine(text) : undefined;

  // Most likely past date: labeled date first, else latest past date.
  let administeredAt: string | undefined;
  for (const line of lines) {
    const d = labeledCertDate(line);
    if (d && d <= todayLocal()) {
      administeredAt = d;
      break;
    }
  }
  administeredAt ??= findDates(text).filter((d) => d <= todayLocal()).pop();

  const provider = findProviderLine(lines);
  const lot = text.trim() ? findLot(text) : undefined;

  const confidence: CertFindings["confidence"] =
    vaccineName && administeredAt && (provider || lot)
      ? "high"
      : vaccineName && administeredAt
        ? "medium"
        : "low";

  const unmatched: string[] = [];
  for (const line of lines) {
    const consumed =
      (vaccineName !== undefined && VACCINES.some((v) => v.re.test(line))) ||
      (administeredAt !== undefined && findDates(line).includes(administeredAt)) ||
      /\b(vet|clinic|animal hospital|dvm)\b/i.test(line) ||
      /lot\s*(?:#|no\.?|number)?\s*[:\-]?\s*[A-Za-z0-9]/i.test(line);
    if (!consumed) unmatched.push(line);
    if (unmatched.length >= 5) break;
  }

  return { vaccineName, administeredAt, provider, lot, confidence, unmatched };
}

const DOSAGE_RE =
  /\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|iu|units?)(?:\s*\/\s*(?:ml|tablet|cap|chew|dose))?|\d+\s*(?:tablets?|caps?(?:ules?)?|chews?|drops?)/i;

function isCapsHeavy(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length >= 0.6;
}

function findFrequency(text: string): MedFindings["frequency"] {
  if (/\b(bid|twice|two\s+times|q12h|every\s*12\s*(?:h|hrs?|hours?))\b/i.test(text)) return "twice_daily";
  if (/\bweekly|once\s+(a|per)\s+week|every\s+week\b/i.test(text)) return "weekly";
  if (/\bmonthly|once\s+(a|per)\s+month|every\s+month\b/i.test(text)) return "monthly";
  if (/\b(sid|q24h|once\s+daily|once\s+a\s+day|every\s*24\s*(?:h|hrs?|hours?))\b/i.test(text)) return "once_daily";
  if (/\b(as\s+needed|prn|when\s+needed|if\s+needed)\b/i.test(text)) return "as_needed";
  if (/\b(daily|every\s+day|qd)\b/i.test(text)) return "once_daily";
  return undefined;
}

export function parseMedLabel(text: string): MedFindings {
  const lines = linesOf(text).filter(Boolean);
  const rawName = lines.find(
    (l) =>
      isCapsHeavy(l) &&
      !/^(bid|sid|qd|prn|q\s?\d+\s?h)$/i.test(l) &&
      !/^\d/.test(l),
  );
  const name = rawName
    ?.replace(DOSAGE_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s\-–:|]+$/, "")
    .trim() || undefined;

  const dosage = DOSAGE_RE.exec(text)?.[0].replace(/\s+/g, " ").trim();
  const frequency = text.trim() ? findFrequency(text) : undefined;

  const confidence: MedFindings["confidence"] =
    name && dosage && frequency
      ? "high"
      : name && (dosage || frequency)
        ? "medium"
        : "low";

  return { name, dosage, frequency, confidence };
}

/** Chip number: prefer 15-digit starting with 9, else any 15, else 10 or 9 digit runs. */
export function parseMicrochip(text: string): string | null {
  const runs: string[] = [];
  for (const m of text.matchAll(/(?<!\d[\s\-]?)(?:\d[\s\-]?){9,15}(?![\s\-]?\d)/g)) {
    const digits = m[0].replace(/[\s\-]/g, "");
    if ([9, 10, 15].includes(digits.length)) runs.push(digits);
  }
  return (
    runs.find((r) => r.length === 15 && r.startsWith("9")) ??
    runs.find((r) => r.length === 15) ??
    runs.find((r) => r.length === 10) ??
    runs.find((r) => r.length === 9) ??
    null
  );
}
