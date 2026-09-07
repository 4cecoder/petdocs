import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/**
 * Dashboard home: pet cards + due-soon reminders + quick upload.
 * TODO(convex): pets.listByOwner + reminders.listByOwner(upcomingOnly).
 */
export default function DashboardHome() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Good morning 🐾</h1>
        <Link
          href={ROUTES.dashboard.pets}
          className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Add pet
        </Link>
      </div>

      <section aria-label="Your pets">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-6 text-center text-sm text-ink-soft">
            Your pets will appear here.
            <br />
            Add your first pet to create its vault.
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
          <li className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-4 text-center text-sm text-ink-soft">
            No upcoming reminders. Boosters and meds will show up here.
          </li>
        </ul>
        {/* Example once wired: <ReminderRow reminder={...} /> */}
      </section>
    </div>
  );
}
