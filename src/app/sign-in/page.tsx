"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, PawPrint } from "lucide-react";
import { ConvexHttpError, api, setSession } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

type VerifyStatus = "idle" | "verifying" | "success" | "error";

/** Backend distinguishes invalid/expired/used links: expired maps to the
 *  friendly spec copy, everything else surfaces the backend message plus a
 *  "request a new one" hint. */
function toVerifyError(message: string): string {
  if (/expir/i.test(message)) return "Link expired. Request a new one.";
  return `${message} Request a new one below.`;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Only allow internal redirects: never bounce to an external URL.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : ROUTES.dashboard.root;

  const token = searchParams.get("token");
  const linkEmail = searchParams.get("email");

  // Pre-fill with the email from the magic-link URL so requesting a
  // replacement link after a failure needs just one tap.
  const [email, setEmail] = useState(() => linkEmail ?? "");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [backendDown, setBackendDown] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>(
    token ? "verifying" : "idle",
  );
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // Guard against React StrictMode double-invoking the effect in dev:
  // verify tokens are single-use, so each link must be verified exactly once.
  const verifiedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const key = `${linkEmail}::${token}`;
    if (verifiedKey.current === key) return;
    verifiedKey.current = key;

    if (!linkEmail) {
      setVerifyStatus("error");
      setVerifyError("That sign-in link is incomplete. Request a new one below.");
      return;
    }

    let cancelled = false;
    (async () => {
      setVerifyStatus("verifying");
      try {
        const result = await api.auth.verifyMagicLink(linkEmail, token);
        if (cancelled) return;
        if (result.ok) {
          setSession(linkEmail, result.ownerId);
          setVerifyStatus("success");
          router.push(next);
        } else {
          setVerifyStatus("error");
          setVerifyError(toVerifyError(result.error));
        }
      } catch (err) {
        if (cancelled) return;
        setVerifyStatus("error");
        if (err instanceof ConvexHttpError) {
          setBackendDown(true);
          setVerifyError(
            "Backend not connected. Try again once configured.",
          );
        } else {
          setVerifyError("Something went wrong. Request a new one below.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, linkEmail, next, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBackendDown(false);
    setSubmitting(true);
    try {
      // Always resolves { ok: true } (anti-enumeration on the backend), so a
      // "check your inbox" confirmation is correct for every valid submit.
      await api.auth.requestMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      if (err instanceof ConvexHttpError) {
        // Honest message only: no demo bypass, no fake session.
        setBackendDown(true);
      } else {
        setFormError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const verifying = verifyStatus === "verifying";
  const busy = submitting || verifying;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <PawPrint size={40} aria-hidden="true" className="text-brand-600" />
      <h1 className="mt-4 font-display text-3xl font-bold">Welcome to petdocs</h1>
      <p className="mt-2 text-ink-soft">
        Sign in with a magic link. No password needed.
      </p>

      {token && (
        <div aria-live="polite" className="mt-4">
          {verifyStatus === "verifying" && (
            <p role="status" className="text-sm text-ink-soft">
              Signing you in…
            </p>
          )}
          {verifyStatus === "success" && (
            <p
              role="status"
              className="flex items-center gap-1.5 text-sm text-ink-soft"
            >
              <Check size={16} aria-hidden="true" /> Signed in. Taking you
              to your dashboard…
            </p>
          )}
          {verifyStatus === "error" && verifyError && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {verifyError}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-medium">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={busy}
            className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-4 disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? "Sending…" : sent ? "Resend magic link" : "Send magic link"}
        </button>
        {backendDown && (
          <p role="alert" className="text-sm font-medium text-amber-700">
            Backend not connected. Try again later.
          </p>
        )}
        {formError && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {formError}
          </p>
        )}
        <p role="status" aria-live="polite" className="text-sm text-ink-soft">
          {sent && !backendDown ? (
            <span className="inline-flex items-center gap-1.5">
              <Check size={16} aria-hidden="true" /> Check your inbox. Click
              the link to sign in.
            </span>
          ) : (
            " "
          )}
        </p>
      </form>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
          <p aria-live="polite" className="text-ink-soft">
            Loading sign-in…
          </p>
        </main>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
