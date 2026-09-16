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
  contact: "/contact",
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

/** Sub-pages nested under a pet profile hub. */
export const PET_SUBROUTES = [
  "vaccinations",
  "medications",
  "visits",
  "documents",
  "share",
  "reminders",
] as const;

export type PetSubroute = (typeof PET_SUBROUTES)[number];

/**
 * Deep-linkable pet tool pages: /dashboard/pets/{petId}/{subroute}.
 * The bare petHref stays the overview hub.
 */
export function petSubrouteHref(petId: string, subroute: PetSubroute): string {
  return `${petHref(petId)}/${subroute}`;
}

/** True when a dashboard path is one of a pet's tool sub-pages. */
export function isPetSubroutePath(pathname: string): {
  petId: string;
  subroute: PetSubroute;
} | null {
  const prefix = `${ROUTES.dashboard.pets}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  const petId = rest.slice(0, slash);
  const subroute = rest.slice(slash + 1);
  const known = (PET_SUBROUTES as readonly string[]).includes(subroute);
  if (!petId || !known) return null;
  return { petId, subroute: subroute as PetSubroute };
}

export function passportHref(token: string): string {
  return `/p/${token}`;
}

export function publicShareHref(token: string): string {
  return `/p/${token}`;
}
