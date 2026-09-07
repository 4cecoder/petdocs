"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Lock, Mail, Send } from "lucide-react";
import { convexMutation, convexQuery } from "@/lib/convexHttp";
import { getSessionEmail } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { PetArt } from "@/components/art/PetArt";

type Role = "owner" | "support" | "admin";
type StaffRoleName = "owner" | "manager" | "support" | "auditor";

interface StaffRoleInfo {
  role: StaffRoleName;
  active: boolean;
}

interface Me {
  _id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: number;
}

interface MailAccount {
  id: string;
  emailAddress: string;
  label: string;
}

interface MailThread {
  _id: string;
  subject: string;
  participants: string[];
  lastAt: number;
  unread: boolean;
}

interface MailMessage {
  _id: string;
  from: string;
  subject: string;
  text: string;
  labels: string[];
  sentAt?: number;
  receivedAt?: number;
}

interface MailThreadDetail {
  thread: MailThread;
  messages: MailMessage[];
}

const ACCOUNTS_KEY = "petdocs-mail-accounts";
const SELECTED_KEY = "petdocs-mail-selected";

function formatDate(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function messageTime(m: MailMessage): number {
  return m.sentAt ?? m.receivedAt ?? 0;
}

function loadStoredAccounts(): MailAccount[] {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MailAccount[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a) =>
        typeof a?.id === "string" &&
        typeof a?.emailAddress === "string" &&
        typeof a?.label === "string",
    );
  } catch {
    return [];
  }
}

