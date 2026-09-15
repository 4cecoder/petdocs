import { expect, test } from "@playwright/test";
import { addPetViaUi, randomToken, signUpViaUi } from "./helpers";

/**
 * Share-link flow against the real backend:
 *   pet profile -> ShareButton wizard (shareLinks:createToken) -> open the
 *   /p/[token] passport in a BRAND-NEW logged-out context ->
 *   shareLinks:resolve renders the pet -> revoke -> public link goes dead.
 * Also covers the bogus-token placeholder (backend configured, so
 * p/[shareToken]/page.tsx renders the dead-link state, NOT the no-backend
 * placeholder that flows.spec.ts asserts in CI).
 */
test.describe("share: public passport", () => {
  test("create link, view logged out, revoke kills it", async ({ page }) => {
    const { email } = await signUpViaUi(page, "share");
    const name = `Maple${Date.now().toString(36)}`;
    await addPetViaUi(page, { name, species: "cat", breed: "E2E Tabby" });

    // ShareButton 3-step wizard, now on the pet's Share tool sub-page.
    await page.getByRole("link", { name: new RegExp(`^${name}`) }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toHaveText(name);
    const petToolNav = page.getByRole("navigation", { name: "Pet tools" });
    await expect(petToolNav).toBeVisible();
    await petToolNav.getByRole("link", { name: "Share", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/pets\/[^/]+\/share$/);
    await page.getByLabel(/Who.s this link for/).fill("E2E Vet");
    await page.getByRole("button", { name: "Continue", exact: true }).first().click();
    await page.getByRole("radio", { name: /7 days/ }).check();
    await page.getByRole("button", { name: "Make link" }).click();

    // shareLinks:createToken resolved; the passport URL is rendered.
    await expect(page.getByText(/Done\. Link ready for E2E Vet/)).toBeVisible({
      timeout: 20_000,
    });
    const shareAnchor = page.getByRole("link", { name: /\/p\/[0-9a-f]{8}/ });
    await expect(shareAnchor).toBeVisible();
    const shareHref = await shareAnchor.getAttribute("href");
    if (!shareHref || !shareHref.startsWith("/p/")) {
      throw new Error(`unexpected passport href: ${shareHref}`);
    }
    const shareToken = shareHref.slice("/p/".length);
    expect(shareToken).toMatch(/^[0-9a-f]{64}$/);
    const shareUrl = new URL(shareHref, page.url()).toString();

    // Open LOGGED OUT: brand-new browser context, no shared storage.
    const publicContext = await page.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(shareUrl);

    // The public passport renders the shared pet (server-resolved via
    // shareLinks:resolve), scoped projection only.
    await expect(publicPage.getByRole("heading", { level: 1, name })).toHaveText(name, {
      timeout: 20_000,
    });
    await expect(publicPage.getByText("cat · E2E Tabby")).toBeVisible();
    await expect(
      publicPage.getByText("No vaccination records shared with this link yet."),
    ).toBeVisible();
    await expect(publicPage.getByText("Read-only link. It may expire or be revoked.")).toBeVisible();
    // Privacy: the projection must never carry the owner identity.
    await expect(publicPage.locator("body")).not.toContainText(email);

    // Owner sees the link listed with the view count landing.
    await page.goto("/dashboard/share");
    const petSection = page.getByRole("region", { name: `${name}'s links` });
    await expect(petSection).toBeVisible({ timeout: 20_000 });
    // recordView is fire-and-forget from the passport render; poll reloads.
    await expect(async () => {
      await page.reload();
      await expect(
        petSection.getByText("1 view"),
      ).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 30_000, intervals: [2_000, 4_000] });

    // Revoke through the owner UI (destructive action now asks for confirm).
    await petSection.getByRole("button", { name: "Revoke", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Revoke link" })
      .click();
    await expect(page.getByText("No active links yet.")).toBeVisible({ timeout: 15_000 });

    // The revoked link is dead for the public visitor too.
    await publicPage.goto(shareUrl);
    await expect(publicPage.getByText("This link is expired or revoked.")).toBeVisible({
      timeout: 20_000,
    });
    await publicContext.close();
  });

  test("bogus token shows the expired/revoked placeholder", async ({ page }) => {
    // With NEXT_PUBLIC_CONVEX_URL configured, resolve() returns null for
    // unknown tokens and the page renders the dead-link state.
    await page.goto(`/p/${randomToken()}`);
    await expect(
      page.getByRole("heading", { name: "Shared pet profile" }),
    ).toBeVisible();
    await expect(page.getByText("This link is expired or revoked.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to petdocs home" }),
    ).toBeVisible();
  });
});
