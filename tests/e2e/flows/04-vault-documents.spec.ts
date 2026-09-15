import { expect, test } from "@playwright/test";
import { createAuthLego, createDocsLego, setupConvexMock } from "../legos";

test.describe("Flow 04: Vault Documents Lifecycle", () => {
  test("displays vault documents and filters by pet", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const docs = createDocsLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/docs");
    await docs.expectDocVisible("Rabies-Certificate-2026.pdf");

    // Filter by pet tab
    await docs.filterByPet("Miso");
    await docs.expectDocVisible("Rabies-Certificate-2026.pdf");
  });

  test("uploads new document through camera/upload wizard", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const docs = createDocsLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/pets/pet-miso");

    await docs.uploadDoc({
      fileName: "Bloodwork-Panel-2026.pdf",
      category: "lab_result",
    });

    await expect(
      page.getByRole("heading", { name: "Saved to the vault" }),
    ).toBeVisible();
  });

  test("moves document to trash and verifies immediate removal from list", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const docs = createDocsLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/pets/pet-miso");
    await docs.expectDocVisible("Rabies-Certificate-2026.pdf");

    await docs.moveToTrash("Rabies-Certificate-2026.pdf");
    await docs.expectDocNotVisible("Rabies-Certificate-2026.pdf");
  });
});
