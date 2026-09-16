import { expect, type Locator, type Page } from "@playwright/test";

export class DocsLego {
  constructor(private page: Page) {}

  /**
   * Navigates to the global documents dashboard page.
   */
  async goto(): Promise<void> {
    await this.page.goto("/dashboard/docs");
    await expect(
      this.page.getByRole("heading", { name: "Documents", exact: true }),
    ).toBeVisible();
  }

  /**
   * Uploads a document via the DocUploader wizard.
   * Handles the standalone page (with pet pick step) and the pet's
   * Documents sub-page (routing there first when the pet tool nav exists).
   */
  async uploadDoc(options: {
    fileName: string;
    fileContent?: string;
    mimeType?: string;
    category?: string;
    petNameOrId?: string;
  }): Promise<void> {
    const {
      fileName,
      fileContent = "Mock PDF content for test doc",
      mimeType = "application/pdf",
      category,
      petNameOrId,
    } = options;

    // From the pet hub: the uploader lives on the Documents tool sub-page.
    const petToolNav = this.page.getByRole("navigation", { name: "Pet tools" });
    if (await petToolNav.isVisible({ timeout: 1000 }).catch(() => false)) {
      await petToolNav.getByRole("link", { name: "Documents", exact: true }).click();
    }

    // Check if on pet pick step
    const petSelect = this.page.locator("select").filter({ hasText: /Select a pet/i });
    if (await petSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      if (petNameOrId) {
        await petSelect.selectOption({ label: petNameOrId });
      } else {
        // pick first available pet
        await petSelect.selectOption({ index: 1 });
      }
      await this.page.getByRole("button", { name: "Continue" }).click();
    }

    // Step 1: Capture / File Input
    // Step 1: Capture / File Input
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: fileName,
      mimeType,
      buffer: Buffer.from(fileContent),
    });

    const uploadRegion = this.page.getByRole("region", { name: "Upload" });
    const continueBtn = (await uploadRegion.isVisible().catch(() => false))
      ? uploadRegion.getByRole("button", { name: "Continue" })
      : this.page.getByRole("button", { name: "Continue" });

    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // Step 2: Details & Category
    await expect(
      this.page.getByRole("heading", { name: "Document details" }),
    ).toBeVisible();

    const detailsScope = (await uploadRegion.isVisible().catch(() => false))
      ? uploadRegion
      : this.page;

    if (category) {
      const categorySelect = detailsScope.locator("select").first();
      await categorySelect.selectOption(category);
    }

    const saveBtn = detailsScope.getByRole("button", { name: /Save to vault/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Step 3: Success Done step
    await expect(
      this.page.getByRole("heading", { name: "Saved to the vault" }),
    ).toBeVisible();
  }

  /**
   * Locates a document row by its name.
   */
  getDocItem(name: string): Locator {
    return this.page.locator("li").filter({ hasText: name }).first();
  }

  /**
   * Asserts a document with the given name is visible in the list.
   */
  async expectDocVisible(name: string): Promise<void> {
    await expect(this.getDocItem(name)).toBeVisible();
  }

  /**
   * Asserts a document with the given name is not visible in the list.
   */
  async expectDocNotVisible(name: string): Promise<void> {
    await expect(this.getDocItem(name)).not.toBeVisible();
  }

  /**
   * Clicks the Move to Trash button for a document and confirms the
   * destructive-action dialog.
   */
  async moveToTrash(docName: string): Promise<void> {
    const trashBtn = this.page.getByRole("button", {
      name: new RegExp(`Move .*${docName}.* to trash`, "i"),
    });
    await expect(trashBtn).toBeVisible();
    await trashBtn.click();

    // DocumentsPanel gates the instant trash behind a confirm dialog.
    const confirmBtn = this.page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Move to trash", exact: true });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await expect(this.getDocItem(docName)).not.toBeVisible();
  }

  /**
   * Filters the global documents list by pet tab button.
   */
  async filterByPet(petName: string): Promise<void> {
    const petFilterBtn = this.page
      .locator("div[role='group'][aria-label='Filter by pet']")
      .getByRole("button", { name: petName });
    await expect(petFilterBtn).toBeVisible();
    await petFilterBtn.click();
  }
}

export function createDocsLego(page: Page): DocsLego {
  return new DocsLego(page);
}
