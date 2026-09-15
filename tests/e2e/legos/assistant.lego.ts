import { expect, type Locator, type Page } from "@playwright/test";

export class AssistantLego {
  constructor(private page: Page) {}

  /**
   * Returns the floating action button (FAB) for the PetDocs assistant.
   */
  getFab(): Locator {
    return this.page.getByRole("button", { name: /Get help/i });
  }

  /**
   * Returns the assistant drawer dialog.
   */
  getDrawer(): Locator {
    return this.page.getByRole("dialog", { name: "PetDocs help" });
  }

  /**
   * Toggles the PetAssistant FAB button.
   */
  async toggleFab(): Promise<void> {
    const fab = this.getFab();
    await expect(fab).toBeVisible();
    await fab.click();
  }

  /**
   * Asserts the drawer is open and visible.
   */
  async expectDrawerOpen(): Promise<void> {
    await expect(this.getDrawer()).toBeVisible();
    await expect(this.page.getByRole("textbox", { name: "Ask a question" })).toBeVisible();
  }

  /**
   * Asserts the drawer is closed / not visible.
   */
  async expectDrawerClosed(): Promise<void> {
    await expect(this.getDrawer()).not.toBeVisible();
  }

  /**
   * Closes the assistant drawer using the close button.
   */
  async closeDrawer(): Promise<void> {
    const closeBtn = this.page.getByRole("button", { name: "Close help" });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await this.expectDrawerClosed();
  }

  /**
   * Types a question into the assistant input and clicks Send.
   */
  async askQuestion(question: string): Promise<void> {
    const input = this.page.getByRole("textbox", { name: "Ask a question" });
    await expect(input).toBeVisible();
    await input.fill(question);
    await this.page.getByRole("button", { name: "Send" }).click();
  }

  /**
   * Clicks one of the quick chip suggestion buttons (e.g. "Price", "Share", "Reminders").
   */
  async clickQuickChip(chipLabel: "Price" | "Apartment" | "Share" | "Reminders" | string): Promise<void> {
    const chip = this.getDrawer().getByRole("button", { name: chipLabel, exact: true });
    await expect(chip).toBeVisible();
    await chip.click();
  }

  /**
   * Asserts that a bot response containing the given text or regex is rendered in the chat log.
   */
  async expectResponseContaining(textOrRegex: string | RegExp): Promise<void> {
    const log = this.getDrawer().getByRole("log");
    await expect(log).toBeVisible();
    if (typeof textOrRegex === "string") {
      await expect(log.getByText(new RegExp(textOrRegex, "i"))).toBeVisible();
    } else {
      await expect(log.getByText(textOrRegex)).toBeVisible();
    }
  }
}

export function createAssistantLego(page: Page): AssistantLego {
  return new AssistantLego(page);
}
