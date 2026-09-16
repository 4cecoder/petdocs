import { expect, type Locator, type Page } from "@playwright/test";

export class DocsLego {
  constructor(private page: Page) {}

  /** Opens the nested Documents tool when starting from a pet overview. */
  private async openPetDocuments(): Promise<void> {
    const petToolNav = this.page.getByRole("navigation", { name: "Pet tools" });
    try {
      await expect(petToolNav).toBeVisible({ timeout: 15_000 });
    } catch {
      return;
    }

    const documentsLink = petToolNav.getByRole("link", { name: "Documents", exact: true });
    const href = await documentsLink.getAttribute("href");
    if (!href) throw new Error("Pet Documents link did not expose a route.");
    // A direct navigation is deterministic while the dev server is compiling
    // several nested route bundles in parallel; the link's href is still the
    // product-owned route under test.
    await this.page.goto(href);
    await expect(this.page).toHaveURL(/\/dashboard\/pets\/[^/]+\/documents$/);
  }

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
    await this.openPetDocuments();

    // Check if on pet pick step. The UI kit exposes this as an accessible
    // combobox/listbox rather than a native select element.
    const petSelect = this.page.getByRole("combobox", { name: "Pet" });
    let hasPetSelect = false;
    try {
      await expect(petSelect).toBeVisible({ timeout: 1_000 });
      hasPetSelect = true;
    } catch {
      // A pet-specific route starts directly at the capture step.
    }
    if (hasPetSelect) {
      await petSelect.click();
      const petOption = petNameOrId
        ? this.page.getByRole("option", { name: new RegExp(petNameOrId, "i") })
        : this.page.getByRole("option").first();
      await petOption.click();
      await this.page.getByRole("button", { name: "Continue" }).click();
    }

    // Step 1: Capture / File Input
    const fileInput = this.page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached({ timeout: 15_000 });
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
      const categorySelect = detailsScope.getByRole("combobox", {
        name: "Document type",
      });
      await categorySelect.click();
      await this.page
        .getByRole("option", { name: category.replace(/_/g, " "), exact: true })
        .click();
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
    // The overview shows documents in the timeline, but trash controls live
    // on the nested Documents tool page.
    await this.openPetDocuments();

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
