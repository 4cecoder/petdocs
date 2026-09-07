import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ROUTES } from "@/lib/routes";

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <h1 className="font-display text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Last updated: September 2026. Your pet records stay yours.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">What we collect</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Your email for sign in, pet profiles you create (name, species,
              breed, photo, microchip), documents you upload, and reminders
              you set. We also store basic billing status from Stripe. We
              never see or store full card numbers.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Where it lives</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Data is hosted on Convex in the US. Uploads are stored as
              private files tied to your account. Payments run through
              Stripe, which processes your card under its own privacy
              policy.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Share links</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Passports are private until you create a share link. Anyone
              with the link can view what you included, with no login. Links
              can expire and you can revoke them anytime in the dashboard.
              Only share what the recipient needs.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">What we never do</h2>
            <p className="mt-2 text-sm text-ink-soft">
              We never sell your data, never show ads, and never share pet
              records with third parties except to run the service (hosting,
              email, payments) or when required by law.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Deletion</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Delete a pet, document, or share link anytime and it is gone
              from your account. To delete your whole account and all data,
              email support@petdocs.app and we will confirm within 30 days.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Contact</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Privacy questions? Email support@petdocs.app and we will reply
              within 2 business days.
            </p>
          </section>
        </div>

        <nav
          aria-label="Legal"
          className="mt-8 flex flex-wrap gap-4 text-sm font-medium"
        >
          <Link href={ROUTES.home} className="hover:text-ink">
            Home
          </Link>
          <Link href={ROUTES.legal.terms} className="hover:text-ink">
            Terms
          </Link>
          <Link href={ROUTES.legal.refunds} className="hover:text-ink">
            Refunds
          </Link>
        </nav>
      </main>
      <Footer />
    </>
  );
}
