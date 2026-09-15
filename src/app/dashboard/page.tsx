"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  PawPrint,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { PetArt } from "@/components/art/PetArt";
import { AddToCalendarButton } from "@/components/calendar/AddToCalendarButton";
import { reminderCalendarEvent } from "@/lib/calendar";
import {
  api,
  getOwnerId,
  isBackendConfigured,
  type Pet,
  type Reminder,
} from "@/lib/api";
import { petHref, ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatAge(birthdate?: number): string {
  if (!birthdate) return "Age not set";
  const now = Date.now();
  const diffMs = now - birthdate;
  if (diffMs < 0) return "Just arrived";
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30.4375);
  const diffYears = Math.floor(diffDays / 365.25);

  if (diffYears >= 1) {
    const remMonths = diffMonths % 12;
    if (remMonths > 0 && diffYears < 3) {
      return `${diffYears} yr${diffYears > 1 ? "s" : ""} ${remMonths} mo${remMonths > 1 ? "s" : ""}`;
    }
    return `${diffYears} yr${diffYears > 1 ? "s" : ""} old`;
  }
  if (diffMonths >= 1) {
    return `${diffMonths} mo${diffMonths > 1 ? "s" : ""} old`;
  }
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks >= 1) {
    return `${diffWeeks} wk${diffWeeks > 1 ? "s" : ""} old`;
  }
  return `${diffDays} day${diffDays === 1 ? "" : "s"} old`;
}

function getSpeciesEmoji(species: string): string {
  const s = species.toLowerCase();
  if (s === "dog") return "🐕";
  if (s === "cat") return "🐈";
  if (s === "bird") return "🦜";
  if (s === "rabbit") return "🐇";
  if (s === "reptile") return "🦎";
  return "🐾";
}

