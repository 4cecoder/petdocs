"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ROUTES } from "@/lib/routes";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? ROUTES.dashboard.root;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO(convex): requestMagicLink({ email }) → emailed link signs in.
    // Scaffold: local demo session so the dashboard shell is navigable.
    try {
      window.localStorage.setItem("petdocs-owner", email);
    } catch {
      /* noop */
    }
    setSent(true);
    setTimeout(() => router.push(next), 800);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-5xl" aria-hidden="true">
        🐾
      </p>
      <h1 className="mt-4 font-display text-3xl font-bold">Welcome to petdocs</h1>
      <p className="mt-2 text-ink-soft">
        Sign in with a magic link — no password to remember.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-medium">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-4"
          />
        </label>
        <button
          type="submit"
          className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Send magic link
        </button>
        <p role="status" aria-live="polite" className="text-sm text-ink-soft">
          {sent ? "✓ Check your inbox (demo: continuing…)" : " "}
        </p>
      </form>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
