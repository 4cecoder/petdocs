import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Hourly tick: pick up "scheduled" reminders due within 24h.
 * internal.reminders.sendDue currently flips them to "sent" (real
 * resend/FCM send is a TODO inside the action) — see reminders.ts.
 */
crons.interval("reminder tick", { hours: 1 }, internal.reminders.sendDue, {});

// Future: daily overdue flip (vaccinations status due → overdue once dueAt
// passes). Intentionally omitted — it needs an internalMutation in
// vaccinations.ts, which this change doesn't own. Once that exists, add e.g.
// crons.daily(
//   "overdue flip",
//   { hourUTC: 8, minuteUTC: 0 },
//   internal.vaccinations.flipOverdue,
//   {},
// );

export default crons;
