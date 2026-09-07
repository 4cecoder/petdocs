import { expect, test } from "@playwright/test";

// Extended suite: intentionally untagged so the smoke grep skips it.
// No auth, no backend (NEXT_PUBLIC_CONVEX_URL unset in CI): static/empty
// states only, no form submits that hit Convex.
test.describe("flows", () => {
  test("onboarding Continue gates on pet name", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: "Add your first pet" }),
    ).toBeVisible();

    const nameInput = page.getByRole("textbox", { name: /pet.*name/i });
    const continueButton = page.getByRole("button", { name: "Continue" });

    await expect(nameInput).toBeVisible();
    await expect(continueButton).toBeDisabled();

    await nameInput.fill("Mochi");
    await expect(continueButton).toBeEnabled();
  });

  test("help widget answers price with pricing link", async ({ page }) => {
    // HelpWidget only mounts in the (marketing) layout, so use "/".
    await page.goto("/");
    await page.getByRole("button", { name: "Get help" }).click();

    const dialog = page.getByRole("dialog", { name: "PetDocs help" });
    await expect(dialog).toBeVisible();

    await dialog
      .getByRole("textbox", { name: "Ask a question" })
      .fill("price");
    await dialog.getByRole("button", { name: "Send" }).click();

    const pricingLink = dialog.getByRole("link", { name: "See pricing" });
    await expect(pricingLink).toBeVisible();
    await expect(pricingLink).toHaveAttribute("href", "/pricing");
  });

  test("share page redirects unauthenticated to sign-in", async ({ page }) => {
    await page.goto("/dashboard/share");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("bogus passport token shows no-backend placeholder", async ({
    page,
  }) => {
    // Truthful no-backend copy from p/[shareToken]/page.tsx: with
    // NEXT_PUBLIC_CONVEX_URL unset, PlaceholderPassport renders (not the
    // "expired or revoked" state, which needs a configured backend).
    await page.goto("/p/bogus-token");
    await expect(
      page.getByRole("heading", { name: "Shared pet profile" }),
    ).toBeVisible();
    await expect(page.getByText("Link: bogus-token")).toBeVisible();
    await expect(
      page.getByText(
        "Verified records will appear here once the owner connects their vault.",
      ),
    ).toBeVisible();
  });

  test("legal pages interlink terms to privacy", async ({ page }) => {
    await page.goto("/legal/terms");
    const legalNav = page.getByRole("navigation", { name: "Legal" });
    const privacyLink = legalNav.getByRole("link", { name: "Privacy" });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute("href", "/legal/privacy");

    await privacyLink.click();
    await expect(page).toHaveURL("/legal/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" }),
    ).toBeVisible();
  });
});
