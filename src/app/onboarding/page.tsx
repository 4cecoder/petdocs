"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PET_SPECIES, validatePetName } from "@/lib/validators";
import { ROUTES } from "@/lib/routes";

const STEPS = ["Add your pet", "Upload a doc", "Done"] as const;

/** 3-step onboarding, resumable, skippable — goal <3 minutes. */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<string>("dog");
  const [error, setError] = useState<string | null>(null);

  function handleAddPet(e: React.FormEvent) {
    e.preventDefault();
    const problem = validatePetName(petName);
    if (problem) {
      setError(problem);
      return;
    }
    // TODO(convex): pets.create({ name, species }) → petId.
    setError(null);
    setStep(1);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <ol aria-label="Onboarding progress" className="flex gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`h-2 flex-1 rounded-full ${i <= step ? "bg-brand-600" : "bg-ink/10"}`}
          />
        ))}
      </ol>

      {step === 0 ? (
        <form onSubmit={handleAddPet} className="mt-8 flex flex-col gap-3">
          <h1 className="font-display text-2xl font-bold">Add your first pet 🐶</h1>
          <label className="flex flex-col gap-1 font-medium">
            Pet&apos;s name
            <input
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="Mochi"
              className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-4"
            />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Species
            <select
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-3"
            >
              {PET_SPECIES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Continue
          </button>
        </form>
      ) : null}

      {step === 1 ? (
        <div className="mt-8 flex flex-col gap-3">
          <h1 className="font-display text-2xl font-bold">Snap your first doc 📸</h1>
          <p className="text-ink-soft">
            A rabies certificate is perfect. You can also skip and do this later.
          </p>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Upload a document
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="min-h-[48px] rounded-2xl border border-ink/15 bg-white px-4 py-3 font-semibold"
          >
            Skip for now
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-5xl" aria-hidden="true">
            🎉
          </p>
          <h1 className="font-display text-2xl font-bold">You&apos;re set!</h1>
          <p className="text-ink-soft">
            {petName || "Your pet"} has a vault. Share the passport or add a
            reminder next.
          </p>
          <button
            type="button"
            onClick={() => router.push(ROUTES.dashboard.root)}
            className="min-h-[48px] w-full rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Go to dashboard
          </button>
        </div>
      ) : null}
    </main>
  );
}
