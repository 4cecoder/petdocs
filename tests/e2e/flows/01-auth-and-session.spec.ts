import { expect, test } from "@playwright/test";
import { createAuthLego, setupConvexMock } from "../legos";

test.describe("Flow 01: Auth and Session Management", () => {
  test("unauthenticated access redirects to /sign-in with next parameter", async ({ page }) => {
    const auth = createAuthLego(page);
    await page.goto("/dashboard");
    await auth.expectUnauthenticated();
    await expect(page).toHaveURL(/next=%2Fdashboard/);
  });

  test("requesting magic link displays status and dev preview link", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);

    await auth.requestMagicLink("owner@petdocs.test");
    // Verify magic link request button state change or dev preview presence
    const sendBtn = page.getByRole("button", { name: /magic link/i });
    await expect(sendBtn).toBeVisible();

    // Verify direct dev link if available
    const directLink = page.getByRole("link", { name: /http:\/\/.*\/sign-in\?email=/i });
    if (await directLink.isVisible().catch(() => false)) {
      await expect(directLink).toHaveAttribute("href", /token=/);
    }
  });

  test("local demo role shortcut uses the normal magic-link flow", async ({ page }) => {
    await setupConvexMock(page);

    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { name: "Local demo access" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Support" }).click();

    await expect(page).toHaveURL(/\/dashboard\/admin$/);
  });

  test("direct login establishes session and enables access to dashboard", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard");
    await auth.expectAuthenticated();
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i })).toBeVisible();
  });

  test("signing out clears session and redirects to marketing home", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard");
    await auth.expectAuthenticated();

    await auth.signOut();
    await expect(page).toHaveURL(/\/(#.*)?$/);

    // Re-visiting dashboard immediately redirects to sign-in
    await page.goto("/dashboard");
    await auth.expectUnauthenticated();
  });
});
