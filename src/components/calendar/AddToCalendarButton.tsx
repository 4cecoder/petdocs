"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import {
  downloadIcsFile,
  googleCalendarUrl,
  outlookCalendarUrl,
  type CalendarEventInput,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

/**
 * One-click "Add to calendar" (issue #19 v1 — no OAuth).
 *
 * - `split`: primary button downloads the universal `.ics`; the chevron opens
 *   a menu with Google Calendar / Outlook deeplinks.
 * - `menu`: compact icon-only variant for dense rows.
 *
 * Follows the NotificationsBell dropdown pattern (no ui-kit dependency).
 */
export function AddToCalendarButton({
  event,
  variant = "split",
  className,
}: {
  event: CalendarEventInput;
  variant?: "split" | "menu";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside pointer-down or Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  function handleDownload() {
    downloadIcsFile(event);
    close();
  }

  const menu = (
    <div
      role="menu"
      aria-label={`Add ${event.title} to calendar`}
      className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-xl border border-ink/10 bg-white py-1 shadow-lg"
    >
      <a
        role="menuitem"
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={close}
        className="flex min-h-[44px] items-center gap-2 px-3 text-sm font-medium text-ink hover:bg-cream"
      >
        Google Calendar
      </a>
      <a
        role="menuitem"
        href={outlookCalendarUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={close}
        className="flex min-h-[44px] items-center gap-2 px-3 text-sm font-medium text-ink hover:bg-cream"
      >
        Outlook
      </a>
      <button
        role="menuitem"
        type="button"
        onClick={handleDownload}
        className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-sm font-medium text-ink hover:bg-cream"
      >
        Download .ics file
      </button>
    </div>
  );

  if (variant === "menu") {
    return (
      <div ref={rootRef} className={cn("relative shrink-0", className)}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Add to calendar: ${event.title}`}
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-soft transition hover:bg-cream hover:text-ink"
        >
          <CalendarPlus size={20} aria-hidden="true" />
        </button>
        {open ? menu : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative inline-flex shrink-0", className)}>
      <button
        type="button"
        onClick={handleDownload}
        aria-label="Add to calendar (download .ics)"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-l-xl border border-ink/15 bg-white px-3 text-xs font-semibold text-ink transition hover:bg-cream"
      >
        <CalendarPlus size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Add to calendar</span>
      </button>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More calendar options"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center rounded-r-xl border border-l-0 border-ink/15 bg-white px-1.5 text-ink-soft transition hover:bg-cream"
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? menu : null}
    </div>
  );
}
