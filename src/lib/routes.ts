/**
 * Public URL path constants for App Router pages.
 *
 * Next.js route groups like `(marketing)` never appear in the URL — only use
 * these constants (or paths derived from them) in `href`, `redirect`, and
 * `router.push`. See `routes.test.ts` for the leak guard.
 */

export const ROUTES = {
  home: "/",
  howItWorks: "/how-it-works",
  pricing: "/pricing",
  legal: {
    terms: "/legal/terms",
    privacy: "/legal/privacy",
    refunds: "/legal/refunds",
  },
  signIn: "/sign-in",
  onboarding: "/onboarding",
  dashboard: {
    root: "/dashboard",
    pets: "/dashboard/pets",
    docs: "/dashboard/docs",
    reminders: "/dashboard/reminders",
    share: "/dashboard/share",
    settings: "/dashboard/settings",
  },
} as const;

export type DashboardRoute =
  (typeof ROUTES.dashboard)[keyof typeof ROUTES.dashboard];

/** Flat list of every static path we expose as a typed constant. */
export function allRouteHrefs(): string[] {
  const { dashboard, legal, ...marketing } = ROUTES;
  return [
    ...Object.values(marketing),
    ...Object.values(legal),
    ...Object.values(dashboard),
  ];
}

/** True when a path incorrectly embeds a Next.js route-group segment. */
export function hasRouteGroupLeak(href: string): boolean {
  return /\/\([^/]+\)(?:\/|$)/.test(href);
}

export function petHref(petId: string): string {
  return `${ROUTES.dashboard.pets}/${petId}`;
}

export function passportHref(token: string): string {
  return `/p/${token}`;
}

export function publicShareHref(token: string): string {
  return `/p/${token}`;
}
