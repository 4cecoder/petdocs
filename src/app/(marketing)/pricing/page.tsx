import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ROUTES } from "@/lib/routes";

export default function PricingPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-28">
        <h1 className="text-center font-display text-3xl font-bold">
          Simple pricing
        </h1>
        <p className="mt-2 text-center text-ink-soft">
          Start free. Upgrade when your pack grows.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              name: "Free",
              price: "$0",
              features: ["1 pet", "25 documents", "1 share link"],
            },
            {
              name: "Plus",
              price: "$6.99/mo",
              features: ["Up to 5 pets", "Unlimited docs", "Reminders + QR passport"],
            },
            {
              name: "Family",
              price: "$9.99/mo",
              features: ["Up to 10 pets", "Co-owners", "Priority support"],
            },
          ].map((tier) => (
            <div
              key={tier.name}
              className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"
            >
              <h2 className="font-display font-bold">{tier.name}</h2>
              <p className="mt-1 text-2xl font-bold">{tier.price}</p>
              <ul className="mt-4 flex flex-col gap-2 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden="true">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href={ROUTES.onboarding}
            className="inline-block min-h-[48px] rounded-2xl bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Start free
          </Link>
        </div>
        <p className="mt-8 text-center text-xs text-ink-soft">
          Cancel anytime in Settings. Annual plans refundable within 14 days
          (see{" "}
          <Link href={ROUTES.legal.refunds} className="underline">
            Refunds
          </Link>
          ). Prices in USD. Receipts by email.
        </p>
      </main>
      <Footer />
    </>
  );
}
