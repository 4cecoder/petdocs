"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { convexMutation, convexQuery } from "@/lib/convexHttp";
import { getSessionEmail } from "@/lib/api";
import { ROUTES } from "@/lib/routes";

type Role = "owner" | "support" | "admin";

interface Me {
  _id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: number;
}

interface Stats {
  owners: number;
  pets: number;
  documents: number;
  activeLinks: number;
  remindersScheduled: number;
}

interface OwnerRow {
  _id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: number;
}

interface AdminLink {
  _id: string;
  petId: string;
  ownerId: string;
  scope: string;
  label?: string;
  isActive: boolean;
  viewCount: number;
  createdAt: number;
  expiresAt?: number;
  ownerEmail: string | null;
  petName: string | null;
}

interface AuditRow {
  _id: string;
  actorOwnerId: string;
  actorEmail: string | null;
  action: string;
  target?: string;
  createdAt: number;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminPage() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [links, setLinks] = useState<AdminLink[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [petIdInput, setPetIdInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const email = getSessionEmail();
    setAdminEmail(email);
    if (!email) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await convexQuery<Me | null>("admin:getMe", { email });
        if (cancelled) return;
        setMe(profile);
        if (
          profile &&
          (profile.role === "support" || profile.role === "admin")
        ) {
          const [s, o, l, a] = await Promise.all([
            convexQuery<Stats>("admin:stats", { adminEmail: email }),
            convexQuery<OwnerRow[]>("admin:recentOwners", {
              adminEmail: email,
              limit: 20,
            }),
            convexQuery<AdminLink[]>("admin:listLinks", {
              adminEmail: email,
              limit: 20,
            }),
            convexQuery<AuditRow[]>("admin:auditLog", {
              adminEmail: email,
              limit: 20,
            }),
          ]);
          if (cancelled) return;
          setStats(s);
          setOwners(o);
          setLinks(l);
          setAudit(a);
        }
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshAudit() {
    if (!adminEmail) return;
    try {
      const a = await convexQuery<AuditRow[]>("admin:auditLog", {
        adminEmail,
        limit: 20,
      });
      setAudit(a);
    } catch {
      /* keep prior list */
    }
  }

  async function handleRoleChange(targetOwnerId: string, role: Role) {
    if (!adminEmail || busyId) return;
    setBusyId(targetOwnerId);
    setNotice(null);
    try {
      await convexMutation<string>("admin:setRole", {
        adminEmail,
        targetOwnerId,
        role,
      });
      setOwners((prev) =>
        prev.map((o) => (o._id === targetOwnerId ? { ...o, role } : o)),
      );
      await refreshAudit();
      setNotice("Role updated. Thanks for keeping access tidy.");
    } catch {
      setNotice("Could not update that role. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(linkId: string) {
    if (!adminEmail || busyId) return;
    setBusyId(linkId);
    setNotice(null);
    try {
      await convexMutation<string>("admin:revokeAnyLink", {
        adminEmail,
        linkId,
      });
      setLinks((prev) =>
        prev.map((l) => (l._id === linkId ? { ...l, isActive: false } : l)),
      );
      await refreshAudit();
      setNotice("Link revoked. The pet vault stays safe.");
    } catch {
      setNotice("Could not revoke that link. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleLock(locked: boolean) {
    if (!adminEmail || !petIdInput.trim() || busyId) return;
    const petId = petIdInput.trim();
    setBusyId(petId);
    setNotice(null);
    try {
      await convexMutation<string>("admin:lockPet", {
        adminEmail,
        petId,
        locked,
      });
      setNotice(
        locked ? "Pet locked. It is read only for now." : "Pet unlocked.",
      );
      await refreshAudit();
    } catch {
      setNotice("Could not update that pet lock. Check the pet ID.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <p aria-live="polite" className="text-sm text-ink-soft">
          Checking access...
        </p>
      </div>
    );
  }

  if (!me || (me.role !== "support" && me.role !== "admin")) {
    return (
      <div className="flex flex-col gap-4">
        <section
          aria-label="Restricted"
          className="mx-auto flex w-full max-w-md flex-col items-center rounded-2xl border border-ink/10 bg-white p-8 text-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream">
            <Lock className="h-5 w-5 text-ink-soft" aria-hidden="true" />
          </span>
          <h1 className="mt-3 font-display text-xl font-bold">
            Internal only.
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            This area is for the PetDocs team. Your vault is safe and sound.
          </p>
          <Link
            href={ROUTES.dashboard.root}
            className="mt-4 min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Back to dashboard
          </Link>
        </section>
      </div>
    );
  }

  const isAdmin = me.role === "admin";

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-2xl border border-ink/10 bg-white p-4">
        <h1 className="font-display text-2xl font-bold">Product admin</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Hi team. Small tools, handled with care.
        </p>
        {notice ? (
          <p aria-live="polite" className="mt-2 text-sm font-medium text-brand-700">
            {notice}
          </p>
        ) : null}
      </header>

      <section
        aria-label="Totals"
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        {[
          { label: "Owners", value: stats?.owners ?? 0 },
          { label: "Pets", value: stats?.pets ?? 0 },
          { label: "Docs", value: stats?.documents ?? 0 },
          { label: "Active links", value: stats?.activeLinks ?? 0 },
          { label: "Reminders", value: stats?.remindersScheduled ?? 0 },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-ink/10 bg-white p-3 text-center"
          >
            <p className="font-display text-xl font-bold">{s.value}</p>
            <p className="text-xs text-ink-soft">{s.label}</p>
          </div>
        ))}
      </section>

      <section
        aria-label="Owners"
        className="rounded-2xl border border-ink/10 bg-white p-4"
      >
        <h2 className="font-display font-bold">Recent owners</h2>
        {owners.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">No owners yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {owners.map((o) => (
              <li
                key={o._id}
                className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.email}</p>
                  <p className="text-xs text-ink-soft">
                    Joined {formatDate(o.createdAt)}
                  </p>
                </div>
                {isAdmin ? (
                  <select
                    aria-label={`Role for ${o.email}`}
                    value={o.role}
                    disabled={busyId === o._id}
                    onChange={(e) =>
                      handleRoleChange(o._id, e.target.value as Role)
                    }
                    className="min-h-[48px] shrink-0 rounded-xl border border-ink/15 bg-white px-3 text-sm font-semibold"
                  >
                    <option value="owner">owner</option>
                    <option value="support">support</option>
                    <option value="admin">admin</option>
                  </select>
                ) : (
                  <span className="shrink-0 rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold">
                    {o.role}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Share link safety"
        className="rounded-2xl border border-ink/10 bg-white p-4"
      >
        <h2 className="font-display font-bold">Share link safety</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Active links first. Revoke any link that looks wrong.
        </p>
        {links.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No links to review.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {links.map((l) => (
              <li
                key={l._id}
                className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {l.petName ?? "Pet"} · {l.scope}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {l.ownerEmail ?? "Unknown owner"} · {l.viewCount}{" "}
                    {l.viewCount === 1 ? "view" : "views"} ·{" "}
                    {l.isActive ? "Active" : "Revoked"}
                  </p>
                </div>
                {l.isActive ? (
                  <button
                    type="button"
                    onClick={() => handleRevoke(l._id)}
                    disabled={busyId === l._id}
                    className="min-h-[48px] shrink-0 rounded-xl border border-ink/15 bg-white px-4 text-sm font-semibold hover:bg-cream-dark disabled:opacity-60"
                  >
                    {busyId === l._id ? "Revoking..." : "Revoke"}
                  </button>
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-ink-soft">
                    Done
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin ? (
        <section
          aria-label="Pet lock"
          className="rounded-2xl border border-ink/10 bg-white p-4"
        >
          <h2 className="font-display font-bold">Pet lock</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Paste a pet ID to lock or unlock it for safety.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={petIdInput}
              onChange={(e) => setPetIdInput(e.target.value)}
              placeholder="Pet ID"
              aria-label="Pet ID"
              className="min-h-[48px] flex-1 rounded-xl border border-ink/15 bg-white px-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleLock(true)}
                disabled={!petIdInput.trim() || !!busyId}
                className="min-h-[48px] rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Lock
              </button>
              <button
                type="button"
                onClick={() => handleLock(false)}
                disabled={!petIdInput.trim() || !!busyId}
                className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-4 text-sm font-semibold hover:bg-cream-dark disabled:opacity-60"
              >
                Unlock
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section
        aria-label="Audit log"
        className="rounded-2xl border border-ink/10 bg-white p-4"
      >
        <h2 className="font-display font-bold">Audit log</h2>
        {audit.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">
            No admin actions yet. Quiet is good.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {audit.map((a) => (
              <li
                key={a._id}
                className="rounded-xl bg-cream px-3 py-2.5"
              >
                <p className="font-semibold">{a.action}</p>
                <p className="text-xs text-ink-soft">
                  {a.actorEmail ?? "Unknown"} · {a.target ?? "no target"} ·{" "}
                  {formatDate(a.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
