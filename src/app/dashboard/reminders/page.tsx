/** Chronological due list. TODO(convex): reminders.listByOwner + done/dismiss. */
export default function RemindersPage() {
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
        { title: "Overdue", empty: "Nothing overdue. 🎉" },
        { title: "This week", empty: "Nothing due this week." },
        { title: "Later", empty: "Nothing scheduled later." },
      ].map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="mb-2 font-display font-bold">{group.title}</h2>
          <p className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-4 text-center text-sm text-ink-soft">
            {group.empty}
          </p>
        </section>
      ))}
    </div>
  );
}
