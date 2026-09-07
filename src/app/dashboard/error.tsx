"use client";

import Link from "next/link";
import { PetArt } from "@/components/art/PetArt";
import { ROUTES } from "@/lib/routes";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-white px-8 py-10 shadow-sm">
        <PetArt name="siren" size={120} />
        <h1 className="font-display text-2xl font-bold">
          This page chewed a shoe
        </h1>
        <p className="text-ink-soft">
          Give it another go. Your vault is fine.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
          >
            Try again
          </button>
          <Link
            href={ROUTES.dashboard.root}
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-ink/10 bg-white px-6 font-semibold text-ink hover:bg-cream-dark"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
