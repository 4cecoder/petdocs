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
    email: "maya@demo.pet",
    button: /Maya · pet parent/,
    path: "/dashboard/pets",
    heading: "Pets",
    restrictedRoutes: [{ path: "/dashboard/admin", heading: "Internal only." }],
  },
  {
    label: "Sam · pet parent",
    email: "sam@demo.pet",
    button: /Sam · pet parent/,
    path: "/dashboard/pets",
    heading: "Pets",
    restrictedRoutes: [{ path: "/dashboard/admin", heading: "Internal only." }],
  },
  {
    label: "Auditor",
    email: "auditor@demo.pet",
    button: /^Auditor/,
    path: "/dashboard/admin",
    heading: "Product admin",
    restrictedSections: ["Recent owners", "Share link safety", "Team access", "Team inbox"],
    restrictedRoutes: [
      { path: "/dashboard/admin/mail", heading: "Internal only." },
      { path: "/dashboard/admin/integrations", heading: "Superadmin only." },
    ],
  },
  {
    label: "Support",
    email: "support@demo.pet",
    button: /^Support/,
    path: "/dashboard/admin",
    heading: "Product admin",
    sections: ["Recent owners", "Share link safety", "Team inbox"],
    restrictedSections: ["Team access"],
    allowedRoutes: [{ path: "/dashboard/admin/mail", heading: "Team inbox" }],
    restrictedRoutes: [{ path: "/dashboard/admin/integrations", heading: "Superadmin only." }],
  },
  {
    label: "Manager",
    email: "manager@demo.pet",
    button: /^Manager/,
    path: "/dashboard/admin",
    heading: "Product admin",
    sections: ["Recent owners", "Share link safety", "Team access", "Team inbox"],
    restrictedFields: ["Employee email"],
    allowedRoutes: [{ path: "/dashboard/admin/mail", heading: "Team inbox" }],
    restrictedRoutes: [{ path: "/dashboard/admin/integrations", heading: "Superadmin only." }],
  },
  {
    label: "Team owner",
    email: "owner@demo.pet",
    button: /^Team owner/,
    path: "/dashboard/admin",
    heading: "Product admin",
    sections: ["Recent owners", "Share link safety", "Team access", "Team inbox"],
    fields: ["Employee email"],
    allowedRoutes: [{ path: "/dashboard/admin/mail", heading: "Team inbox" }],
    restrictedRoutes: [{ path: "/dashboard/admin/integrations", heading: "Superadmin only." }],
  },
  {
    label: "Superadmin",
    email: "superadmin@demo.pet",
    button: /^Superadmin/,
    path: "/dashboard/admin/integrations",
    heading: "Integrations",
    sections: ["Resend", "Polar", "Convex", "Site", "Webhooks", "Test email"],
    allowedRoutes: [{ path: "/dashboard/admin", heading: "Product admin" }],
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
      await expect
        .poll(() => page.evaluate(() => window.localStorage.getItem("petdocs-owner")))
        .toBe(demo.email);

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

      for (const route of "allowedRoutes" in demo ? demo.allowedRoutes : []) {
        await page.goto(route.path);
        await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      }
      for (const route of "restrictedRoutes" in demo ? demo.restrictedRoutes : []) {
        await page.goto(route.path);
        await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      }
    });
  }
});
