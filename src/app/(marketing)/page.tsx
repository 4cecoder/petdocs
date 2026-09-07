import Link from "next/link";
import { Camera, Link2, PawPrint } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ROUTES } from "@/lib/routes";

export default function MarketingHome() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-28">
        <section className="mx-auto max-w-2xl text-center">
          <PawPrint
            size={56}
            aria-hidden="true"
            className="mx-auto text-brand-600"
          />
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Own your pet&apos;s docs
          </h1>
          <p className="mt-4 text-lg text-ink-soft">
            Every vaccine, lab result, and prescription in one vault. Prove
            vaccination in under 30 seconds. Share a pet passport with your
            vet, groomer, or boarder.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={ROUTES.onboarding}
              className="min-h-[48px] rounded-2xl bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
            >
              Get started: it&apos;s free
            </Link>
            <Link
              href={ROUTES.howItWorks}
              className="min-h-[48px] rounded-2xl border border-ink/15 bg-white px-8 py-3 font-semibold hover:bg-cream-dark"
            >
              How it works
            </Link>
          </div>
        </section>

        <section aria-label="How it works" className="mx-auto mt-16 grid max-w-4xl gap-4 md:grid-cols-3">
          {[
            {
              Icon: PawPrint,
              title: "1. Add your pet",
              body: "Name, species, photo, microchip. Under a minute.",
            },
            {
              Icon: Camera,
              title: "2. Snap your docs",
              body: "Vaccine certs, labs, prescriptions. Camera-first upload.",
            },
            {
              Icon: Link2,
              title: "3. Share the passport",
              body: "One read-only link + QR. No login needed for vets.",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-ink/10 bg-white p-6 text-center shadow-sm"
            >
              <step.Icon
                size={32}
                aria-hidden="true"
                className="mx-auto text-brand-600"
              />
              <h2 className="mt-2 font-display font-bold">{step.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
