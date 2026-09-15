import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Hourly tick: pick up "scheduled" reminders due within 24h.
 * internal.reminders.sendDue sends via Resend then flips them to "sent"
 * (only on result.ok — failures stay scheduled for retry next hour).
 */
crons.interval("reminder tick", { hours: 1 }, internal.reminders.sendDue, {});

crons.daily(
  "overdue flip",
  { hourUTC: 8, minuteUTC: 0 },
  internal.vaccinations.flipOverdue,
  {},
);

/**
 * Doc pipeline retry sweep (issue #23): re-arm documents stuck in
 * "failed" and reschedule their processing. Bounded batch of 10 per run.
 */
crons.interval(
  "doc pipeline retry sweep",
  { hours: 6 },
  internal.docPipeline.retryFailed,
  { limit: 10 },
);

export default crons;
