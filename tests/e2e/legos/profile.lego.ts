import { expect, type Page } from "@playwright/test";

export class ProfileLego {
  constructor(private page: Page) {}

  /**
   * Navigates directly to a pet's profile page (overview hub).
   */
  async goto(petId: string): Promise<void> {
    await this.page.goto(`/dashboard/pets/${petId}`);
    await expect(
      this.page.getByRole("region", { name: /Pet overview/i }),
    ).toBeVisible();
  }

  /**
   * Checks the profile completeness score percentage (hero health bar).
   */
  async getProfileScore(): Promise<number> {
    const scoreElem = this.page
      .locator("section[aria-label='Pet overview']")
      .getByText(/% Complete/i);
    await expect(scoreElem).toBeVisible();
    const text = (await scoreElem.textContent()) || "";
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Asserts the profile completeness score matches or exceeds expected.
   */
  async expectProfileScore(expected: number | RegExp): Promise<void> {
    const hero = this.page.locator("section[aria-label='Pet overview']");
    if (typeof expected === "number") {
      await expect(hero.getByText(`${expected}% Complete`)).toBeVisible();
    } else {
      await expect(hero.getByText(expected)).toBeVisible();
    }
  }

  /**
   * Verifies the hero's three status stats (appointments, vaccinations,
   * medications) are present — condensed into the hero card's stat chips.
   */
  async verifyStatusCards(): Promise<{
    appointmentsVisible: boolean;
    vaccinesVisible: boolean;
    medicationsVisible: boolean;
  }> {
    const heroStats = this.page
      .locator("section[aria-label='Pet overview']")
      .locator("dl");

    await expect(heroStats.getByText("Appointments", { exact: true })).toBeVisible();
    await expect(heroStats.getByText("Vaccinations", { exact: true })).toBeVisible();
    await expect(heroStats.getByText("Medications", { exact: true })).toBeVisible();

    return {
      appointmentsVisible: true,
      vaccinesVisible: true,
      medicationsVisible: true,
    };
  }

  /**
   * Toggles a recommended care checklist item by its title or part of it.
   * Care items are semantic checkboxes labelled "{title}: {status}".
   */
  async toggleRecommendedCareItem(titleSubstring: string): Promise<void> {
    const careSection = this.page.locator("section[aria-label='Care checklist']");
    await expect(careSection).toBeVisible();

    const toggleBtn = careSection
      .getByRole("checkbox")
      .filter({ hasText: new RegExp(titleSubstring, "i") });
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
  }

  /**
   * Asserts the status of a recommended care item ("Up to date" or "Recommended").
   */
  async expectCareItemStatus(
    titleSubstring: string,
    status: "Up to date" | "Recommended",
  ): Promise<void> {
    const careSection = this.page.locator("section[aria-label='Care checklist']");
    const toggleBtn = careSection
      .getByRole("checkbox")
      .filter({ hasText: new RegExp(titleSubstring, "i") });
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn.getByText(status, { exact: true })).toBeVisible();
  }

  /**
   * Opens the Edit Pet modal and updates details.
   */
  async editPetDetails(details: { name?: string; breed?: string; weightKg?: number }): Promise<void> {
    const editBtn = this.page.getByRole("button", { name: /Edit Pet/i });
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const dialogHeading = this.page.getByRole("heading", { name: /Edit .* Profile/i });
    await expect(dialogHeading).toBeVisible();

    if (details.name !== undefined) {
      const nameInput = this.page.locator("input[required]").first();
      await nameInput.fill(details.name);
    }
    if (details.breed !== undefined) {
      const breedInput = this.page.getByPlaceholder(/Golden Retriever/i);
      await breedInput.fill(details.breed);
    }
    if (details.weightKg !== undefined) {
      const weightInput = this.page.getByPlaceholder("e.g. 12.5");
      await weightInput.fill(details.weightKg.toString());
    }

    const saveBtn = this.page.getByRole("button", { name: /Save changes/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    await expect(dialogHeading).not.toBeVisible();
  }
}

export function createProfileLego(page: Page): ProfileLego {
  return new ProfileLego(page);
}
