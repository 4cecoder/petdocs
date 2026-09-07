"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { PetArt } from "@/components/art/PetArt";
import { FlowNav, Stepper } from "@/components/flow/Wizard";
import { api, getOwnerId } from "@/lib/api";
import { passportHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

const STEPS = ["Who", "Expiry", "Copy"] as const;

const RECIPIENT_PRESETS = ["Vet", "Groomer", "Boarder", "Landlord", "Airline"];

const EXPIRY_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const EXPIRY_OPTIONS = [
  { value: "24h", label: "24 hours", hint: "Day trip" },
  { value: "7d", label: "7 days", hint: "Most popular" },
  { value: "30d", label: "30 days", hint: "Long stay" },
] as const;

/**
 * 3-step mini-wizard ["Who", "Expiry", "Copy"] that creates a share token via
 * `shareLinks.createToken` and copies the `/p/[token]` passport URL.
 */
export function ShareButton({ petId, petName }: { petId: string; petName: string }) {
  const [ownerId, setOwnerId] = useState<string | null | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [recipient, setRecipient] = useState("");
  const [expiry, setExpiry] = useState<string>("7d");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOwnerId(getOwnerId());
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  // Create the token on entering the Copy step.
  useEffect(() => {
    if (step !== 2) return;
    if (!ownerId) return;
    if (token || creating || error) return;
    let cancelled = false;
    (async () => {
      setCreating(true);
      try {
        const expiresAt = Date.now() + (EXPIRY_MS[expiry] ?? EXPIRY_MS["7d"] ?? 0);
        // TODO(post-MVP): scope select (passport | vaccines_only | full_vault), currently passport only.
        const { token: newToken } = await api.share.createToken({
          ownerId,
          petId,
          scope: "passport",
          label: recipient.trim() || petName,
          expiresAt,
        });
        if (cancelled) return;
        setToken(newToken);
        setShareUrl(`${window.location.origin}${passportHref(newToken)}`);
      } catch {
        if (!cancelled) setError("Couldn't create the share link. Try again.");
      } finally {
        if (!cancelled) setCreating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ownerId, token, error]);

  if (ownerId === null) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
        <p className="text-sm text-ink-soft">Sign in to share</p>
      </div>
    );
  }

  function handleRetry() {
    if (creating) return;
    setError(null);
    setToken(null);
    setShareUrl(null);
  }

  function handleShareAnother() {
    setToken(null);
    setShareUrl(null);
    setError(null);
    setCopied(false);
    setCreating(false);
    setStep(0);
  }

  function handleDone() {
    setRecipient("");
    setExpiry("7d");
    setToken(null);
    setShareUrl(null);
    setError(null);
    setCopied(false);
    setCreating(false);
    setStep(0);
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setError("Couldn't copy the link. Copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex justify-center">
        <PetArt name="link" size={72} />
      </div>
      <Stepper
        steps={[...STEPS]}
        current={step}
        onGo={(n) => {
          // Only allow stepping back before a link exists (avoids duplicate tokens).
          if (n < step && !creating && !token) {
            setError(null);
            setStep(n);
          }
        }}
      />

      {step === 0 ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="share-recipient" className="text-sm font-medium">
            Who&apos;s this link for?
          </label>
          <input
            id="share-recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder='e.g. "Maple Groomer"'
            autoComplete="off"
            className="min-h-[48px] w-full rounded-xl border border-ink/15 bg-cream px-3 text-sm"
          />
          <div className="flex flex-wrap gap-2" aria-label="Recipient presets">
            {RECIPIENT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRecipient(preset)}
                aria-pressed={recipient === preset}
                className={cn(
                  "min-h-[48px] rounded-full border px-4 text-sm font-semibold",
                  recipient === preset
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-ink/15 bg-white hover:bg-cream-dark",
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <FlowNav hideBack onNext={() => setStep(1)} nextLabel="Continue" />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-3">
          <p id="share-expiry-label" className="text-sm font-medium">
            How long should the link last?
          </p>
          <div
            role="radiogroup"
            aria-labelledby="share-expiry-label"
            className="grid grid-cols-3 gap-2"
          >
            {EXPIRY_OPTIONS.map((opt) => {
              const selected = expiry === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setExpiry(opt.value)}
                  className={cn(
                    "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-3 text-center",
                    selected
                      ? "border-brand-600 bg-brand-600/5 font-bold"
                      : "border-ink/15 bg-white hover:bg-cream-dark",
                  )}
                >
                  <span className="text-sm font-bold">{opt.label}</span>
                  <span className="text-xs text-ink-soft">{opt.hint}</span>
                </button>
              );
            })}
          </div>
          <FlowNav
            onBack={() => setStep(0)}
            onNext={() => {
              setError(null);
              setToken(null);
              setShareUrl(null);
              setCopied(false);
              setStep(2);
            }}
            nextLabel="Make link"
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3">
          {creating ? (
            <p aria-live="polite" className="text-center text-sm text-ink-soft">
              Making link…
            </p>
          ) : null}

          {!creating && error ? (
            <>
              <p role="alert" className="text-sm font-medium text-red-700">
                {error}
              </p>
              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(1);
                  }}
                  className="min-h-[48px] shrink-0 rounded-2xl border border-ink/15 bg-white px-5 py-3 font-semibold hover:bg-cream-dark"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="min-h-[48px] flex-1 rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
                >
                  Try again
                </button>
              </div>
            </>
          ) : null}

          {!creating && !error && token && shareUrl ? (
            <>
              <p
                role="status"
                aria-live="polite"
                className="text-center text-sm font-bold text-brand-700"
              >
                Done. Link ready{recipient.trim() ? ` for ${recipient.trim()}` : ""}.
              </p>
              <p className="truncate rounded-xl bg-cream px-3 py-2.5 text-center text-xs">
                <a
                  href={passportHref(token)}
                  className="font-medium text-brand-700 underline"
                >
                  {shareUrl}
                </a>
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
              >
                {copied ? (
                  <>
                    <Check size={18} aria-hidden="true" /> Link copied
                  </>
                ) : (
                  "Copy link"
                )}
              </button>
              <p role="status" aria-live="polite" className="text-xs text-ink-soft">
                Read-only link. No login needed. Revoke anytime.
              </p>
              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={handleShareAnother}
                  className="min-h-[48px] flex-1 rounded-2xl border border-ink/15 bg-white px-4 py-3 font-semibold hover:bg-cream-dark"
                >
                  Share another
                </button>
                <button
                  type="button"
                  onClick={handleDone}
                  className="min-h-[48px] flex-1 rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
                >
                  Done
                </button>
              </div>
            </>
          ) : null}

          {!creating && !error && !token ? (
            <p aria-live="polite" className="text-center text-sm text-ink-soft">
              Making link…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
