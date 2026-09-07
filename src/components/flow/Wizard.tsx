"use client";

import { useCallback, useState } from "react";
import { PetArt, type PetArtName } from "@/components/art/PetArt";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// useSteps — tiny multistep state machine (the DX-maximized primitive)
// ---------------------------------------------------------------------------
export function useSteps(total: number, initial = 0) {
  const [step, setStep] = useState(initial);
  const next = useCallback(() => setStep((s) => Math.min(s + 1, total - 1)), [total]);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);
  const go = useCallback(
    (n: number) => setStep(Math.max(0, Math.min(n, total - 1))),
    [total],
  );
  return { step, next, back, go, isFirst: step === 0, isLast: step === total - 1, total };
}

// ---------------------------------------------------------------------------
// Stepper — dots + labels, never progress-bar-only (screen-reader text)
// ---------------------------------------------------------------------------
export function Stepper({
  steps,
  current,
  onGo,
}: {
  steps: string[];
  current: number;
  onGo?: (n: number) => void;
}) {
  return (
    <ol aria-label="Progress" className="flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const inner = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                done && "bg-brand-600 text-white",
                active && "bg-brand-600 text-white ring-4 ring-brand-600/20",
                !done && !active && "bg-ink/10 text-ink-soft",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-xs font-semibold sm:inline",
                active ? "text-ink" : "text-ink-soft",
              )}
            >
              {label}
            </span>
          </>
        );
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 ? (
              <span aria-hidden="true" className={cn("h-0.5 w-4 rounded sm:w-8", i <= current ? "bg-brand-600" : "bg-ink/10")} />
            ) : null}
            {onGo && (done || active) ? (
              <button
                type="button"
                onClick={() => onGo(i)}
                aria-label={`Go to step ${i + 1}: ${label}`}
                aria-current={active ? "step" : undefined}
                className="flex min-h-[48px] items-center gap-2 rounded-xl px-1"
              >
                {inner}
              </button>
            ) : (
              <span aria-current={active ? "step" : undefined} className="flex items-center gap-2">
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// StepShell — centered art + title + body card (the cozy container)
// ---------------------------------------------------------------------------
export function StepShell({
  art,
  artSize = 120,
  title,
  subtitle,
  children,
  footer,
}: {
  art?: PetArtName;
  artSize?: number;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      {art ? <PetArt name={art} size={artSize} /> : null}
      <h1 className="mt-4 text-center font-display text-2xl font-bold">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-center text-sm text-ink-soft">{subtitle}</p>
      ) : null}
      {children ? <div className="mt-5 w-full">{children}</div> : null}
      {footer ? <div className="mt-4 w-full">{footer}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlowNav — Back / Continue bar (48px targets, loading-aware)
// ---------------------------------------------------------------------------
export function FlowNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  backLabel = "Back",
  nextDisabled = false,
  loading = false,
  hideBack = false,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  hideBack?: boolean;
}) {
  return (
    <div className="flex w-full gap-2">
      {!hideBack ? (
        <button
          type="button"
          onClick={onBack}
          className="min-h-[48px] shrink-0 rounded-2xl border border-ink/15 bg-white px-5 py-3 font-semibold hover:bg-cream-dark"
        >
          {backLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || loading}
        className="min-h-[48px] flex-1 rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Working… 🐾" : nextLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WizardShell — stepper + shell in one (fastest path to a new flow)
// ---------------------------------------------------------------------------
export function WizardShell({
  steps,
  current,
  onGo,
  art,
  title,
  subtitle,
  children,
  nav,
}: {
  steps: string[];
  current: number;
  onGo?: (n: number) => void;
  art?: PetArtName;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  nav?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Stepper steps={steps} current={current} onGo={onGo} />
      <StepShell art={art} title={title} subtitle={subtitle}>
        {children}
      </StepShell>
      {nav}
    </div>
  );
}
