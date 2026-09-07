"use client";

export interface ReminderItem {
  id: string;
  title: string;
  petName: string;
  dueLabel: string;
  overdue?: boolean;
}

export function ReminderRow({
  reminder,
  onDone,
  onSnooze,
}: {
  reminder: ReminderItem;
  onDone?: (id: string) => void;
  onSnooze?: (id: string) => void;
}) {
  return (
    <li className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3">
      <button
        type="button"
        aria-label={`Mark done: ${reminder.title} for ${reminder.petName}`}
        onClick={() => onDone?.(reminder.id)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/15 text-lg hover:bg-cream"
      >
        ☐
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{reminder.title}</p>
        <p className="text-xs text-ink-soft">
          {reminder.petName} ·{" "}
          <span className={reminder.overdue ? "font-bold text-red-600" : undefined}>
            {reminder.dueLabel}
          </span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => onSnooze?.(reminder.id)}
        className="min-h-[48px] shrink-0 rounded-xl px-3 text-sm font-medium text-ink-soft hover:bg-cream"
      >
        Snooze
      </button>
    </li>
  );
}
