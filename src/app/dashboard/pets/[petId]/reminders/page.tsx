"use client";

import { useState } from "react";
import { BellRing, Check, Plus, X } from "lucide-react";
import { Button } from "@seridian/ui-kit";
import { api } from "@/lib/api";
import { formatDate } from "../fmt";
import {
  ToolDateField,
  ToolDialog,
  ToolSelectField,
  ToolTextField,
  dateValueToTs,
} from "../tool-dialog";
import { usePetWorkspace } from "../workspace";

const KINDS = [
  { value: "vaccination", label: "Vaccination" },
  { value: "medication", label: "Medication" },
  { value: "vet_visit", label: "Vet visit" },
  { value: "custom", label: "Custom" },
] as const;

export default function PetRemindersPage() {
  const ws = usePetWorkspace();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("custom");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const ready = !!title.trim() && dateValueToTs(dueDate) !== undefined;

  async function handleCreate() {
    const dueAt = dateValueToTs(dueDate);
    if (!title.trim() || dueAt === undefined) return;
    setSaving(true);
    setError(null);
    try {
      await api.reminders.create({
        ownerId: ws.ownerId,
        petId: ws.petId,
        kind,
        title: title.trim(),
        dueAt,
      });
      await ws.refreshReminders();
      setOpen(false);
      setTitle("");
      setKind("custom");
      setDueDate("");
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? `Couldn’t save the reminder: ${e.message}`
          : "Couldn’t save the reminder. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(
    reminderId: string,
    status: "done" | "dismissed",
  ) {
    setActingId(reminderId);
    try {
      await api.reminders.setStatus(ws.ownerId, reminderId, status);
      await ws.refreshReminders();
    } finally {
      setActingId(null);
    }
  }

  const scheduled = ws.reminders
    .filter((r) => r.status === "scheduled")
    .sort((a, b) => a.dueAt - b.dueAt);
  const settled = ws.reminders.filter((r) => r.status !== "scheduled");

  return (
    <section aria-label="Reminders" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Reminders</h2>
          <p className="text-sm text-ink-soft">
            Upcoming care dates for {ws.pet.name}.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)} className="min-h-[44px] rounded-xl">
          <Plus size={16} aria-hidden="true" />
          Add reminder
        </Button>
      </div>

      {scheduled.length === 0 && settled.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
          <BellRing size={40} aria-hidden="true" className="text-ink-soft" />
          <p className="mt-2 font-semibold">Nothing scheduled</p>
          <p className="text-sm text-ink-soft">
            Booster due? Annual checkup? Put it here and relax.
          </p>
        </div>
      ) : (
        <ul className="flex list-none flex-col gap-2">
          {scheduled.map((r) => (
            <li
              key={r._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-xs"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{r.title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Due {formatDate(r.dueAt)} · {r.kind.replace(/_/g, " ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actingId === r._id}
                  onClick={() => void handleStatus(r._id, "done")}
                  className="min-h-[44px] rounded-xl"
                >
                  <Check size={14} aria-hidden="true" />
                  Done
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={actingId === r._id}
                  onClick={() => void handleStatus(r._id, "dismissed")}
                  className="min-h-[44px] rounded-xl"
                  aria-label={`Dismiss ${r.title}`}
                >
                  <X size={14} aria-hidden="true" />
                  Dismiss
                </Button>
              </div>
            </li>
          ))}
          {settled.map((r) => (
            <li
              key={r._id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-cream/50 p-4 opacity-70"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-soft line-through">
                  {r.title}
                </p>
                <p className="text-xs text-ink-soft">
                  {r.status} · was due {formatDate(r.dueAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ToolDialog
        open={open}
        onOpenChange={setOpen}
        title="Add reminder"
        description={`Schedule a care reminder for ${ws.pet.name}.`}
        submitLabel="Save reminder"
        submitting={saving}
        submitDisabled={!ready}
        error={error}
        onSubmit={() => void handleCreate()}
      >
        <ToolTextField
          id="reminder-title"
          label="Title"
          required
          value={title}
          onChange={setTitle}
          placeholder="e.g. Rabies booster"
          hint="What should we nudge you about?"
        />
        <ToolSelectField
          id="reminder-kind"
          label="Kind"
          value={kind}
          onChange={setKind}
          options={[...KINDS]}
        />
        <ToolDateField
          id="reminder-due"
          label="Due date"
          value={dueDate}
          onChange={setDueDate}
        />
      </ToolDialog>
    </section>
  );
}
