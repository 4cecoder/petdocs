import Link from "next/link";
import { VaccineBadge } from "@/components/pets/VaccineBadge";
import { ROUTES } from "@/lib/routes";

/**
 * Public pet passport — NO auth, NO dashboard shell.
 * TODO(convex): shareLinks.resolve({ token }) → scoped projection.
 * Must never leak other pets, owner email, or storageIds.
 */
export default async function PublicPassportPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <header className="text-center">
        <p className="text-5xl" aria-hidden="true">
          🐾
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          petdocs passport
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">Shared pet profile</h1>
        <p className="mt-1 text-sm text-ink-soft">Link: {shareToken}</p>
        <div className="mt-3 flex justify-center">
          <VaccineBadge status="valid" />
        </div>
      </header>

      <section
        aria-label="Vaccinations"
        className="mt-8 rounded-2xl border border-ink/10 bg-white p-5"
      >
        <h2 className="font-display font-bold">Vaccinations</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Verified records will appear here once the owner connects their vault.
        </p>
      </section>

      <section
        aria-label="Contact"
        className="mt-4 rounded-2xl border border-ink/10 bg-white p-5"
      >
        <h2 className="font-display font-bold">Owner contact</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Shared contact details appear here (never the full vault).
        </p>
      </section>

      <footer className="mt-8 text-center text-sm text-ink-soft">
        <p>
          Powered by{" "}
          <Link href={ROUTES.home} className="font-semibold text-brand-700">
            petdocs
          </Link>{" "}
          — own your pet&apos;s docs.
        </p>
      </footer>
    </main>
  );
}
