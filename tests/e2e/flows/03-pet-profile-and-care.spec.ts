import { expect, test } from "@playwright/test";
import { createAuthLego, createProfileLego, setupConvexMock } from "../legos";

test.describe("Flow 03: Pet Profile and Preventative Care", () => {
  test("renders profile score and 3-card status summary correctly", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const profile = createProfileLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/pets/pet-miso");

    // Verify profile score progress bar
    const score = await profile.getProfileScore();
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);

    // Verify 3-card status summary
    const cards = await profile.verifyStatusCards();
    expect(cards.appointmentsVisible).toBe(true);
    expect(cards.vaccinesVisible).toBe(true);
    expect(cards.medicationsVisible).toBe(true);
  });

  test("toggling recommended care checklist item updates item status", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const profile = createProfileLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/pets/pet-miso");

    // Rabies is already fulfilled from mock vaccine; test Dental or Heartworm toggle
    await profile.expectCareItemStatus("Dental Examination", "Recommended");
    await profile.toggleRecommendedCareItem("Dental Examination");
    await profile.expectCareItemStatus("Dental Examination", "Up to date");

    // Toggle back
    await profile.toggleRecommendedCareItem("Dental Examination");
    await profile.expectCareItemStatus("Dental Examination", "Recommended");
  });

  test("editing pet details updates pet information seamlessly", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const profile = createProfileLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/pets/pet-miso");

    await profile.editPetDetails({
      name: "Miso Supreme",
      breed: "Japanese Bobtail",
      weightKg: 4.8,
    });

    await expect(
      page.getByRole("heading", { name: "Miso Supreme" }),
    ).toBeVisible();
    await expect(page.getByText(/Japanese Bobtail/i)).toBeVisible();
  });
});
