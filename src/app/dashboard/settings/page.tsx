import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <section className="rounded-2xl border border-ink/10 bg-white p-4" aria-label="Account">
        <h2 className="font-display font-bold">Account</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Email, notifications, and plan live here once Convex auth lands.
        </p>
      </section>
      <section className="rounded-2xl border border-ink/10 bg-white p-4" aria-label="Danger zone">
        <h2 className="font-display font-bold">Trash</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Deleted documents can be restored or permanently emptied here.
        </p>
      </section>
      <section className="rounded-2xl border border-ink/10 bg-white p-4" aria-label="Internal">
        <h2 className="font-display font-bold">Internal</h2>
        <p className="mt-1 text-sm text-ink-soft">
          <Link
            href="/dashboard/admin"
            className="font-medium text-brand-700 underline"
          >
            Product admin
          </Link>{" "}
          for the PetDocs team.
        </p>
      </section>
    </div>
  );
}
