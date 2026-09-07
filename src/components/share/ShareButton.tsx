"use client";

import { useState } from "react";

/**
 * Creates a share token (Convex `shareLinks.createToken` once codegen exists),
 * copies the `/p/[token]` passport URL, and shows expiry controls.
 */
export function ShareButton({ petId, petName }: { petId: string; petName: string }) {
  const [copied, setCopied] = useState(false);
  const [expiry, setExpiry] = useState("7d");

  void petId;

  async function handleShare() {
    // TODO(convex): const { token } = await createToken({ petId, scope: "passport", expiresAt });
    // const url = `${window.location.origin}/p/${token}`;
    const url = `${window.location.origin}/p/demo-token-for-${petName.toLowerCase()}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
      <label className="flex items-center justify-between gap-2 text-sm font-medium">
        Link expires
        <select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3"
        >
          <option value="24h">24 hours</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
        </select>
      </label>
      <button
        type="button"
        onClick={handleShare}
        className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700"
      >
        {copied ? "✓ Link copied!" : `🔗 Share ${petName}'s passport`}
      </button>
      <p role="status" aria-live="polite" className="text-xs text-ink-soft">
        Read-only link for vets, groomers, or boarders — no login needed. Revoke
        anytime.
      </p>
    </div>
  );
}