function formatDueLabel(dueAt: number): { label: string; overdue: boolean } {
  const now = Date.now();
  const diffDays = Math.ceil((dueAt - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)}d overdue`,
      overdue: true,
    };
  }
  if (diffDays === 0) {
    return { label: "Due today", overdue: false };
  }
  if (diffDays === 1) {
    return { label: "Due tomorrow", overdue: false };
  }
  if (diffDays <= 7) {
    return { label: `Due in ${diffDays} days`, overdue: false };
  }
  return {
    label: `Due ${new Date(dueAt).toLocaleDateString()}`,
    overdue: false,
  };
}

export default function DashboardHome() {
  const ownerId = getOwnerId();
  const backend = isBackendConfigured;

  const [pets, setPets] = useState<Pet[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [vaultDocCount, setVaultDocCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId || !backend) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.pets.list(ownerId),
      api.reminders.list(ownerId, true),
    ])
      .then(async ([petList, reminderList]) => {
        if (cancelled) return;
        setPets(petList);
        setReminders(reminderList);

        // Fetch document counts across all pets for the 3-stat summary
        if (petList.length > 0) {
          try {
            const docLists = await Promise.all(
              petList.map((p) => api.documents.list(ownerId, p._id)),
            );
            if (!cancelled) {
              const totalDocs = docLists.reduce((acc, d) => acc + d.length, 0);
              setVaultDocCount(totalDocs);
            }
          } catch {
            // Document count query failure should not break dashboard
          }
        } else {
          setVaultDocCount(0);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load dashboard data.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ownerId, backend]);

  async function handleReminderStatus(
    reminderId: string,
    status: "done" | "dismissed",
  ) {
    if (!ownerId || !backend) return;
    setActionInProgress(reminderId);
    try {
      await api.reminders.setStatus(ownerId, reminderId, status);
      // Optimistically remove from upcoming list
      setReminders((prev) => prev.filter((r) => r._id !== reminderId));
    } catch {
      // Revert if mutation fails
    } finally {
      setActionInProgress(null);
    }
  }

  const petMap = new Map(pets.map((p) => [p._id, p]));

  return (
    <div className="flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">
              {getGreeting()}
            </h1>
            {!loading && (
              <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-0.5 text-xs font-semibold text-brand-700">
                {pets.length} {pets.length === 1 ? "pet" : "pets"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Keep track of health records, vaccines, and upcoming care in one place.
          </p>
        </div>

        <Link
          href={ROUTES.dashboard.pets}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 transition"
        >
          <Plus size={18} />
          <span>Add pet</span>
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* 3-Stat Summary Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-xs">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <PawPrint size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Total Pets
            </p>
            <p className="font-display text-2xl font-bold text-ink">
              {loading ? "…" : pets.length}
            </p>
            <p className="text-xs text-ink-soft">Active health profiles</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-xs">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Bell size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Due Soon
            </p>
            <p className="font-display text-2xl font-bold text-ink">
              {loading ? "…" : reminders.length}
            </p>
            <p className="text-xs text-ink-soft">Vaccines & checkups</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-xs">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Vault Records
            </p>
            <p className="font-display text-2xl font-bold text-ink">
              {loading ? "…" : vaultDocCount}
            </p>
            <p className="text-xs text-ink-soft">Protected health files</p>
          </div>
        </div>
      </div>

      {/* Pet Cards Section */}
      <section aria-label="Your pets" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">Your pets</h2>
          {pets.length > 0 && (
            <Link
              href={ROUTES.dashboard.pets}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Manage pets
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl border border-ink/10 bg-white/60 p-5"
              />
            ))}
          </div>
        ) : pets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink/20 bg-white/70 p-10 text-center">
            <PetArt name="happy" size={130} />
            <h3 className="mt-4 font-display text-lg font-bold text-ink">
              Your pack starts here
            </h3>
            <p className="mt-1 max-w-sm text-sm text-ink-soft">
              Add your first pet to organize vaccinations, vet visits, and emergency
              health passports in one secure place.
            </p>
            <Link
              href={ROUTES.dashboard.pets}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 transition"
            >
              <Plus size={18} />
              <span>Add your first pet</span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map((pet) => {
              const petDueCount = reminders.filter(
                (r) => r.petId === pet._id,
              ).length;
              const emoji = getSpeciesEmoji(pet.species);

              return (
                <Link
                  key={pet._id}
                  href={petHref(pet._id)}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-ink/10 bg-white p-5 shadow-xs transition-all hover:border-brand-500/50 hover:shadow-md"
                >
                  <div>
                    {/* Species Avatar & Status Pill */}
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-dark text-2xl shadow-inner">
                        <span role="img" aria-label={pet.species}>
                          {emoji}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-semibold capitalize text-ink-soft">
                          {pet.species}
                        </span>
                        {petDueCount > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            {petDueCount} due
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pet Details */}
                    <div className="mt-4">
                      <h3 className="font-display text-xl font-bold text-ink group-hover:text-brand-600 transition-colors">
                        {pet.name}
                      </h3>
                      <p className="text-sm text-ink-soft">
                        {pet.breed || "Breed unspecified"}
                      </p>
                    </div>

                    {/* Attributes Bar */}
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
                      <span>{formatAge(pet.birthdate)}</span>
                      {pet.weightKg ? <span>· {pet.weightKg} kg</span> : null}
                      {pet.microchipId ? (
                        <span className="text-teal-700 font-medium">· Chipped</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="mt-5 flex items-center justify-between border-t border-ink/5 pt-3 text-xs font-semibold text-brand-700">
                    <span>View passport & records</span>
                    <span className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Due Soon Reminders Section */}
      <section aria-label="Due soon" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold text-ink">Due soon</h2>
            {reminders.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                {reminders.length}
              </span>
            )}
          </div>
          <Link
            href={ROUTES.dashboard.reminders}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="h-16 animate-pulse rounded-2xl bg-white/60" />
            <div className="h-16 animate-pulse rounded-2xl bg-white/60" />
          </div>
        ) : reminders.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white/70 p-8 text-center text-sm text-ink-soft">
            <PetArt name="clock" size={96} />
            <p className="mt-3 font-display text-base font-bold text-ink">
              All clear for now
            </p>
            <p className="mt-1 max-w-sm">
              Vaccine boosters, medications, and vet visits will appear here when
              they need attention.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {reminders.map((reminder) => {
              const pet = petMap.get(reminder.petId);
              const { label, overdue } = formatDueLabel(reminder.dueAt);
              const isMutating = actionInProgress === reminder._id;

              return (
                <li
                  key={reminder._id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-xs transition hover:border-ink/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => handleReminderStatus(reminder._id, "done")}
                      aria-label={`Mark done: ${reminder.title}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/20 text-ink-soft hover:border-brand-600 hover:bg-brand-50 hover:text-brand-600 transition disabled:opacity-50"
                    >
                      <CheckCircle2 size={20} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">
                        {reminder.title}
                      </p>
                      <p className="text-xs text-ink-soft">
                        <span className="font-medium text-ink">
                          {pet?.name || "Pet"}
                        </span>{" "}
                        ·{" "}
                        <span
                          className={cn(
                            overdue
                              ? "font-bold text-red-600"
                              : "text-amber-700 font-medium",
                          )}
                        >
                          {label}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <AddToCalendarButton
                      variant="menu"
                      event={reminderCalendarEvent(
                        {
                          id: reminder._id,
                          title: reminder.title,
                          dueAt: reminder.dueAt,
                          kind: reminder.kind,
                        },
                        pet?.name || "Pet",
                      )}
                    />
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => handleReminderStatus(reminder._id, "done")}
                      className="hidden sm:inline-flex min-h-[38px] items-center rounded-xl bg-brand-50 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition disabled:opacity-50"
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() =>
                        handleReminderStatus(reminder._id, "dismissed")
                      }
                      className="min-h-[38px] rounded-xl px-2.5 text-xs font-medium text-ink-soft hover:bg-cream hover:text-ink transition disabled:opacity-50"
                      title="Dismiss reminder"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
