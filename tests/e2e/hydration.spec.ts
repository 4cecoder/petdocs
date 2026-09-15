import { expect, test } from "@playwright/test";
import {
  collectClientErrors,
  expectNoClientErrors,
  expectSignedIn,
  signUpViaUi,
} from "./helpers";

/**
 * Hydration regression (issue #NN: dashboard hydration mismatch on first
 * paint).
 *
 * DashboardAuthProvider used to read localStorage inside its useState
 * initializer, so a signed-in client's FIRST render already had the session
 * while the server render (no localStorage) always saw null. DashboardGuard
 * therefore rendered nothing on the server but the full dashboard tree on
 * the client's first paint — React 19 discarded the server HTML with a
 * hydration mismatch ("server rendered <div className=min-h-screen> /
 * client expected <script id=_R_>" in production) and re-rendered the whole
 * tree. The fix makes both sides render the "Checking your session…" shell
 * first and resolve the session in a mount effect.
 *
 * These tests pin the invariant at the only level it is observable end to
 * end: a REAL signed-in first paint must hydrate with zero client errors.
 * The collectors are attached before the very first navigation and survive
 * reload(), so every first-paint hydration in the flow is covered.
 */

test.describe("dashboard hydration", () => {
  test("signed-in first paint hydrates without server/client mismatch", async ({
    page,
  }) => {
    const errors = collectClientErrors(page);

    // Real magic-link sign-up: covers sign-in page hydration too.
    await signUpViaUi(page, "hydration");

    // Hard reload = true first-paint hydration WITH a stored session —
    // the exact conditions of the fixed bug (server HTML vs a client
    // render that already knows the session).
    await page.reload();

    // The session must survive the reload: the guard resolves it from
    // localStorage after hydration and never bounces a signed-in user.
    await expectSignedIn(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expectNoClientErrors(errors, "signed-in dashboard first paint");
  });

  test("signed-out /dashboard mount redirects without client errors", async ({
    page,
  }) => {
    const errors = collectClientErrors(page);

    await page.goto("/dashboard");

    // No session: the guard must send the user to sign-in (keeping the
    // ?next target) — and do it without any hydration noise.
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/, {
      timeout: 15_000,
    });

    expectNoClientErrors(errors, "signed-out dashboard mount");
  });
});
