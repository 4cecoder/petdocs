"use client";

import { useEffect, useState } from "react";
import { api, getOwnerId } from "@/lib/api";

const EXPIRY_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/**
 * Creates a share token via `shareLinks.createToken`,
 * copies the `/p/[token]` passport URL, and shows expiry controls.
 */
export function ShareButton({ petId, petName }: { petId: string; petName: string }) {
  const [ownerId, setOwnerId] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [expiry, setExpiry] = useState("7d");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOwnerId(getOwnerId());
  }, []);

  if (ownerId === null) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
        <p className="text-sm text-ink-soft">Sign in to share</p>
      </div>
    );
  }

  async function handleShare() {
    if (!ownerId || creating) return;
    setCreating(true);
    setError(null);
    try {
      const expiresAt = Date.now() + (EXPIRY_MS[expiry] ?? EXPIRY_MS["7d"] ?? 0);
      const { token } = await api.share.createToken({
        ownerId,
        petId,
        scope: "passport",
        label: petName,
        expiresAt,
      });
      const url = `${window.location.origin}/p/${token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't create the share link — try again.");
      setCopied(false);
    } finally {
      setCreating(false);
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
        disabled={ownerId === undefined || creating}
        className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {creating
          ? "Creating link…"
          : copied
            ? "✓ Link copied!"
            : `🔗 Share ${petName}'s passport`}
      </button>
      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="text-xs text-ink-soft">
        Read-only link for vets, groomers, or boarders — no login needed. Revoke
        anytime.
      </p>
    </div>
  );
}
