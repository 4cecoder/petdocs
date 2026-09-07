import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ROUTES } from "@/lib/routes";

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <h1 className="font-display text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Last updated: September 2026. Plain English, short on purpose.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">What petdocs is</h2>
            <p className="mt-2 text-sm text-ink-soft">
              petdocs is a vault for your pet records. Add pets, snap photos
              of vaccine certs, labs, and prescriptions, track due dates, and
              share a read only passport link with your vet, groomer, or
              boarder.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Plans and billing</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Free covers 1 pet. Plus is $6.99 per month or $69 per year for
              up to 5 pets. Family is $9.99 per month for up to 10 pets.
              Travel packets are a one time $9 purchase. Prices are in USD.
              We bill through Stripe and show the full price and renewal date
              before you pay.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Cancel anytime</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Cancel in Settings in two taps. You keep paid features until
              the end of the billing period. Monthly plans are not refunded
              for a used month. Annual plans are refundable within 14 days.
              See Refunds for details.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Acceptable use</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Only upload records you own or have permission to store. Do not
              share passport links publicly if they contain sensitive info.
              Do not misuse share links, scrape the service, or upload
              unlawful content. We may suspend accounts that abuse the
              service.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Accuracy and liability</h2>
            <p className="mt-2 text-sm text-ink-soft">
              petdocs stores photos and reminders but is not veterinary
              advice. Always confirm due dates with your vet. To the extent
              allowed by law, our liability is capped at what you paid in the
              prior 12 months.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Contact</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Questions about these terms? Email support@petdocs.app and we
              will reply within 2 business days.
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
          <Link href={ROUTES.legal.privacy} className="hover:text-ink">
            Privacy
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
