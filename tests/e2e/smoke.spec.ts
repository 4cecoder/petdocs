import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("home renders hero", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Own your pet's docs" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Get started/i }),
    ).toBeVisible();
  });

  test("pricing renders tiers", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/pricing");
    await expect(
      page.getByRole("heading", { name: "Simple pricing" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Free" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plus" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Family" })).toBeVisible();
  });

  test("how-it-works renders 4 steps", { tag: "@smoke" }, async ({
    page,
  }) => {
    await page.goto("/how-it-works");
    await expect(
      page.getByRole("heading", { name: "How it works" }),
    ).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(4);
  });

  test("dashboard redirects to sign-in when unauthenticated", {
    tag: "@smoke",
  }, async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("public passport renders", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/p/demo-token");
    await expect(
      page.getByRole("heading", { name: "Shared pet profile" }),
    ).toBeVisible();
  });

  test("404 renders trail message", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/nope-not-real");
    await expect(
      page.getByRole("heading", { name: "This trail went cold" }),
    ).toBeVisible();
  });

  test("legal terms renders", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(
      page.getByRole("heading", { name: "Terms of Service" }),
    ).toBeVisible();
  });

  test("legal privacy renders", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" }),
    ).toBeVisible();
  });

  test("legal refunds renders", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/legal/refunds");
    await expect(
      page.getByRole("heading", { name: "Refund Policy" }),
    ).toBeVisible();
  });

  test("sign-in renders email form", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { name: "Welcome to petdocs" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /email/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send magic link/i }),
    ).toBeVisible();
  });

  test("onboarding renders step 1", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: "Add your first pet" }),
    ).toBeVisible();
  });

  test("dashboard share redirects to sign-in when unauthenticated", {
    tag: "@smoke",
  }, async ({ page }) => {
    await page.goto("/dashboard/share");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
