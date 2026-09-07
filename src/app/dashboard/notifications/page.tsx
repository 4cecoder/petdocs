"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getOwnerId, isBackendConfigured } from "@/lib/api";
import { convexMutation, convexQuery } from "@/lib/convexHttp";

interface NotificationRow {
  _id: string;
  kind: string;
  title: string;
  body: string;
  link?: string;
  readAt?: number;
  createdAt: number;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  useEffect(() => {
    setOwnerId(getOwnerId());
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await convexQuery<NotificationRow[]>("notifications:list", {
        ownerId: id,
        limit: 50,
      });
      setRows(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load notifications.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ownerId || !isBackendConfigured) {
      setLoading(false);
      return;
    }
    void load(ownerId);
  }, [ownerId, load]);

  async function handleMarkOne(notificationId: string) {
    if (!ownerId || actingId) return;
    setActingId(notificationId);
    try {
      await convexMutation<string>("notifications:markRead", {
        ownerId,
        notificationId,
      });
      setRows((prev) =>
        (prev ?? []).map((r) =>
          r._id === notificationId ? { ...r, readAt: Date.now() } : r,
        ),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not mark as read.");
    } finally {
      setActingId(null);
    }
  }

  async function handleMarkAll() {
    if (!ownerId || clearingAll) return;
    setClearingAll(true);
    try {
      await convexMutation<number>("notifications:markAllRead", { ownerId });
      const now = Date.now();
      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.readAt === undefined ? { ...r, readAt: now } : r,
        ),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not mark all as read.");
    } finally {
      setClearingAll(false);
    }
  }

  const unread = (rows ?? []).filter((r) => r.readAt === undefined).length;

  if (!ownerId || !isBackendConfigured) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-ink-soft">
          Sign in to see your notifications.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {unread > 0
              ? `${unread} unread`
              : "You are all caught up on alerts."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleMarkAll()}
          disabled={clearingAll || unread === 0}
          className="min-h-[48px] shrink-0 rounded-2xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-cream-dark disabled:opacity-60"
        >
          {clearingAll ? "Clearing..." : "Mark all read"}
        </button>
      </div>

      <div aria-live="polite">
        {loading ? (
          <p role="status" className="text-sm text-ink-soft">
            Loading notifications...
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      {!loading && !error ? (
        rows && rows.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => {
              const isUnread = row.readAt === undefined;
              return (
                <li
                  key={row._id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isUnread ? (
                        <span
                          aria-label="Unread"
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600"
                        />
                      ) : null}
                      <p className="truncate font-semibold">{row.title}</p>
                    </div>
                    <p className="mt-1 break-words text-sm text-ink-soft">
                      {row.body}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                      <span>{formatDateTime(row.createdAt)}</span>
                      {row.link ? (
                        <Link
                          href={row.link}
                          className="font-semibold text-brand-700 underline"
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {isUnread ? (
                    <button
                      type="button"
                      onClick={() => void handleMarkOne(row._id)}
                      disabled={actingId === row._id}
                      className="min-h-[48px] shrink-0 rounded-xl border border-ink/15 bg-cream px-3 text-xs font-semibold hover:bg-cream-dark disabled:opacity-60"
                    >
                      {actingId === row._id ? "Saving..." : "Mark read"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-8 text-center text-sm text-ink-soft">
            <p className="text-base font-semibold text-ink">All caught up.</p>
            <p className="mt-1">
              Passport views, reminders, claims, mail, and transfers will show
              up here.
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}
