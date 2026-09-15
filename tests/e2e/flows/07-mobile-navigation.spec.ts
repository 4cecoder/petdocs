import { expect, test } from "@playwright/test";
import { createAuthLego, createNavLego, setupConvexMock } from "../legos";

test.describe("Flow 07: Mobile Bottom Navigation", () => {
  test("bottom nav bar is visible on mobile viewport and toggles active state across tabs", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const nav = createNavLego(page);

    // Set mobile device viewport
    await nav.setMobileViewport(390, 844);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard");

    // Ensure mobile bottom nav is visible while desktop sidebar is hidden
    await expect(nav.getMobileNav()).toBeVisible();
    await expect(nav.getDesktopNav()).not.toBeVisible();

    // Verify initial active tab is Home
    await nav.expectActiveTab("Home");

    // Navigate to Records / Docs
    await nav.navigateTo("Records");
    await nav.expectActiveTab("Docs");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    // Navigate to Reminders
    await nav.navigateTo("Reminders");
    await nav.expectActiveTab("Reminders");
    await expect(page.getByRole("heading", { name: "Reminders" })).toBeVisible();

    // Navigate to Settings
    await nav.navigateTo("Settings");
    await nav.expectActiveTab("Settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Navigate back to Home
    await nav.navigateTo("Home");
    await nav.expectActiveTab("Home");
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i })).toBeVisible();
  });
});
