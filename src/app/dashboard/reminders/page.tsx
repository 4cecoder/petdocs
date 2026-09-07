"use client";

import { useEffect, useMemo, useState } from "react";
import { PetArt } from "@/components/art/PetArt";
import { ReminderRow, type ReminderItem } from "@/components/reminders/ReminderRow";
import { api, getOwnerId, isBackendConfigured, type Pet, type Reminder } from "@/lib/api";
import { convexMutation } from "@/lib/convexHttp";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toItem(reminder: Reminder, petName: string, now: number): ReminderItem {
  return {
    id: reminder._id,
    title: reminder.title,
    petName,
    dueLabel: new Date(reminder.dueAt).toLocaleDateString(),
    overdue: reminder.dueAt < now,
  };
}

/** Chronological due list. */
export default function RemindersPage() {
  const ownerId = getOwnerId();
  const backend = isBackendConfigured;

  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [petId, setPetId] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId || !backend) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.pets.list(ownerId), api.reminders.list(ownerId)])
      .then(([petRows, reminderRows]) => {
        if (cancelled) return;
        setPets(petRows);
        setReminders(reminderRows);
        setPetId((prev) => {
          if (prev) return prev;
          const first = petRows[0];
          return first ? first._id : prev;
        });
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load reminders.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, backend]);

  const petNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const pet of pets) map.set(pet._id, pet.name);
    return map;
  }, [pets]);

  const groups = useMemo(() => {
    const now = Date.now();
    const overdue: Reminder[] = [];
    const thisWeek: Reminder[] = [];
    const later: Reminder[] = [];
    for (const r of reminders ?? []) {
      if (r.dueAt < now) overdue.push(r);
      else if (r.dueAt < now + WEEK_MS) thisWeek.push(r);
      else later.push(r);
    }
    return [
      { title: "Overdue", empty: "Nothing overdue — nice work.", items: overdue, now },
      {
        title: "This week",
        empty: "Nothing due this week — enjoy the calm.",
        items: thisWeek,
        now,
      },
      {
        title: "Later",
        empty: "Nothing scheduled later — future you says thanks.",
        items: later,
        now,
      },
    ];
  }, [reminders]);

  if (!ownerId || !backend) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Reminders</h1>
          <button
            type="button"
            className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Reminder
          </button>
        </div>
        {[
          { title: "Overdue", empty: "Nothing overdue — nice work." },
          { title: "This week", empty: "Nothing due this week — enjoy the calm." },
          { title: "Later", empty: "Nothing scheduled later — future you says thanks." },
        ].map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="mb-2 font-display font-bold">{group.title}</h2>
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white/60 p-4 text-center text-sm text-ink-soft">
              <PetArt name="clock" size={96} />
              <p className="mt-2 text-base font-semibold text-ink">
                All clear — for now
              </p>
              <p className="mt-1">{group.empty}</p>
            </div>
          </section>
        ))}
      </div>
    );
  }

  async function handleDone(id: string) {
    if (!ownerId) return;
    setActionError(null);
    try {
      await api.reminders.setStatus(ownerId, id, "done");
      setReminders((prev) => (prev ?? []).filter((r) => r._id !== id));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not update reminder.");
    }
  }

  async function handleSnooze(id: string) {
    if (!ownerId) return;
    setActionError(null);
    try {
      await api.reminders.setStatus(ownerId, id, "dismissed");
      setReminders((prev) => (prev ?? []).filter((r) => r._id !== id));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Could not update reminder.");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerId) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setFormError("Title is required.");
      return;
    }
    if (!petId) {
      setFormError("Choose a pet.");
      return;
    }
    const dueAt = date ? new Date(`${date}T12:00:00`).getTime() : NaN;
    if (!date || Number.isNaN(dueAt)) {
      setFormError("Pick a due date.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const id = await convexMutation<string>("reminders:create", {
        ownerId,
        petId,
        kind: "custom",
        title: trimmed,
        dueAt,
      });
      setReminders((prev) =>
        [
          ...(prev ?? []),
          {
            _id: id,
            petId,
            kind: "custom",
            title: trimmed,
            dueAt,
            status: "scheduled",
          } satisfies Reminder,
        ].sort((a, b) => a.dueAt - b.dueAt),
      );
      setTitle("");
      setDate("");
      setShowForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not add reminder.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Reminders</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showForm ? "Cancel" : "+ Reminder"}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Title
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Annual checkup"
                required
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Due date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Pet
              <select
                value={petId}
                onChange={(e) => setPetId(e.target.value)}
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3"
              >
                {pets.map((pet) => (
                  <option key={pet._id} value={pet._id}>
                    {pet.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={creating}
            className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {creating ? "Adding…" : "Add reminder"}
          </button>
        </form>
      ) : null}

      <div aria-live="polite">
        {loading ? (
          <p role="status" className="text-sm text-ink-soft">
            Loading reminders…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {actionError}
          </p>
        ) : null}
      </div>

      {!loading && !error
        ? groups.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h2 className="mb-2 font-display font-bold">{group.title}</h2>
              {group.items.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white/60 p-4 text-center text-sm text-ink-soft">
                  <PetArt name="clock" size={96} />
                  <p className="mt-2 text-base font-semibold text-ink">
                    All clear — for now
                  </p>
                  <p className="mt-1">{group.empty}</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {group.items.map((reminder) => (
                    <ReminderRow
                      key={reminder._id}
                      reminder={toItem(
                        reminder,
                        petNames.get(reminder.petId) ?? "Your pet",
                        group.now,
                      )}
                      onDone={handleDone}
                      onSnooze={handleSnooze}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))
        : null}
    </div>
  );
}
