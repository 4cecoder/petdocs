import { expect, test } from "@playwright/test";
import { setupConvexMock } from "../legos";

/**
 * Local demo access is a UI entry point, so every seeded button needs a
 * browser-level regression. This suite deliberately uses setupConvexMock:
 * demo login must not spend Resend quota or touch a Convex deployment.
 */
const demoCases = [
  {
    label: "Maya · pet parent",
    button: /Maya · pet parent/,
    path: "/dashboard/pets",
    heading: "Pets",
  },
  {
    label: "Sam · pet parent",
    button: /Sam · pet parent/,
    path: "/dashboard/pets",
    heading: "Pets",
  },
  {
    label: "Auditor",
    button: /^Auditor/,
    path: "/dashboard/admin",
    heading: "Product admin",
    restrictedSections: ["Recent owners", "Share link safety", "Team access", "Team inbox"],
  },
  {
    label: "Support",
    button: /^Support/,
    path: "/dashboard/admin",
    heading: "Product admin",
    sections: ["Recent owners", "Share link safety", "Team inbox"],
    restrictedSections: ["Team access"],
  },
  {
    label: "Manager",
    button: /^Manager/,
    path: "/dashboard/admin",
    heading: "Product admin",
    sections: ["Recent owners", "Share link safety", "Team access", "Team inbox"],
    restrictedFields: ["Employee email"],
  },
  {
    label: "Team owner",
    button: /^Team owner/,
    path: "/dashboard/admin",
    heading: "Product admin",
    sections: ["Recent owners", "Share link safety", "Team access", "Team inbox"],
    fields: ["Employee email"],
  },
  {
    label: "Superadmin",
    button: /^Superadmin/,
    path: "/dashboard/admin/integrations",
    heading: "Integrations",
    sections: ["Resend", "Polar", "Convex", "Site", "Webhooks", "Test email"],
  },
] as const;

test.describe("local demo access role matrix", () => {
  for (const demo of demoCases) {
    test(`${demo.label} opens the intended local workspace`, { tag: "@smoke" }, async ({ page }) => {
      await setupConvexMock(page);

      await page.goto("/sign-in");
      await expect(
        page.getByRole("heading", { name: "Local demo access" }),
      ).toBeVisible();

      await page.getByRole("button", { name: demo.button }).click();
      await page.waitForURL(`**${demo.path}`, { timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByRole("heading", { name: demo.heading })).toBeVisible();

      for (const section of "sections" in demo ? demo.sections : []) {
        await expect(page.getByRole("heading", { name: section })).toBeVisible();
      }
      for (const section of "restrictedSections" in demo ? demo.restrictedSections : []) {
        await expect(page.getByText(section, { exact: true })).toHaveCount(0);
      }
      for (const field of "fields" in demo ? demo.fields : []) {
        await expect(page.getByRole("textbox", { name: field })).toBeVisible();
      }
      for (const field of "restrictedFields" in demo ? demo.restrictedFields : []) {
        await expect(page.getByRole("textbox", { name: field })).toHaveCount(0);
      }
    });
  }
});
