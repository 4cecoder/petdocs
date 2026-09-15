import { test } from "@playwright/test";
import { createAuthLego, createRemindersLego, setupConvexMock } from "../legos";

test.describe("Flow 05: Reminders and Due Schedules", () => {
  test("renders reminder schedule groups (Overdue, This week, Later)", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const reminders = createRemindersLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/reminders");
    await reminders.checkDueSoonList();
    await reminders.expectReminderVisible("FVRCP Booster Check");
  });

  test("creates a new custom reminder and displays it under schedule", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const reminders = createRemindersLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/reminders");

    await reminders.createReminder({
      title: "Heartworm Pill Administration",
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
      petName: "Miso",
    });

    await reminders.expectReminderVisible("Heartworm Pill Administration");
  });

  test("marks reminder as completed and removes it from pending view", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const reminders = createRemindersLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/reminders");
    await reminders.expectReminderVisible("FVRCP Booster Check");

    await reminders.markDone("FVRCP Booster Check");
    await reminders.expectReminderNotVisible("FVRCP Booster Check");
  });

  test("snoozes a reminder to dismiss it", async ({ page }) => {
    await setupConvexMock(page);
    const auth = createAuthLego(page);
    const reminders = createRemindersLego(page);

    await auth.directLogin("owner@petdocs.test", "owner-e2e-123", "/dashboard/reminders");
    await reminders.expectReminderVisible("FVRCP Booster Check");

    await reminders.markDismissed("FVRCP Booster Check");
    await reminders.expectReminderNotVisible("FVRCP Booster Check");
  });
});
