"use client";

import { useState } from "react";
import { Pill, Plus } from "lucide-react";
import { Button } from "@seridian/ui-kit";
import { api } from "@/lib/api";
import {
  ToolDialog,
  ToolSelectField,
  ToolTextField,
  ToolTextareaField,
} from "../tool-dialog";
import { usePetWorkspace } from "../workspace";

const FREQUENCIES = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "as_needed", label: "As needed" },
] as const;

export default function PetMedicationsPage() {
  const ws = usePetWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]["value"]>("once_daily");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = !!name.trim() && !!dosage.trim();

  async function handleCreate() {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await api.medications.create({
        ownerId: ws.ownerId,
        petId: ws.petId,
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        instructions: instructions.trim() || undefined,
      });
      await ws.refreshMedications();
      setOpen(false);
      setName("");
      setDosage("");
      setFrequency("once_daily");
      setInstructions("");
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? `Couldn’t save the medication: ${e.message}`
          : "Couldn’t save the medication. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  const active = ws.medications.filter((m) => m.status === "active");
  const rest = ws.medications.filter((m) => m.status !== "active");

  return (
    <section aria-label="Medications" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Medications</h2>
          <p className="text-sm text-ink-soft">
            Prescriptions and preventives for {ws.pet.name}.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)} className="min-h-[44px] rounded-xl">
          <Plus size={16} aria-hidden="true" />
          Add medication
        </Button>
      </div>

      {ws.medications.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
          <Pill size={40} aria-hidden="true" className="text-ink-soft" />
          <p className="mt-2 font-semibold">No medications prescribed</p>
          <p className="text-sm text-ink-soft">
            Heartworm and flea/tick preventives count too.
          </p>
        </div>
      ) : (
        <ul className="flex list-none flex-col gap-2">
          {[...active, ...rest].map((m) => (
            <li
              key={m._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-xs"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{m.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      m.status === "active"
                        ? "bg-teal-100 text-teal-800"
                        : "bg-cream-dark text-ink-soft"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {m.dosage} · {m.frequency.replace(/_/g, " ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ToolDialog
        open={open}
        onOpenChange={setOpen}
        title="Add medication"
        description={`Add a prescription or preventive for ${ws.pet.name}.`}
        submitLabel="Save medication"
        submitting={saving}
        submitDisabled={!ready}
        error={error}
        onSubmit={() => void handleCreate()}
      >
        <ToolTextField
          id="med-name"
          label="Medication name"
          required
          value={name}
          onChange={setName}
          placeholder="e.g. Interceptor"
          hint="What is the medication called?"
        />
        <div className="grid grid-cols-2 gap-3">
          <ToolTextField
            id="med-dosage"
            label="Dosage"
            required
            value={dosage}
            onChange={setDosage}
            placeholder="e.g. 6.5 mg"
            hint="How much per dose?"
          />
          <ToolSelectField
            id="med-frequency"
            label="Frequency"
            value={frequency}
            onChange={setFrequency}
            options={[...FREQUENCIES]}
          />
        </div>
        <ToolTextareaField
          id="med-instructions"
          label="Instructions"
          value={instructions}
          onChange={setInstructions}
          placeholder="With food, watch for drowsiness…"
        />
      </ToolDialog>
    </section>
  );
}
