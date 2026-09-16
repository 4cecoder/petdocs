"use client";

import { useState } from "react";
import { Plus, Syringe } from "lucide-react";
import { Button } from "@seridian/ui-kit";
import { VaccineBadge } from "@/components/pets/VaccineBadge";
import { api } from "@/lib/api";
import { formatDate } from "../fmt";
import {
  ToolDateField,
  ToolDialog,
  ToolTextareaField,
  ToolTextField,
  dateValueToTs,
} from "../tool-dialog";
import { usePetWorkspace } from "../workspace";

const STATUS_BADGE = {
  administered: { status: "valid", label: "Administered" },
  due: { status: "expiring", label: "Due" },
  overdue: { status: "expired", label: "Overdue" },
  waived: { status: "valid", label: "Waived" },
} as const;

export default function PetVaccinationsPage() {
  const ws = usePetWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [provider, setProvider] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);

  const nameReady = !!name.trim();

  async function handleCreate() {
    if (!nameReady) return;
    setSaving(true);
    setError(null);
    try {
      await api.vaccinations.create({
        ownerId: ws.ownerId,
        petId: ws.petId,
        vaccineName: name.trim(),
        dueAt: dateValueToTs(dueDate),
        provider: provider.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      await ws.refreshVaccines();
      setOpen(false);
      setName("");
      setDueDate("");
      setProvider("");
      setNotes("");
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? `Couldn’t save the vaccination: ${e.message}`
          : "Couldn’t save the vaccination. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkGiven(vaccinationId: string) {
    setMarkingId(vaccinationId);
    setMarkError(null);
    try {
      await api.vaccinations.markAdministered({ ownerId: ws.ownerId, vaccinationId });
      await ws.refreshVaccines();
    } catch (e: unknown) {
      setMarkError(
        e instanceof Error
          ? `Couldn’t mark the vaccination as administered: ${e.message}`
          : "Couldn’t mark the vaccination as administered. Check your connection and try again.",
      );
    } finally {
      setMarkingId(null);
    }
  }

  const sorted = [...ws.vaccines].sort((a, b) => {
    const order = { overdue: 0, due: 1, administered: 2, waived: 3 } as const;
    return order[a.status] - order[b.status];
  });

  return (
    <section aria-label="Vaccinations" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">
            Vaccinations
          </h2>
          <p className="text-sm text-ink-soft">
            Shots and boosters for {ws.pet.name}, most urgent first.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)} className="min-h-[44px] rounded-xl">
          <Plus size={16} aria-hidden="true" />
          Add vaccination
        </Button>
      </div>

      {markError ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {markError}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
          <Syringe size={40} aria-hidden="true" className="text-ink-soft" />
          <p className="mt-2 font-semibold">No vaccinations recorded</p>
          <p className="text-sm text-ink-soft">
            Add a shot, or upload its certificate from Documents — extraction
            will suggest it here.
          </p>
        </div>
      ) : (
        <ul className="flex list-none flex-col gap-2">
          {sorted.map((v) => {
            const badge = STATUS_BADGE[v.status];
            return (
              <li
                key={v._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{v.vaccineName}</p>
                    <VaccineBadge status={badge.status} label={badge.label} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {v.administeredAt
                      ? `Given ${formatDate(v.administeredAt)}`
                      : v.dueAt
                        ? `Due ${formatDate(v.dueAt)}`
                        : "No date"}
                    {v.provider ? ` · ${v.provider}` : ""}
                  </p>
                </div>
                {(v.status === "due" || v.status === "overdue") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={markingId === v._id}
                    onClick={() => void handleMarkGiven(v._id)}
                    className="min-h-[44px] rounded-xl"
                  >
                    {markingId === v._id ? "Saving…" : "Mark given"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ToolDialog
        open={open}
        onOpenChange={setOpen}
        title="Add vaccination"
        description={`Log a shot for ${ws.pet.name}. Only the vaccine name is required.`}
        submitLabel="Save vaccination"
        submitting={saving}
        submitDisabled={!nameReady}
        error={error}
        onSubmit={() => void handleCreate()}
      >
        <ToolTextField
          id="vax-name"
          label="Vaccine name"
          required
          value={name}
          onChange={setName}
          placeholder="e.g. Rabies, FVRCP"
          hint="Which vaccine was given or is due?"
        />
        <ToolDateField
          id="vax-due"
          label="Due date"
          value={dueDate}
          onChange={setDueDate}
        />
        <ToolTextField
          id="vax-provider"
          label="Provider or clinic"
          value={provider}
          onChange={setProvider}
          placeholder="e.g. Riverside Animal Clinic"
        />
        <ToolTextareaField
          id="vax-notes"
          label="Notes"
          value={notes}
          onChange={setNotes}
          placeholder="Serial number, reactions, anything the next vet should know"
        />
      </ToolDialog>
    </section>
  );
}
