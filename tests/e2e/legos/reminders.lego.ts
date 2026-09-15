import { expect, type Locator, type Page } from "@playwright/test";

export class RemindersLego {
  constructor(private page: Page) {}

  /**
   * Navigates to the reminders dashboard page.
   */
  async goto(): Promise<void> {
    await this.page.goto("/dashboard/reminders");
    await expect(
      this.page.getByRole("heading", { name: "Reminders", exact: true }),
    ).toBeVisible();
  }

  /**
   * Opens the "+ Reminder" form.
   */
  async openAddReminderForm(): Promise<void> {
    const addBtn = this.page.getByRole("button", { name: /\+ Reminder/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await expect(this.page.getByPlaceholder("Annual checkup")).toBeVisible();
  }

  /**
   * Creates a new reminder.
   */
  async createReminder(options: {
    title: string;
    dueDate?: string; // YYYY-MM-DD
    petName?: string;
  }): Promise<void> {
    const { title, dueDate = new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0], petName } = options;

    await this.openAddReminderForm();

    const titleInput = this.page.getByPlaceholder("Annual checkup");
    await titleInput.fill(title);

    const dateInput = this.page.locator('input[type="date"]');
    await dateInput.fill(dueDate);

    if (petName) {
      const petSelect = this.page.locator("select");
      await petSelect.selectOption({ label: petName });
    }

    const submitBtn = this.page.getByRole("button", { name: /Add reminder/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
  }

  /**
   * Locates a reminder row by title.
   */
  getReminderRow(title: string): Locator {
    return this.page.locator("li").filter({ hasText: title }).first();
  }

  /**
   * Asserts a reminder row is visible.
   */
  async expectReminderVisible(title: string): Promise<void> {
    await expect(this.getReminderRow(title)).toBeVisible();
  }

  /**
   * Asserts a reminder row is not visible.
   */
  async expectReminderNotVisible(title: string): Promise<void> {
    await expect(this.getReminderRow(title)).not.toBeVisible();
  }

  /**
   * Marks a reminder as done by clicking its check button.
   */
  async markDone(title: string): Promise<void> {
    const doneBtn = this.page.getByRole("button", {
      name: new RegExp(`Mark done: .*${title}`, "i"),
    });
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await expect(this.getReminderRow(title)).not.toBeVisible();
  }

  /**
   * Snoozes / dismisses a reminder.
   */
  async markDismissed(title: string): Promise<void> {
    const row = this.getReminderRow(title);
    await expect(row).toBeVisible();
    const snoozeBtn = row.getByRole("button", { name: "Snooze" });
    await expect(snoozeBtn).toBeVisible();
    await snoozeBtn.click();
    await expect(this.getReminderRow(title)).not.toBeVisible();
  }

  /**
   * Verifies the 3 reminder schedule groups (Overdue, This week, Later) are present.
   */
  async checkDueSoonList(): Promise<void> {
    await expect(this.page.getByRole("region", { name: "Overdue" })).toBeVisible();
    await expect(this.page.getByRole("region", { name: "This week" })).toBeVisible();
    await expect(this.page.getByRole("region", { name: "Later" })).toBeVisible();
  }
}

export function createRemindersLego(page: Page): RemindersLego {
  return new RemindersLego(page);
}
