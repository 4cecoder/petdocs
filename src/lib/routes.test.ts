import { describe, expect, it } from "vitest";
import {
  allRouteHrefs,
  getSmartDestination,
  hasRouteGroupLeak,
  isAuthRoute,
  isDashboardRoute,
  ROUTES,
  sanitizeNextRoute,
} from "./routes";

describe("routes", () => {
  it("exposes no route-group segments in public hrefs", () => {
    for (const href of allRouteHrefs()) {
      expect(hasRouteGroupLeak(href), `leak in ${href}`).toBe(false);
    }
  });

  it("detects route-group leaks", () => {
    // Fixture strings for the detector itself — not real hrefs.
    // eslint-disable-next-line no-restricted-syntax
    expect(hasRouteGroupLeak("/(marketing)/pricing")).toBe(true);
    expect(hasRouteGroupLeak("/dashboard/pets")).toBe(false);
  });

  it("sanitizes next route parameter correctly", () => {
    expect(sanitizeNextRoute("/dashboard/pets")).toBe("/dashboard/pets");
    // Blocks external / protocol-relative open redirects
    expect(sanitizeNextRoute("https://evil.com")).toBe(ROUTES.dashboard.root);
    expect(sanitizeNextRoute("//evil.com")).toBe(ROUTES.dashboard.root);
    // Blocks internal route leaks
    expect(sanitizeNextRoute("/(marketing)/about")).toBe(ROUTES.dashboard.root);
    // Fallback when missing
    expect(sanitizeNextRoute(null)).toBe(ROUTES.dashboard.root);
  });

  it("identifies dashboard and auth routes", () => {
    expect(isDashboardRoute("/dashboard")).toBe(true);
    expect(isDashboardRoute("/dashboard/pets/123")).toBe(true);
    expect(isDashboardRoute("/pricing")).toBe(false);

    expect(isAuthRoute("/sign-in")).toBe(true);
    expect(isAuthRoute("/onboarding")).toBe(true);
    expect(isAuthRoute("/dashboard")).toBe(false);
  });

  it("computes smart destinations correctly", () => {
    // Unauthenticated user going to dashboard -> sign-in with next
    expect(
      getSmartDestination({
        isAuthenticated: false,
        pathname: "/dashboard/docs",
      }),
    ).toBe(`${ROUTES.signIn}?next=${encodeURIComponent("/dashboard/docs")}`);

    // Authenticated new user landing on sign-in -> onboarding
    expect(
      getSmartDestination({
        isAuthenticated: true,
        pathname: "/sign-in",
        isNewUser: true,
      }),
    ).toBe(ROUTES.onboarding);

    // Authenticated existing user landing on sign-in with next param -> sanitized destination
    expect(
      getSmartDestination({
        isAuthenticated: true,
        pathname: "/sign-in",
        isNewUser: false,
        nextParam: "/dashboard/reminders",
      }),
    ).toBe("/dashboard/reminders");

    // Authenticated user already on dashboard page -> no redirect
    expect(
      getSmartDestination({
        isAuthenticated: true,
        pathname: "/dashboard/pets",
      }),
    ).toBeNull();
  });
});