export default function AdminMailPage() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [staffRole, setStaffRole] = useState<StaffRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [emailInput, setEmailInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [creating, setCreating] = useState(false);

  const [labelFilter, setLabelFilter] = useState("");
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const email = getSessionEmail();
    setAdminEmail(email);
    setAccounts(loadStoredAccounts());
    try {
      const selected = window.localStorage.getItem(SELECTED_KEY);
      if (selected) setSelectedAccountId(selected);
    } catch {
      /* keep no selection */
    }
    if (!email) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [profile, staff] = await Promise.all([
          convexQuery<Me | null>("admin:getMe", { email }),
          convexQuery<StaffRoleInfo | null>("staff:myStaffRole", {
            email,
          }).catch(() => null),
        ]);
        if (cancelled) return;
        setMe(profile);
        setStaffRole(staff && staff.active ? staff : null);
      } catch {
        if (!cancelled) {
          setMe(null);
          setStaffRole(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      /* keep in memory only */
    }
  }, [accounts]);

  useEffect(() => {
    try {
      if (selectedAccountId) {
        window.localStorage.setItem(SELECTED_KEY, selectedAccountId);
      } else {
        window.localStorage.removeItem(SELECTED_KEY);
      }
    } catch {
      /* keep in memory only */
    }
  }, [selectedAccountId]);

  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? null;

  const loadThreads = useCallback(
    async (accountId: string, label?: string) => {
      if (!adminEmail) return;
      setThreadsLoading(true);
      try {
        const rows = await convexQuery<MailThread[]>("mail:listThreads", {
          adminEmail,
          accountId,
          ...(label && label.trim() ? { label: label.trim() } : {}),
        });
        setThreads(rows);
      } catch {
        setStatus("Could not load threads. Please try again.");
      } finally {
        setThreadsLoading(false);
      }
    },
    [adminEmail],
  );

  const loadThreadDetail = useCallback(
    async (threadId: string) => {
      if (!adminEmail) return;
      setThreadLoading(true);
      try {
        const res = await convexQuery<MailThreadDetail>("mail:getThread", {
          adminEmail,
          threadId,
        });
        const sorted = [...(res.messages ?? [])].sort(
          (a, b) => messageTime(a) - messageTime(b),
        );
        setDetail({ thread: res.thread, messages: sorted });
      } catch {
        setStatus("Could not open that thread. Please try again.");
      } finally {
        setThreadLoading(false);
      }
    },
    [adminEmail],
  );

  useEffect(() => {
    if (!adminEmail || !selectedAccountId) {
      setThreads([]);
      return;
    }
    setSelectedThreadId(null);
    setDetail(null);
    setReplyText("");
    void loadThreads(selectedAccountId, labelFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminEmail, selectedAccountId, loadThreads]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <p aria-live="polite" className="text-sm text-ink-soft">
          Checking access...
        </p>
      </div>
    );
  }

  const canViewAdmin =
    (!!me && (me.role === "support" || me.role === "admin")) || !!staffRole;

  if (!canViewAdmin) {
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

  async function handleCreateAccount() {
    if (!adminEmail || creating) return;
    const emailAddress = emailInput.trim();
    const label = labelInput.trim() || emailAddress;
    if (!emailAddress) {
      setStatus("Enter a mailbox address to continue.");
      return;
    }
    setCreating(true);
    setStatus(null);
    try {
      const id = await convexMutation<string>("mail:createAccount", {
        adminEmail,
        emailAddress,
        label,
      });
      const account: MailAccount = { id, emailAddress, label };
      setAccounts((prev) =>
        prev.some((a) => a.id === id) ? prev : [...prev, account],
      );
      setSelectedAccountId(id);
      setEmailInput("");
      setLabelInput("");
      setStatus("Mailbox added. Loading threads.");
      await loadThreads(id, labelFilter);
    } catch {
      setStatus("Could not add that mailbox. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenThread(threadId: string) {
    setSelectedThreadId(threadId);
    setReplyText("");
    setStatus(null);
    await loadThreadDetail(threadId);
  }

  async function handleSendReply() {
    if (!adminEmail || !selectedThreadId || !detail || sending) return;
    const text = replyText.trim();
    if (!text) {
      setStatus("Write a reply before sending.");
      return;
    }
    const selfEmail = selectedAccount?.emailAddress.toLowerCase() ?? "";
    const to = detail.thread.participants.filter(
      (p) => p.toLowerCase() !== selfEmail,
    );
    if (to.length === 0) {
      setStatus("No recipient found for this thread.");
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await convexMutation<string>("mail:sendReply", {
        adminEmail,
        threadId: selectedThreadId,
        to,
        text,
      });
      setReplyText("");
      setStatus("Reply sent. Thanks for the quick care.");
      await loadThreadDetail(selectedThreadId);
      if (selectedAccountId) await loadThreads(selectedAccountId, labelFilter);
    } catch {
      setStatus("Could not send that reply. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-2xl border border-ink/10 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream">
            <Inbox className="h-5 w-5 text-ink" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">Team inbox</h1>
            <p className="mt-0.5 text-sm text-ink-soft">
              Hi team. Customer mail lives here. Pick a mailbox to start.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/admin"
            className="inline-flex min-h-[48px] items-center rounded-xl border border-ink/15 bg-white px-4 text-sm font-semibold hover:bg-cream-dark"
          >
            Back to product admin
          </Link>
        </div>
        <p aria-live="polite" className="mt-2 min-h-[20px] text-sm font-medium text-brand-700">
          {status ?? ""}
        </p>
      </header>

      <section
        aria-label="Mailbox account"
        className="rounded-2xl border border-ink/10 bg-white p-4"
      >
        <h2 className="flex items-center gap-2 font-display font-bold">
          <Mail className="h-4 w-4 text-ink-soft" aria-hidden="true" />
          Mailbox
        </h2>
        {accounts.length > 0 && (
          <div className="mt-2">
            <label
              htmlFor="mail-account"
              className="text-sm font-semibold text-ink"
            >
              Active mailbox
            </label>
            <select
              id="mail-account"
              value={selectedAccountId ?? ""}
              onChange={(e) => setSelectedAccountId(e.target.value || null)}
              className="mt-1 min-h-[48px] w-full rounded-xl border border-ink/15 bg-white px-3 text-sm font-semibold"
            >
              <option value="">Choose a mailbox</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.emailAddress})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mt-3 rounded-xl bg-cream p-3">
          <p className="text-sm font-semibold">Add a mailbox</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Use a team address. Try support@ or hello@ with your domain.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="support@yourdomain.com"
              aria-label="Mailbox email address"
              autoComplete="email"
              className="min-h-[48px] flex-1 rounded-xl border border-ink/15 bg-white px-3 text-sm"
            />
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Support"
              aria-label="Mailbox label"
              className="min-h-[48px] flex-1 rounded-xl border border-ink/15 bg-white px-3 text-sm sm:max-w-[180px]"
            />
            <button
              type="button"
              onClick={handleCreateAccount}
              disabled={creating || !emailInput.trim()}
              className="min-h-[48px] rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {creating ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </section>

      {!selectedAccount ? (
        <section
          aria-label="No mailbox selected"
          className="mx-auto flex w-full max-w-md flex-col items-center rounded-2xl border border-ink/10 bg-white p-8 text-center"
        >
          <PetArt name="mail" size={120} />
          <h2 className="mt-3 font-display text-lg font-bold">
            Pick a mailbox to read mail
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Add a team mailbox above, then threads will show up here.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <section
            aria-label="Threads"
            className="rounded-2xl border border-ink/10 bg-white p-4 lg:col-span-2"
          >
            <h2 className="font-display font-bold">Threads</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {selectedAccount.label} ({selectedAccount.emailAddress})
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
                placeholder="Filter by label (optional)"
                aria-label="Filter threads by label"
                className="min-h-[48px] flex-1 rounded-xl border border-ink/15 bg-white px-3 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  selectedAccountId &&
                  void loadThreads(selectedAccountId, labelFilter)
                }
                disabled={threadsLoading}
                className="min-h-[48px] shrink-0 rounded-xl border border-ink/15 bg-white px-4 text-sm font-semibold hover:bg-cream-dark disabled:opacity-60"
              >
                {threadsLoading ? "Loading..." : "Apply"}
              </button>
            </div>
            {threadsLoading ? (
              <p aria-live="polite" className="mt-3 text-sm text-ink-soft">
                Loading threads...
              </p>
            ) : threads.length === 0 ? (
              <div className="mt-3 flex flex-col items-center rounded-xl bg-cream px-3 py-6 text-center">
                <PetArt name="sleepy" size={96} />
                <p className="mt-2 text-sm font-semibold">Inbox zero.</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Nice and quiet. New customer threads will land here.
                </p>
              </div>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {threads.map((t) => {
                  const active = t._id === selectedThreadId;
                  return (
                    <li key={t._id}>
                      <button
                        type="button"
                        onClick={() => void handleOpenThread(t._id)}
                        aria-current={active ? "true" : undefined}
                        className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
                          active
                            ? "border border-brand-600 bg-white"
                            : "bg-cream hover:bg-cream-dark"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            t.unread ? "bg-brand-600" : "bg-ink/15"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate ${
                              t.unread ? "font-bold" : "font-semibold"
                            }`}
                          >
                            {t.subject || "(No subject)"}
                          </span>
                          <span className="block truncate text-xs text-ink-soft">
                            {t.participants.join(", ") || "No participants"}
                            {" · "}
                            {formatDate(t.lastAt)}
                          </span>
                        </span>
                        {t.unread && (
                          <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">
                            New
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            aria-label="Thread reader"
            className="rounded-2xl border border-ink/10 bg-white p-4 lg:col-span-3"
          >
            <h2 className="font-display font-bold">Reader</h2>
            {!selectedThreadId ? (
              <div className="mt-2 flex flex-col items-center rounded-xl bg-cream px-3 py-6 text-center">
                <PetArt name="mail" size={96} />
                <p className="mt-2 text-sm font-semibold">
                  Select a thread to read it
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Tap any thread on the left to see the full conversation.
                </p>
              </div>
            ) : threadLoading || !detail ? (
              <p aria-live="polite" className="mt-2 text-sm text-ink-soft">
                Opening thread...
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-3">
                <div className="rounded-xl bg-cream px-3 py-2.5">
                  <p className="text-sm font-bold">
                    {detail.thread.subject || "(No subject)"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">
                    {detail.thread.participants.join(", ")}
                  </p>
                </div>
                {detail.messages.length === 0 ? (
                  <div className="flex flex-col items-center rounded-xl bg-cream px-3 py-6 text-center">
                    <PetArt name="sleepy" size={96} />
                    <p className="mt-2 text-sm font-semibold">
                      No messages yet.
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      This thread is empty. Send the first reply below.
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2" aria-label="Messages">
                    {detail.messages.map((m) => {
                      const isOwn =
                        m.from.toLowerCase() ===
                        (selectedAccount?.emailAddress.toLowerCase() ?? "");
                      return (
                        <li
                          key={m._id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm ${
                              isOwn
                                ? "bg-brand-600 text-white"
                                : "bg-cream text-ink"
                            }`}
                          >
                            <p
                              className={`text-xs font-semibold ${isOwn ? "text-white/90" : "text-ink-soft"}`}
                            >
                              {m.from} · {formatDate(messageTime(m))}
                            </p>
                            {m.subject ? (
                              <p className="mt-1 font-semibold">{m.subject}</p>
                            ) : null}
                            <p className="mt-1 whitespace-pre-wrap break-words">
                              {m.text}
                            </p>
                            {m.labels.length > 0 && (
                              <p
                                className={`mt-1 text-[11px] ${isOwn ? "text-white/80" : "text-ink-soft"}`}
                              >
                                {m.labels.join(", ")}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="mt-1 rounded-xl border border-ink/10 bg-white p-3">
                  <label
                    htmlFor="mail-reply"
                    className="text-sm font-semibold text-ink"
                  >
                    Reply
                  </label>
                  <textarea
                    id="mail-reply"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a kind, clear reply..."
                    rows={4}
                    className="mt-1 min-h-[48px] w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSendReply}
                      disabled={sending || !replyText.trim()}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
