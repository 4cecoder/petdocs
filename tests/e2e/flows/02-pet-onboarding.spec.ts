import { expect, test } from "@playwright/test";
import { createAuthLego, createPetsLego, setupConvexMock } from "../legos";

test.describe("Flow 02: Pet Onboarding and Creation", () => {
  test("onboarding gates Step 0 on valid pet name and handles stepper navigation", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: "Add your first pet" }),
    ).toBeVisible();

    const nameInput = page.getByRole("textbox", { name: /pet.*name/i });
    const continueButton = page.getByRole("button", { name: "Continue" });

    // Empty name disables continue
    await expect(continueButton).toBeDisabled();

    // Entering name enables continue
    await nameInput.fill("Biscuit");
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Step 1: Document snap / skip step
    await expect(
      page.getByRole("heading", { name: "Snap your first doc" }),
    ).toBeVisible();

    // Step back to Step 0
    await page.getByRole("button", { name: /Back/i }).click();
    await expect(
      page.getByRole("heading", { name: "Add your first pet" }),
    ).toBeVisible();
    await expect(nameInput).toHaveValue("Biscuit");

    // Advance to Step 1 again, then skip
    await continueButton.click();
    await page.getByRole("button", { name: /Skip for now/i }).click();

    // Step 2: All set
    await expect(
      page.getByRole("heading", { name: "You're set!" }),
    ).toBeVisible();
    await expect(page.getByText(/Biscuit has a vault/i)).toBeVisible();

    const dashboardLink = page.getByRole("button", { name: /Go to dashboard/i });
    await expect(dashboardLink).toBeVisible();
  });

  test("dashboard allows adding a new pet through 2-step wizard", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const pets = createPetsLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/pets");
    await pets.expectPetVisible("Miso");

    await pets.addPet("Waffles", "dog", "Corgi");
    await pets.expectPetVisible("Waffles");
  });
});
