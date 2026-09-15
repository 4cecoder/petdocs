"use client";

import { useState } from "react";
import { Plus, Stethoscope } from "lucide-react";
import { Button } from "@seridian/ui-kit";
import { api } from "@/lib/api";
import { formatDate } from "../fmt";
import {
  ToolDateField,
  ToolDialog,
  ToolTextField,
  ToolTextareaField,
  dateValueToTs,
} from "../tool-dialog";
import { usePetWorkspace } from "../workspace";

export default function PetVisitsPage() {
  const ws = usePetWorkspace();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [clinic, setClinic] = useState("");
  const [vet, setVet] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = !!reason.trim() && dateValueToTs(date) !== undefined;

  async function handleCreate() {
    const visitedAt = dateValueToTs(date);
    if (!reason.trim() || visitedAt === undefined) return;
    setSaving(true);
    setError(null);
    try {
      await api.visits.create({
        ownerId: ws.ownerId,
        petId: ws.petId,
        visitedAt,
        reason: reason.trim(),
        clinicName: clinic.trim() || undefined,
        vetName: vet.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
      });
      await ws.refreshVisits();
      setOpen(false);
      setReason("");
      setDate("");
      setClinic("");
      setVet("");
      setDiagnosis("");
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? `Couldn’t save the visit: ${e.message}`
          : "Couldn’t save the visit. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...ws.visits].sort((a, b) => b.visitedAt - a.visitedAt);

  return (
    <section aria-label="Vet visits" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Vet visits</h2>
          <p className="text-sm text-ink-soft">
            Clinic history for {ws.pet.name}, newest first.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)} className="min-h-[44px] rounded-xl">
          <Plus size={16} aria-hidden="true" />
          Log visit
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
          <Stethoscope size={40} aria-hidden="true" className="text-ink-soft" />
          <p className="mt-2 font-semibold">No visits logged</p>
          <p className="text-sm text-ink-soft">
            Even a routine wellness check is worth recording.
          </p>
        </div>
      ) : (
        <ul className="flex list-none flex-col gap-2">
          {sorted.map((visit) => (
            <li
              key={visit._id}
              className="rounded-2xl border border-ink/10 bg-white p-4 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{visit.reason}</p>
                <span className="text-xs font-medium text-ink-soft">
                  {formatDate(visit.visitedAt)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                {[visit.clinicName, visit.vetName, visit.diagnosis]
                  .filter(Boolean)
                  .join(" · ") || "No clinic details"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <ToolDialog
        open={open}
        onOpenChange={setOpen}
        title="Log vet visit"
        description={`Record a clinic visit for ${ws.pet.name}. Reason and date are required.`}
        submitLabel="Save visit"
        submitting={saving}
        submitDisabled={!ready}
        error={error}
        onSubmit={() => void handleCreate()}
      >
        <ToolTextField
          id="visit-reason"
          label="Reason"
          required
          value={reason}
          onChange={setReason}
          placeholder="e.g. Annual wellness exam"
          hint="What was the visit for?"
        />
        <ToolDateField
          id="visit-date"
          label="Visit date"
          value={date}
          onChange={setDate}
        />
        <div className="grid grid-cols-2 gap-3">
          <ToolTextField
            id="visit-clinic"
            label="Clinic"
            value={clinic}
            onChange={setClinic}
            placeholder="e.g. Lakeview Vet"
          />
          <ToolTextField
            id="visit-vet"
            label="Veterinarian"
            value={vet}
            onChange={setVet}
            placeholder="e.g. Dr. Patel"
          />
        </div>
        <ToolTextareaField
          id="visit-diagnosis"
          label="Diagnosis or notes"
          value={diagnosis}
          onChange={setDiagnosis}
          placeholder="Findings, follow-ups, weight…"
        />
      </ToolDialog>
    </section>
  );
}
