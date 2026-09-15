"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Folder, Home, Settings } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface MobileTabItem {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
}

const TABS: MobileTabItem[] = [
  {
    href: ROUTES.dashboard.root,
    label: "Home",
    icon: Home,
    isActive: (pathname) => pathname === ROUTES.dashboard.root,
  },
  {
    href: ROUTES.dashboard.docs,
    label: "Records",
    icon: Folder,
    isActive: (pathname) =>
      pathname.startsWith(ROUTES.dashboard.docs) ||
      pathname.startsWith("/dashboard/vault") ||
      pathname.startsWith("/dashboard/documents"),
  },
  {
    href: ROUTES.dashboard.reminders,
    label: "Reminders",
    icon: Bell,
    isActive: (pathname) => pathname.startsWith(ROUTES.dashboard.reminders),
  },
  {
    href: ROUTES.dashboard.settings,
    label: "Settings",
    icon: Settings,
    isActive: (pathname) => pathname.startsWith(ROUTES.dashboard.settings),
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-ink/10 px-4 py-2 flex justify-around items-center"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.isActive(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-1 text-xs transition-colors",
              active
                ? "font-semibold text-brand-600"
                : "font-medium text-ink-soft hover:text-ink",
            )}
          >
            <Icon
              size={20}
              aria-hidden="true"
              className={active ? "text-brand-600 stroke-[2.25]" : "text-ink-soft stroke-2"}
            />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
