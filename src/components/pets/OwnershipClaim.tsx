"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getOwnerId } from "@/lib/api";
import { convexMutation } from "@/lib/convexHttp";

type ClaimMethod = "microchip" | "vet_record" | "transfer_code";

const METHOD_OPTIONS: Array<{ value: ClaimMethod; label: string }> = [
  { value: "microchip", label: "Microchip match" },
  { value: "vet_record", label: "Vet record" },
  { value: "transfer_code", label: "Transfer code" },
];

const EVIDENCE_PLACEHOLDER: Record<ClaimMethod, string> = {
  microchip: "Chip digits as printed, e.g. 985 141 012 345 678",
  vet_record: "Clinic and date, e.g. Maple Vet Mar 2025",
  transfer_code: "6 character code from the current owner",
};

/**
 * Minimal ownership KYC card. Submits to ownership:claimPet and reports
 * pending vs approved. Microchip auto-approves on digit suffix match,
 * other methods stay pending for support review.
 */
export function OwnershipClaim({
  petId,
  petName,
  microchipKnown,
}: {
  petId: string;
  petName: string;
  microchipKnown: boolean;
}) {
  const [ownerId, setOwnerId] = useState<string | null | undefined>(undefined);
  const [method, setMethod] = useState<ClaimMethod>("microchip");
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setOwnerId(getOwnerId());
  }, []);

  if (ownerId === null) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
        <p className="text-sm text-ink-soft">Sign in to prove ownership</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerId || submitting) return;
    const trimmed = evidence.trim();
    if (!trimmed) {
      setError("Enter evidence for the selected method.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await convexMutation<{ claimId: string; status: string }>(
        "ownership:claimPet",
        { ownerId, petId, method, evidence: trimmed },
      );
      setStatus(result.status);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not submit claim.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={20} aria-hidden="true" className="text-brand-700" />
        <h2 className="font-display text-lg font-bold">Prove ownership</h2>
      </div>
      <p className="text-sm text-ink-soft">
        Claim {petName} with a chip match, a vet record note, or a transfer
        code.
      </p>
      <p className="text-xs text-ink-soft">
        {microchipKnown
          ? "Chip on file. An exact digit match auto-approves."
          : "No chip on file for this pet. Microchip match will stay pending."}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ownership-method" className="text-sm font-medium">
            Method
          </label>
          <select
            id="ownership-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as ClaimMethod)}
            className="min-h-[48px] w-full rounded-xl border border-ink/15 bg-cream px-3 text-sm"
          >
            {METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ownership-evidence" className="text-sm font-medium">
            Evidence
          </label>
          <input
            id="ownership-evidence"
            type="text"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder={EVIDENCE_PLACEHOLDER[method]}
            autoComplete="off"
            className="min-h-[48px] w-full rounded-xl border border-ink/15 bg-cream px-3 text-sm"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !ownerId}
          className="min-h-[48px] w-full rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit claim"}
        </button>

        {submitting ? (
          <p aria-live="polite" className="text-sm text-ink-soft">
            Submitting claim...
          </p>
        ) : null}

        {!submitting && status ? (
          <p role="status" aria-live="polite" className="text-sm font-medium">
            {status === "approved"
              ? "Approved. Chip match verified for this pet."
              : "Submitted. Auto-approved if the chip matches."}
          </p>
        ) : null}
      </form>
    </div>
  );
}
