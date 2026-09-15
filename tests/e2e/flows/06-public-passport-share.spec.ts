import { expect, test } from "@playwright/test";
import { createAuthLego, createShareLego, setupConvexMock } from "../legos";

test.describe("Flow 06: Public Passport and Share Management", () => {
  test("generates share link from pet profile via 3-step wizard", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const share = createShareLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/pets/pet-miso");

    const { token, shareUrl } = await share.generateShareLink({
      recipient: "Paws Boarding Resort",
      expiry: "7d",
    });

    expect(token).toBeTruthy();
    expect(shareUrl).toContain("/p/");
  });

  test("public passport renders shared pet profile and vaccine status without authentication", async ({ page }) => {
    const share = createShareLego(page);

    await share.verifyPublicPassportView("tok-miso-passport-demo");
    await expect(
      page.locator("p").filter({ hasText: /expired or revoked|Verified records will appear here/i }),
    ).toBeVisible();
  });

  test("revoking link on /dashboard/share removes the active link", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const share = createShareLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/share");
    await share.revokeShareLink("Landlord Verification");
  });

  test("apartment packet preview is accessible and accurate on share page", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const share = createShareLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/share");
    await share.verifyApartmentPacket("Mochi");
  });
});
