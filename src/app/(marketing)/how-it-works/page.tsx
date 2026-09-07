import Link from "next/link";
import { Camera, Link2, PawPrint, Syringe } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ROUTES } from "@/lib/routes";

export default function HowItWorksPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <h1 className="font-display text-3xl font-bold">How it works</h1>
        <ol className="mt-8 flex flex-col gap-4">
          {[
            {
              Icon: PawPrint,
              title: "Add your pet",
              body: "Name, species, breed, photo, microchip number. One minute, on your phone.",
            },
            {
              Icon: Camera,
              title: "Snap your docs",
              body: "Point the camera at a rabies cert, lab result, or prescription. Pick a type, save. It lands in the vault and on the timeline.",
            },
            {
              Icon: Syringe,
              title: "Track vaccines & meds",
              body: "Due dates for rabies, DHPP, Bordetella, plus daily meds like Apoquel. Reminders keep you ahead.",
            },
            {
              Icon: Link2,
              title: "Share the passport",
              body: "Create a read-only link with an expiry date. Text it to the boarder, show the QR at the groomer. Revoke anytime.",
            },
          ].map((step, i) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-2xl border border-ink/10 bg-white p-5"
            >
              <step.Icon
                size={28}
                aria-hidden="true"
                className="shrink-0 text-brand-600"
              />
              <div>
                <h2 className="font-display font-bold">
                  Step {i + 1}: {step.title}
                </h2>
                <p className="mt-1 text-ink-soft">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <Link
            href={ROUTES.onboarding}
            className="inline-block min-h-[48px] rounded-2xl bg-brand-600 px-8 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Add your first pet
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
