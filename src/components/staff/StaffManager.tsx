"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { convexMutation, convexQuery } from "@/lib/convexHttp";

type StaffRole = "owner" | "manager" | "support" | "auditor" | "superadmin";

interface StaffRow {
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
  createdAt: number;
}

interface StaffManagerProps {
  adminEmail: string;
  isOwner: boolean;
  isSuperadmin?: boolean;
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

export default function StaffManager({
  adminEmail,
  isOwner,
  isSuperadmin = false,
}: StaffManagerProps) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("support");
  const [inviting, setInviting] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await convexQuery<StaffRow[]>("staff:listStaff", {
        adminEmail,
      });
      setStaff(rows);
    } catch {
      setNotice("Could not load the team. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await convexQuery<StaffRow[]>("staff:listStaff", {
          adminEmail,
        });
        if (!cancelled) setStaff(rows);
      } catch {
        if (!cancelled) setNotice("Could not load the team. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminEmail]);

  async function handleInvite() {
    const email = inviteEmail.trim();
    const name = inviteName.trim();
    if (!email || !name || inviting) {
      setNotice("Enter an email and name to invite.");
      return;
    }
    setInviting(true);
    setNotice(null);
    try {
      await convexMutation<string>("staff:inviteStaff", {
        adminEmail,
        email,
        name,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteName("");
      setInviteRole("support");
      await load();
      setNotice("Invite sent. Welcome aboard.");
    } catch {
      setNotice("Could not send that invite. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(targetEmail: string, role: StaffRole) {
    if (busyEmail) return;
    setBusyEmail(targetEmail);
    setNotice(null);
    try {
      await convexMutation<string>("staff:setStaffRole", {
        adminEmail,
        targetEmail,
        role,
      });
      await load();
      setNotice("Role updated. Thanks for keeping access tidy.");
    } catch {
      setNotice("Could not update that role. Please try again.");
    } finally {
      setBusyEmail(null);
    }
  }

  async function handleToggleActive(member: StaffRow) {
    if (busyEmail) return;
    setBusyEmail(member.email);
    setNotice(null);
    try {
      if (member.active) {
        await convexMutation<string>("staff:deactivateStaff", {
          adminEmail,
          targetEmail: member.email,
        });
      } else {
        // inviteStaff upserts: reactivates the row with its kept name/role.
        await convexMutation<string>("staff:inviteStaff", {
          adminEmail,
          email: member.email,
          name: member.name,
          role: member.role,
        });
      }
      await load();
      setNotice("Access updated. Least privilege, always.");
    } catch {
      setNotice("Could not update access. Please try again.");
    } finally {
      setBusyEmail(null);
    }
  }

  if (loading) {
    return (
      <p aria-live="polite" className="text-sm text-ink-soft">
        Loading team...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {notice ? (
        <p aria-live="polite" className="text-sm font-medium text-brand-700">
          {notice}
        </p>
      ) : null}

      {isOwner ? (
        <div className="flex flex-col gap-2 rounded-xl bg-cream px-3 py-2.5">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email"
              aria-label="Employee email"
              className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-3 text-sm"
            />
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Name"
              aria-label="Employee name"
              className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-3 text-sm"
            />
            <select
              aria-label="Role for new employee"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as StaffRole)}
              className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-3 text-sm font-semibold"
            >
              <option value="owner">owner</option>
              <option value="manager">manager</option>
              <option value="support">support</option>
              <option value="auditor">auditor</option>
              {isSuperadmin ? (
                <option value="superadmin">superadmin</option>
              ) : null}
            </select>
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviting}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {inviting ? "Inviting..." : "Invite"}
            </button>
          </div>
        </div>
      ) : null}

      {staff.length === 0 ? (
        <p className="text-sm text-ink-soft">No team members yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {staff.map((s) => (
            <li
              key={s.email}
              className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.email}</p>
                <p className="truncate text-xs text-ink-soft">
                  {s.name} · Joined {formatDate(s.createdAt)} ·{" "}
                  {s.active ? "Active" : "Inactive"}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {s.role}
                </p>
              </div>
              {isOwner ? (
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    aria-label={`Role for ${s.email}`}
                    value={s.role}
                    disabled={busyEmail === s.email}
                    onChange={(e) =>
                      handleRoleChange(s.email, e.target.value as StaffRole)
                    }
                    className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-3 text-sm font-semibold"
                  >
                    <option value="owner">owner</option>
                    <option value="manager">manager</option>
                    <option value="support">support</option>
                    <option value="auditor">auditor</option>
                    {isSuperadmin ? (
                      <option value="superadmin">superadmin</option>
                    ) : null}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(s)}
                    disabled={busyEmail === s.email}
                    className="min-h-[48px] rounded-xl border border-ink/15 bg-white px-4 text-sm font-semibold hover:bg-cream-dark disabled:opacity-60"
                  >
                    {busyEmail === s.email
                      ? "Saving..."
                      : s.active
                        ? "Deactivate"
                        : "Reactivate"}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
