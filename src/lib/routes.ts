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

/**
 * Validates and sanitizes a 'next' query parameter to prevent open redirect vulnerabilities
 * while ensuring internal destination navigation works seamlessly.
 */
export function sanitizeNextRoute(rawNext: string | null | undefined, fallback: string = ROUTES.dashboard.root): string {
  if (!rawNext) return fallback;
  const trimmed = rawNext.trim();
  // Must start with a single slash, not protocol-relative '//', and contain no route-group leakage
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !hasRouteGroupLeak(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/**
 * Determines whether a given pathname belongs to the protected dashboard zone.
 */
export function isDashboardRoute(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

/**
 * Determines whether a given pathname is an auth route (e.g. sign-in, onboarding).
 */
export function isAuthRoute(pathname: string): boolean {
  return pathname === ROUTES.signIn || pathname === ROUTES.onboarding;
}

/**
 * Smart router decision: returns the optimal destination path based on authentication status and current route.
 */
export function getSmartDestination({
  isAuthenticated,
  pathname,
  isNewUser = false,
  nextParam,
}: {
  isAuthenticated: boolean;
  pathname: string;
  isNewUser?: boolean;
  nextParam?: string | null;
}): string | null {
  // If user is not authenticated and trying to access dashboard, redirect to sign-in with next
  if (!isAuthenticated && isDashboardRoute(pathname)) {
    return `${ROUTES.signIn}?next=${encodeURIComponent(pathname)}`;
  }

  // If user is authenticated and lands on sign-in or home, send them to onboarding or their next destination
  if (isAuthenticated && (isAuthRoute(pathname) || pathname === ROUTES.home)) {
    if (isNewUser) return ROUTES.onboarding;
    return sanitizeNextRoute(nextParam, ROUTES.dashboard.root);
  }

  return null; // No redirect needed
}

