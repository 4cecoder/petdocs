import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ROUTES } from "@/lib/routes";

export default function RefundsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <h1 className="font-display text-3xl font-bold">Refund Policy</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Last updated: September 2026. Simple and pet owner friendly.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Monthly plans</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Cancel anytime in Settings. You keep Plus or Family until the
              end of the paid month. We do not refund a used month, and you
              are never charged again after you cancel.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">Annual plans</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Plus annual ($69 per year) is refundable within 14 days of
              purchase or renewal. Email support@petdocs.app and we will
              refund the full year and move you to Free.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">$9 packets</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Travel and claim packets ($9 one time) are refundable if
              unused. Once you generate or share the packet, it is
              nonrefundable.
            </p>
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="font-display font-bold">How to ask</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Email support@petdocs.app from your account email with the
              charge date. We reply within 2 business days and refunds land
              in 5 to 10 days via Stripe.
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
          <Link href={ROUTES.legal.privacy} className="hover:text-ink">
            Privacy
          </Link>
        </nav>
      </main>
      <Footer />
    </>
  );
}
