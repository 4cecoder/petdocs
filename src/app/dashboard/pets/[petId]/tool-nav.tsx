"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  FileText,
  Pill,
  Share2,
  Stethoscope,
  Syringe,
  LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { petSubrouteHref, type PetSubroute } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface PetToolLink {
  subroute: PetSubroute;
  label: string;
  hint: string;
  icon: LucideIcon;
}

/** The six nested tool pages under a pet's profile hub. */
export const PET_TOOLS: PetToolLink[] = [
  { subroute: "vaccinations", label: "Vaccinations", hint: "Shots & boosters", icon: Syringe },
  { subroute: "medications", label: "Medications", hint: "Rx & preventives", icon: Pill },
  { subroute: "visits", label: "Visits", hint: "Clinic history", icon: Stethoscope },
  { subroute: "documents", label: "Documents", hint: "Vault & uploads", icon: FileText },
  { subroute: "share", label: "Share", hint: "Passport links", icon: Share2 },
  { subroute: "reminders", label: "Reminders", hint: "Due dates", icon: CalendarClock },
];

/**
 * Active-state tool navigation for the pet hub. The current route's pill is
 * highlighted via usePathname so deep links land on the right tool context.
 */
export function PetToolNav({ petId }: { petId: string }) {
  const pathname = usePathname();
  const overviewHref = `/dashboard/pets/${petId}`;
  const isOverview = pathname === overviewHref;

  return (
    <nav aria-label="Pet tools" className="flex flex-col gap-1">
      <ul className="flex list-none gap-2 overflow-x-auto pb-1">
        <li className="shrink-0">
          <Link
            href={overviewHref}
            aria-current={isOverview ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
              isOverview
                ? "border-brand-500/60 bg-brand-50 text-brand-800"
                : "border-ink/10 bg-white text-ink hover:bg-cream",
            )}
          >
            <LayoutGrid size={16} aria-hidden="true" />
            Overview
          </Link>
        </li>
        {PET_TOOLS.map((tool) => {
          const href = petSubrouteHref(petId, tool.subroute);
          const active = pathname === href;
          return (
            <li key={tool.subroute} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                  active
                    ? "border-brand-500/60 bg-brand-50 text-brand-800"
                    : "border-ink/10 bg-white text-ink hover:bg-cream",
                )}
              >
                <tool.icon size={16} aria-hidden="true" />
                {tool.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
