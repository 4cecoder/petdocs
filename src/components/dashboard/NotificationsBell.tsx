"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { convexMutation, convexQuery } from "@/lib/convexHttp";

interface BellItem {
  _id: string;
  kind: string;
  title: string;
  body: string;
  link?: string;
  readAt?: number;
  createdAt: number;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function NotificationsBell({
  ownerId,
}: {
  ownerId: string | null | undefined;
}) {
  const [count, setCount] = useState<number>(0);
  const [items, setItems] = useState<BellItem[]>([]);
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    try {
      const [unread, latest] = await Promise.all([
        convexQuery<number>("notifications:unreadCount", { ownerId }),
        convexQuery<BellItem[]>("notifications:list", {
          ownerId,
          limit: 5,
        }),
      ]);
      setCount(unread);
      setItems(latest);
    } catch {
      // Keep the last good state when the backend is unreachable.
    }
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [ownerId, refresh]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  if (!ownerId) return null;

  async function handleMarkAll() {
    if (!ownerId || clearing) return;
    setClearing(true);
    try {
      await convexMutation<number>("notifications:markAllRead", { ownerId });
      await refresh();
    } catch {
      // Keep the dropdown open so the user can retry.
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          count > 0
            ? `Notifications, ${count} unread`
            : "Notifications, no unread"
        }
        className="relative flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl px-3 text-ink-soft hover:bg-cream-dark hover:text-ink"
      >
        <Bell size={22} aria-hidden="true" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white"
          >
            {count > 9 ? "9+" : String(count)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-ink/10 bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-sm font-bold">Notifications</p>
            <button
              type="button"
              onClick={() => void handleMarkAll()}
              disabled={clearing || count === 0}
              className="min-h-[36px] rounded-lg px-2 text-xs font-semibold text-brand-700 hover:bg-cream disabled:opacity-50"
            >
              {clearing ? "Clearing..." : "Mark all read"}
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-soft">
              All caught up.
            </p>
          ) : (
            <ul className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item._id}
                  className="rounded-xl bg-cream px-3 py-2.5 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">{item.title}</p>
                    {item.readAt === undefined ? (
                      <span
                        aria-label="Unread"
                        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600"
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">
                    {item.body}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className="text-ink-soft">
                      {formatDate(item.createdAt)}
                    </span>
                    {item.link ? (
                      <Link
                        href={item.link}
                        onClick={() => setOpen(false)}
                        className="font-semibold text-brand-700 underline"
                      >
                        Open
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="px-2 py-1.5">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-[40px] items-center justify-center rounded-xl text-sm font-semibold text-brand-700 hover:bg-cream"
            >
              View all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
