import { expect, test } from "@playwright/test";
import { createAssistantLego } from "../legos";

test.describe("Flow 08: Pet Assistant FAB and Drawer", () => {
  test("toggles assistant drawer open and closed", async ({ page }) => {
    const assistant = createAssistantLego(page);

    // HelpWidget mounts in the marketing layout
    await page.goto("/");
    await assistant.expectDrawerClosed();

    await assistant.toggleFab();
    await assistant.expectDrawerOpen();

    await assistant.closeDrawer();
  });

  test("answers typed user queries with contextual links", async ({ page }) => {
    const assistant = createAssistantLego(page);

    await page.goto("/");
    await assistant.toggleFab();
    await assistant.expectDrawerOpen();

    await assistant.askQuestion("how much does petdocs cost?");
    await assistant.expectResponseContaining("pricing");

    const pricingLink = assistant.getDrawer().getByRole("link", { name: /pricing/i });
    await expect(pricingLink).toBeVisible();
    await expect(pricingLink).toHaveAttribute("href", "/pricing");
  });

  test("handles quick chip clicks and presents instant answers", async ({ page }) => {
    const assistant = createAssistantLego(page);

    await page.goto("/");
    await assistant.toggleFab();
    await assistant.expectDrawerOpen();

    await assistant.clickQuickChip("Share");
    await assistant.expectResponseContaining("share");
    // Exact bot-answer text: the regex /QR code|link/i also matches the
    // user's chip echo in the log and trips Playwright strict mode.
    await assistant.expectResponseContaining("Create a share link");
  });
});
