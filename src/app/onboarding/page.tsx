"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { PET_SPECIES, validatePetName } from "@/lib/validators";
import { ROUTES } from "@/lib/routes";
import { FlowNav, WizardShell, useSteps } from "@/components/flow/Wizard";

const STEPS = ["Your pet", "First doc", "All set"] as const;

/** 3-step onboarding, resumable, skippable, goal <3 minutes. */
export default function OnboardingPage() {
  const router = useRouter();
  const { step, next, back, go } = useSteps(STEPS.length);
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<string>("dog");
  const [touched, setTouched] = useState(false);

  // Live validation: gates Continue's disabled state; error shows after blur/attempt.
  const nameProblem = validatePetName(petName);
  const showNameError = touched && nameProblem !== null;
  const displayName = petName.trim() || "Your pet";

  // Stepper is clickable back only to already-visited steps.
  function handleGo(n: number) {
    if (n < step) go(n);
  }

  function handlePetContinue(e?: React.FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (validatePetName(petName)) return;
    // TODO(convex): pets.create({ name: petName.trim(), species }) → petId.
    next();
  }

  function handleUpload() {
    // TODO(convex): real doc picker → documents.generateUploadUrl → POST → documents.create.
    next();
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p aria-live="polite" className="sr-only">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {step === 0 ? (
        <WizardShell
          steps={[...STEPS]}
          current={step}
          onGo={handleGo}
          art="happy"
          title="Add your first pet"
          subtitle="Takes less than 3 minutes."
          nav={
            <FlowNav
              hideBack
              onNext={() => handlePetContinue()}
              nextLabel="Continue"
              nextDisabled={nameProblem !== null}
            />
          }
        >
          <form onSubmit={handlePetContinue} className="flex flex-col gap-3">
            <label
              htmlFor="onboarding-pet-name"
              className="flex flex-col gap-1 font-medium"
            >
              Pet&apos;s name
              <input
                id="onboarding-pet-name"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="Mochi"
                aria-invalid={showNameError}
                aria-describedby={
                  showNameError
                    ? "onboarding-pet-name-error"
                    : "onboarding-photo-note"
                }
                className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-4"
              />
            </label>
            <label
              htmlFor="onboarding-species"
              className="flex flex-col gap-1 font-medium"
            >
              Species
              <select
                id="onboarding-species"
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
            {showNameError ? (
              <p
                id="onboarding-pet-name-error"
                role="alert"
                className="text-sm font-medium text-red-600"
              >
                {nameProblem}
              </p>
            ) : null}
            <p id="onboarding-photo-note" className="text-sm text-ink-soft">
              Photo comes later. Name and species is enough for now.
            </p>
          </form>
        </WizardShell>
      ) : null}

      {step === 1 ? (
        <WizardShell
          steps={[...STEPS]}
          current={step}
          onGo={handleGo}
          art="camera"
          title="Snap your first doc"
          subtitle="A rabies certificate is perfect."
          nav={
            <button
              type="button"
              onClick={back}
              className="inline-flex min-h-[48px] items-center gap-1 rounded-2xl px-4 py-3 font-semibold text-ink-soft hover:bg-cream-dark"
            >
              <ArrowLeft size={18} aria-hidden="true" /> Back
            </button>
          }
        >
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleUpload}
              className="flex min-h-[64px] items-center gap-3 rounded-2xl bg-brand-600 px-4 py-3 text-left font-semibold text-white hover:bg-brand-700"
            >
              <FileText size={24} aria-hidden="true" className="shrink-0" />
              <span className="flex flex-col">
                <span>Upload a document</span>
                <span className="text-sm font-normal text-white/80">
                  Photo or PDF, under 10MB
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={next}
              className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-ink/15 bg-white px-4 py-3 text-left font-semibold hover:bg-cream-dark"
            >
              <ArrowRight size={24} aria-hidden="true" className="shrink-0" />
              <span className="flex flex-col">
                <span>Skip for now</span>
                <span className="text-sm font-normal text-ink-soft">
                  Do this later
                </span>
              </span>
            </button>
            <p className="text-center text-sm text-ink-soft">
              Skippable. Pick up where you left off.
            </p>
          </div>
        </WizardShell>
      ) : null}

      {step === 2 ? (
        <WizardShell
          steps={[...STEPS]}
          current={step}
          onGo={handleGo}
          art="rocket"
          title="You're set!"
          subtitle={`${displayName} has a vault. Share the passport or add a reminder next.`}
          nav={
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(ROUTES.dashboard.root)}
                className="min-h-[48px] w-full rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
              >
                Go to dashboard
              </button>
              <p className="text-sm text-ink-soft">
                Add a reminder later from the dashboard.
              </p>
            </div>
          }
        />
      ) : null}
    </main>
  );
}
