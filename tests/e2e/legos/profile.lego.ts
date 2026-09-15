import { expect, type Page } from "@playwright/test";

export class ProfileLego {
  constructor(private page: Page) {}

  /**
   * Navigates directly to a pet's profile page.
   */
  async goto(petId: string): Promise<void> {
    await this.page.goto(`/dashboard/pets/${petId}`);
    await expect(
      this.page.getByRole("region", { name: /Profile completion/i }),
    ).toBeVisible();
  }

  /**
   * Checks the profile completeness score percentage and returns the number.
   */
  async getProfileScore(): Promise<number> {
    const scoreElem = this.page.locator("section[aria-label='Profile completion']").getByText(/% Complete/i);
    await expect(scoreElem).toBeVisible();
    const text = (await scoreElem.textContent()) || "";
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Asserts the profile completeness score matches or exceeds expected.
   */
  async expectProfileScore(expected: number | RegExp): Promise<void> {
    const section = this.page.locator("section[aria-label='Profile completion']");
    if (typeof expected === "number") {
      await expect(section.getByText(`${expected}% Complete`)).toBeVisible();
    } else {
      await expect(section.getByText(expected)).toBeVisible();
    }
  }

  /**
   * Verifies the 3 status summary cards (Appointments, Vaccines, Medications) are present.
   */
  async verifyStatusCards(): Promise<{
    appointmentsVisible: boolean;
    vaccinesVisible: boolean;
    medicationsVisible: boolean;
  }> {
    const summarySection = this.page.locator("section[aria-label='Status Summary']");
    await expect(summarySection).toBeVisible();

    const apptCard = summarySection.getByText("Appointments", { exact: true });
    const vaxCard = summarySection.getByText("Vaccines", { exact: true });
    const medsCard = summarySection.getByText("Medications", { exact: true });

    await expect(apptCard).toBeVisible();
    await expect(vaxCard).toBeVisible();
    await expect(medsCard).toBeVisible();

    return {
      appointmentsVisible: true,
      vaccinesVisible: true,
      medicationsVisible: true,
    };
  }

  /**
   * Toggles a recommended care checklist item by its title or part of it.
   */
  async toggleRecommendedCareItem(titleSubstring: string): Promise<void> {
    const careSection = this.page.locator("section[aria-label='Recommended Care']");
    await expect(careSection).toBeVisible();

    const toggleBtn = careSection.getByRole("button", {
      name: new RegExp(`Toggle .*${titleSubstring}`, "i"),
    });
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
  }

  /**
   * Asserts the status of a recommended care item ("Up to date" or "Recommended").
   */
  async expectCareItemStatus(titleSubstring: string, status: "Up to date" | "Recommended"): Promise<void> {
    const careSection = this.page.locator("section[aria-label='Recommended Care']");
    const toggleBtn = careSection.getByRole("button", { name: new RegExp(`Toggle .*${titleSubstring}`, "i") });
    await expect(toggleBtn).toBeVisible();
    const itemCard = toggleBtn.locator("..");
    await expect(itemCard.getByText(status, { exact: true })).toBeVisible();
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
