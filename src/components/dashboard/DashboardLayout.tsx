"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PawPrint } from "lucide-react";
import { DASHBOARD_NAV, isNavItemActive } from "@/lib/dashboardNav";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useDashboardAuth } from "./DashboardGuard";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut } = useDashboardAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href={ROUTES.dashboard.root} className="flex items-center gap-2">
            <PawPrint size={24} aria-hidden="true" className="text-brand-600" />
            <span className="font-display text-lg font-bold">petdocs</span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="min-h-[48px] rounded-xl px-3 text-sm font-medium text-ink-soft hover:bg-cream-dark"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <nav
          aria-label="Dashboard"
          className="sticky top-24 hidden h-fit w-52 shrink-0 flex-col gap-1 md:flex"
        >
          {DASHBOARD_NAV.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[48px] items-center gap-3 rounded-xl px-3 font-medium",
                  active
                    ? "bg-brand-600 text-white"
                    : "text-ink-soft hover:bg-cream-dark hover:text-ink",
                )}
              >
                <Icon size={20} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 pb-24 md:pb-8">{children}</main>
      </div>

      {/* Bottom tab bar: primary nav on phones, mirrors Android bottom nav. */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-ink/10 bg-cream/95 backdrop-blur md:hidden"
      >
        {DASHBOARD_NAV.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[64px] flex-col items-center justify-center gap-1 text-[11px] font-medium",
                active ? "text-brand-700" : "text-ink-soft",
              )}
            >
              <Icon size={22} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
