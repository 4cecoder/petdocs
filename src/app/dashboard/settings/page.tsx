"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearSession, getOwnerId } from "@/lib/api";
import { convexMutation, convexQuery } from "@/lib/convexHttp";
import { ROUTES } from "@/lib/routes";

export default function SettingsPage() {
  const router = useRouter();
  const ownerId = getOwnerId();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    if (!ownerId || exporting) return;
    setExporting(true);
    setExportError(null);
    setExportDone(false);
    try {
      const data = await convexQuery<unknown>("privacy:exportData", {
        ownerId,
      });
      const date = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `petdocs-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Export failed. Try again.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!ownerId || deleting) return;
    const typed = confirmEmail.trim();
    if (!typed) {
      setDeleteError("Type your email to confirm deletion.");
      return;
    }
    if (
      !window.confirm(
        "Delete your account and all pet data? This cannot be undone.",
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        "Final check: delete everything including pets, documents, and share links?",
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await convexMutation("privacy:deleteAccount", {
        ownerId,
        confirmEmail: typed,
      });
      clearSession();
      router.replace(ROUTES.home);
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Delete failed. Try again.",
      );
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <section className="rounded-2xl border border-ink/10 bg-white p-4" aria-label="Account">
        <h2 className="font-display font-bold">Account</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Email, notifications, and plan live here once Convex auth lands.
        </p>
      </section>
      <section className="rounded-2xl border border-ink/10 bg-white p-4" aria-label="Danger zone">
        <h2 className="font-display font-bold">Trash</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Deleted documents can be restored or permanently emptied here.
        </p>
      </section>
      <section className="rounded-2xl border border-ink/10 bg-white p-4" aria-label="Internal">
        <h2 className="font-display font-bold">Internal</h2>
        <p className="mt-1 text-sm text-ink-soft">
          <Link
            href="/dashboard/admin"
            className="font-medium text-brand-700 underline"
          >
            Product admin
          </Link>{" "}
          for the PetDocs team.
        </p>
      </section>
      <section
        className="rounded-2xl border border-ink/10 bg-white p-4"
        aria-label="Your data"
      >
        <h2 className="font-display font-bold">Your data</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Download everything or delete your account. Both act on all pets,
          documents, and share links.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={!ownerId || exporting}
            className="min-h-[48px] rounded-2xl border border-ink/15 bg-cream px-4 py-2.5 text-sm font-semibold hover:bg-white disabled:opacity-60"
          >
            {exporting ? "Preparing export…" : "Export my data (JSON)"}
          </button>
          {!ownerId ? (
            <p className="text-sm text-ink-soft">
              Sign in to export or delete your data.
            </p>
          ) : null}
          {exportDone ? (
            <p role="status" className="text-sm text-ink-soft">
              Export downloaded as petdocs-export-DATE.json.
            </p>
          ) : null}
          {exportError ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {exportError}
            </p>
          ) : null}
        </div>
        <div className="mt-4 border-t border-ink/10 pt-4">
          <h3 className="text-sm font-bold text-red-700">Delete account</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Permanently deletes pets, documents, reminders, and share links.
            Type your email to enable the button.
          </p>
          <label className="mt-2 flex flex-col gap-1 text-sm font-medium">
            Confirm email
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!ownerId || !confirmEmail.trim() || deleting}
            className="mt-2 min-h-[48px] rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete my account and all data"}
          </button>
          {deleteError ? (
            <p role="alert" className="mt-2 text-sm font-medium text-red-600">
              {deleteError}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
