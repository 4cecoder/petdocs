import Link from "next/link";
import { PetArt } from "@/components/art/PetArt";
import { ROUTES } from "@/lib/routes";

/**
 * Dashboard home: pet cards + due-soon reminders + quick upload.
 * TODO(convex): pets.listByOwner + reminders.listByOwner(upcomingOnly).
 */
export default function DashboardHome() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Good morning</h1>
        <Link
          href={ROUTES.dashboard.pets}
          className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Add pet
        </Link>
      </div>

      <section aria-label="Your pets">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white/60 p-6 text-center text-sm text-ink-soft">
            <PetArt name="happy" size={120} />
            <p className="mt-2 text-base font-semibold text-ink">
              Your pack starts here
            </p>
            <p className="mt-1">
              Add your first pet. Photos, vax, and visits in one place.
            </p>
          </div>
        </div>
        {/* Example once wired: <PetCard pet={...} dueCount={1} /> */}
      </section>

      <section aria-label="Due soon">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Due soon</h2>
          <Link
            href={ROUTES.dashboard.reminders}
            className="min-h-[48px] px-2 py-2 text-sm font-medium text-brand-700"
          >
            View all
          </Link>
        </div>
        <ul className="mt-2 flex flex-col gap-2">
          <li className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white/60 p-4 text-center text-sm text-ink-soft">
            <PetArt name="clock" size={96} />
            <p className="mt-2 text-base font-semibold text-ink">
              All clear for now
            </p>
            <p className="mt-1">
              Boosters and meds will show up here when they matter.
            </p>
          </li>
        </ul>
        {/* Example once wired: <ReminderRow reminder={...} /> */}
      </section>
    </div>
  );
}
