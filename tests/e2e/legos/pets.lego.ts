import { expect, type Locator, type Page } from "@playwright/test";

export class PetsLego {
  constructor(private page: Page) {}

  /**
   * Navigates to the pets dashboard page.
   */
  async goto(): Promise<void> {
    await this.page.goto("/dashboard/pets");
    await expect(
      this.page.getByRole("heading", { name: "Pets", exact: true }),
    ).toBeVisible();
  }

  /**
   * Opens the "+ Add pet" wizard form on the pets dashboard.
   */
  async openAddPetForm(): Promise<void> {
    const addBtn = this.page.getByRole("button", { name: /\+ Add pet/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await expect(
      this.page.getByRole("heading", { name: "Name your pet" }),
    ).toBeVisible();
  }

  /**
   * Fills the pet name in step 0 of the wizard.
   */
  async fillPetName(name: string): Promise<void> {
    const nameInput = this.page.getByRole("textbox", { name: /name/i });
    await expect(nameInput).toBeVisible();
    await nameInput.fill(name);
  }

  /**
   * Selects the species in step 1 of the wizard.
   */
  async selectSpecies(species: string): Promise<void> {
    const select = this.page.getByRole("combobox");
    await expect(select).toBeVisible();
    await select.selectOption(species.toLowerCase());
  }

  /**
   * Fills optional breed in step 1 of the wizard.
   */
  async fillBreed(breed: string): Promise<void> {
    const breedInput = this.page.getByPlaceholder("Golden retriever");
    await expect(breedInput).toBeVisible();
    await breedInput.fill(breed);
  }

  /**
   * Complete add pet flow: step 0 (Name) -> step 1 (Details) -> submit.
   */
  async addPet(name: string, species = "dog", breed = ""): Promise<void> {
    await this.openAddPetForm();
    await this.fillPetName(name);

    const continueBtn = this.page.getByRole("button", { name: "Continue" });
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    await expect(
      this.page.getByRole("heading", { name: "Pet details" }),
    ).toBeVisible();

    if (species !== "dog") {
      await this.selectSpecies(species);
    }
    if (breed) {
      await this.fillBreed(breed);
    }

    const submitBtn = this.page.getByRole("button", { name: /Add pet/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
  }

  /**
   * Locates a pet card link by pet name.
   */
  getPetCard(name: string): Locator {
    return this.page.getByRole("link", { name: new RegExp(name, "i") });
  }

  /**
   * Clicks on the pet card to navigate to its profile detail page.
   */
  async clickPetCard(name: string): Promise<void> {
    const card = this.getPetCard(name);
    await expect(card).toBeVisible();
    await card.click();
    await expect(this.page).toHaveURL(/\/dashboard\/pets\/[^/]+/);
  }

  /**
   * Asserts a pet card with the given name is visible.
   */
  async expectPetVisible(name: string): Promise<void> {
    await expect(this.getPetCard(name)).toBeVisible();
  }
}

export function createPetsLego(page: Page): PetsLego {
  return new PetsLego(page);
}
