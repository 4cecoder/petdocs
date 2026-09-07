import type { LucideIcon } from "lucide-react";
import {
  Bell,
  FileText,
  Home,
  PawPrint,
  Settings,
  Share2,
} from "lucide-react";
import { ROUTES, type DashboardRoute } from "./routes";

export interface DashboardNavItem {
  href: DashboardRoute;
  label: string;
  icon: LucideIcon;
  /** Child paths that should light this link in the sidebar. */
  activeFor?: readonly string[];
}

const d = ROUTES.dashboard;

/** Slim 6-item sidebar — mirrors Android FeatureCatalog order. */
export const DASHBOARD_NAV: DashboardNavItem[] = [
  { href: d.root, label: "Home", icon: Home },
  { href: d.pets, label: "Pets", icon: PawPrint },
  { href: d.docs, label: "Docs", icon: FileText },
  { href: d.reminders, label: "Reminders", icon: Bell },
  { href: d.share, label: "Share", icon: Share2 },
  { href: d.settings, label: "Settings", icon: Settings },
];

export function navSlug(href: string): string {
  return href.replace(ROUTES.dashboard.root, "").replace(/^\//, "") || "home";
}

export function isNavItemActive(pathname: string, item: DashboardNavItem): boolean {
  if (item.href === ROUTES.dashboard.root) {
    return pathname === ROUTES.dashboard.root;
  }
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }
  return (item.activeFor ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
