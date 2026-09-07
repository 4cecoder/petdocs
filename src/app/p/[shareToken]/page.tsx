import Link from "next/link";
import { VaccineBadge, type VaccineStatus } from "@/components/pets/VaccineBadge";
import { ROUTES } from "@/lib/routes";

/**
 * Public pet passport — NO auth, NO dashboard shell.
 *
 * Resolves the share token server-side via the Convex HTTP API
 * (`shareLinks:resolve`) and renders only the scoped projection.
 * Must never leak other pets, owner email, or storageIds — `resolve`
 * doesn't return them, and this page only reads Passport fields
 * (scope / pet / vaccinations / documents).
 */

// Scoped projection returned by `shareLinks:resolve`. Deliberately narrow:
// no owner email, no storageIds — only what the owner chose to share.
interface PassportVaccination {
  vaccineName: string;
  status: string;
  administeredAt?: number;
  dueAt?: number;
}

interface PassportDoc {
  id: string;
  name: string;
  category?: string;
  url: string | null;
}

interface Passport {
  scope: string;
  pet: { name: string; species: string; breed?: string; birthdate?: number };
  vaccinations: PassportVaccination[];
  documents: PassportDoc[];
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Overall badge: any overdue → expired; any due within 30d → expiring. */
function deriveStatus(vaccinations: PassportVaccination[]): VaccineStatus {
  const now = Date.now();
  if (
    vaccinations.some(
      (v) => v.status === "overdue" || (typeof v.dueAt === "number" && v.dueAt < now),
    )
  ) {
    return "expired";
  }
  if (
    vaccinations.some(
      (v) =>
        v.status === "due" ||
        (typeof v.dueAt === "number" && v.dueAt - now <= THIRTY_DAYS_MS),
    )
  ) {
    return "expiring";
  }
  return "valid";
}

function formatAge(birthdate?: number): string {
  if (!birthdate) return "—";
  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return "—";
  const now = new Date();
  let months =
    (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return "—";
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years} yr` : `${years} yr ${rem} mo`;
}

function formatDate(ts?: number): string {
  if (ts == null) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function resolvePassport(
  convexUrl: string,
  token: string,
): Promise<Passport | null> {
  try {
    const res = await fetch(`${convexUrl}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "shareLinks:resolve",
        args: { token },
        format: "json",
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as
      | { value: Passport | null }
      | { error: string; errorMessage?: string };
    if ("error" in body) return null;
    return body.value ?? null;
  } catch {
    return null;
  }
}

/** Fire-and-forget view count — never blocks or fails the page. */
function fireRecordView(convexUrl: string, token: string): void {
  try {
    void fetch(`${convexUrl}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "shareLinks:recordView",
        args: { token },
        format: "json",
      }),
    }).catch(() => {
      /* noop */
    });
  } catch {
    /* noop */
  }
}

/** Rendered when the backend URL is missing (local scaffold / demo). */
function PlaceholderPassport({ shareToken }: { shareToken: string }) {
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

      <PassportFooter />
    </main>
  );
}

function PassportFooter() {
  return (
    <footer className="mt-8 text-center text-sm text-ink-soft">
      <p>
        Powered by{" "}
        <Link href={ROUTES.home} className="font-semibold text-brand-700">
          petdocs
        </Link>{" "}
        — own your pet&apos;s docs.
      </p>
    </footer>
  );
}

export default async function PublicPassportPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl || !convexUrl.startsWith("http")) {
    return <PlaceholderPassport shareToken={shareToken} />;
  }

  const passport = await resolvePassport(convexUrl, shareToken);

  if (!passport) {
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
        </header>
        <section
          aria-label="Link status"
          className="mt-8 rounded-2xl border border-ink/10 bg-white p-5 text-center"
        >
          <p className="font-semibold">This link is expired or revoked.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Ask the owner for a fresh passport link — they can create one in
            seconds.
          </p>
          <Link
            href={ROUTES.home}
            className="mt-4 inline-block min-h-[48px] rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Back to petdocs home
          </Link>
        </section>
        <PassportFooter />
      </main>
    );
  }

  fireRecordView(convexUrl, shareToken);

  const status = deriveStatus(passport.vaccinations);
  const { pet, vaccinations, documents } = passport;

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <header className="text-center">
        <p className="text-5xl" aria-hidden="true">
          🐾
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          petdocs passport
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">{pet.name}</h1>
        <p className="mt-1 text-sm capitalize text-ink-soft">
          {pet.species}
          {pet.breed ? ` · ${pet.breed}` : ""} · {formatAge(pet.birthdate)}
        </p>
        <div className="mt-3 flex justify-center">
          <VaccineBadge status={status} />
        </div>
      </header>

      <section
        aria-label="Vaccinations"
        className="mt-8 rounded-2xl border border-ink/10 bg-white p-5"
      >
        <h2 className="font-display font-bold">Vaccinations</h2>
        {vaccinations.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">
            No vaccination records shared with this link yet.
          </p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-soft">
                <th scope="col" className="pb-2 pr-2 font-semibold">
                  Vaccine
                </th>
                <th scope="col" className="pb-2 pr-2 font-semibold">
                  Status
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {vaccinations.map((v) => (
                <tr key={v.vaccineName} className="border-t border-ink/10">
                  <td className="py-2 pr-2 font-medium">{v.vaccineName}</td>
                  <td className="py-2 pr-2 capitalize text-ink-soft">{v.status}</td>
                  <td className="py-2 text-ink-soft">
                    {formatDate(v.administeredAt ?? v.dueAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {documents.length > 0 && (
        <section
          aria-label="Documents"
          className="mt-4 rounded-2xl border border-ink/10 bg-white p-5"
        >
          <h2 className="font-display font-bold">Documents</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {documents.map((d) => (
              <li key={d.id}>
                {d.url ? (
                  <a
                    href={d.url}
                    className="font-semibold text-brand-700 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {d.name}
                  </a>
                ) : (
                  <span className="font-medium">{d.name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-label="Contact"
        className="mt-4 rounded-2xl border border-ink/10 bg-white p-5"
      >
        <h2 className="font-display font-bold">Owner contact</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Shared contact details appear here (never the full vault).
        </p>
      </section>

      <p className="mt-4 text-center text-xs text-ink-soft">
        Read-only link — it may expire or be revoked by the owner at any time.
      </p>

      <PassportFooter />
    </main>
  );
}
