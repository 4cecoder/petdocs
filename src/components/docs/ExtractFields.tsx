"use client";

import { useId, useState } from "react";
import { Check, ScanLine } from "lucide-react";
import { parseCertText } from "@/lib/parsers";

export interface SmartFillFields {
  vaccineName?: string;
  administeredAt?: string;
  provider?: string;
}

const COMMON_VACCINES = [
  "Rabies",
  "DHPP",
  "DHPPL",
  "FVRCP",
  "FeLV",
  "Bordetella",
  "Leptospirosis",
  "Canine Influenza",
  "Lyme",
  "Distemper",
  "Parvovirus",
  "Adenovirus",
  "Parainfluenza",
];

export function ExtractFields({
  onApply,
  compact = false,
}: {
  onApply: (fields: SmartFillFields) => void;
  compact?: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [hasParsed, setHasParsed] = useState(false);
  const [confidence, setConfidence] = useState<"high" | "medium" | "low">("low");
  const [vaccineName, setVaccineName] = useState("");
  const [administeredAt, setAdministeredAt] = useState("");
  const [provider, setProvider] = useState("");
  const datalistId = useId();

  function handleParse() {
    const text = raw.trim();
    if (!text) return;
    const findings = parseCertText(text);
    setConfidence(findings.confidence);
    setVaccineName(findings.vaccineName ?? "");
    setAdministeredAt(findings.administeredAt ?? "");
    setProvider(findings.provider ?? "");
    setHasParsed(true);
  }

  function handleApply() {
    const fields: SmartFillFields = {};
    const name = vaccineName.trim();
    const date = administeredAt.trim();
    const vet = provider.trim();
    if (name) fields.vaccineName = name;
    if (date) fields.administeredAt = date;
    if (vet) fields.provider = vet;
    if (!fields.vaccineName && !fields.administeredAt && !fields.provider) return;
    onApply(fields);
  }

  function handleClear() {
    setRaw("");
    setHasParsed(false);
    setConfidence("low");
    setVaccineName("");
    setAdministeredAt("");
    setProvider("");
  }

  const confidenceNote =
    confidence === "high"
      ? "High confidence. Check before saving."
      : confidence === "medium"
        ? "Medium confidence. Review each field before applying."
        : "Low confidence. Confirm every field before applying.";

  const pad = compact ? "px-2" : "px-3";

  return (
    <details
      className={`rounded-2xl border border-ink/10 bg-cream/60 ${pad} py-2`}
    >
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <ScanLine size={18} aria-hidden="true" className="shrink-0" />
        Smart fill from cert text
        <span className="ml-auto text-xs font-normal text-ink-soft">
          Review before saving
        </span>
      </summary>
      <div className="flex flex-col gap-3 pb-2 pt-1">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Paste cert text or ML Kit scan output
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={4}
            placeholder="Paste cert text or ML Kit scan output"
            className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm font-normal"
          />
        </label>
        <button
          type="button"
          onClick={handleParse}
          disabled={!raw.trim()}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-ink/15 bg-white px-4 font-semibold hover:bg-cream disabled:opacity-60"
        >
          <ScanLine size={18} aria-hidden="true" />
          Parse text
        </button>

        {hasParsed ? (
          <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-white p-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Vaccine name
              <input
                type="text"
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                list={datalistId}
                placeholder="e.g. Rabies"
                autoComplete="off"
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3 font-normal"
              />
              <datalist id={datalistId}>
                {COMMON_VACCINES.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Date given
              <input
                type="date"
                value={administeredAt}
                onChange={(e) => setAdministeredAt(e.target.value)}
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3 font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Provider
              <input
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. Riverside Animal Clinic"
                autoComplete="off"
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3 font-normal"
              />
            </label>
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-ink-soft"
            >
              {confidenceNote}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleApply}
                disabled={
                  !vaccineName.trim() &&
                  !administeredAt.trim() &&
                  !provider.trim()
                }
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Check size={18} aria-hidden="true" />
                Apply to details
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-ink/15 bg-white px-4 font-semibold hover:bg-cream"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
