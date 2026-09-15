import { expect, type Page } from "@playwright/test";

export class ShareLego {
  constructor(private page: Page) {}

  /**
   * Navigates to the share dashboard page.
   */
  async gotoDashboardShare(): Promise<void> {
    await this.page.goto("/dashboard/share");
    await expect(
      this.page.getByRole("heading", { name: "Shared links", exact: true }),
    ).toBeVisible();
  }

  /**
   * Generates a share link using the ShareButton 3-step wizard on a pet profile.
   * The wizard lives on the pet's /share sub-page, so when a pet tool
   * navigation is present we route there first.
   */
  async generateShareLink(options?: {
    recipient?: string;
    expiry?: "24h" | "7d" | "30d";
  }): Promise<{ token: string; shareUrl: string }> {
    const { recipient = "Boarder", expiry = "7d" } = options ?? {};

    // From the pet hub: the wizard is one hop away on the Share tool page.
    const petToolNav = this.page.getByRole("navigation", { name: "Pet tools" });
    if (await petToolNav.isVisible({ timeout: 1000 }).catch(() => false)) {
      await petToolNav.getByRole("link", { name: "Share", exact: true }).click();
    }

    // Step 0: Who
    const recipientInput = this.page.locator("#share-recipient");
    await expect(recipientInput).toBeVisible();
    await recipientInput.fill(recipient);

    const step0Scope = recipientInput.locator("..");
    await step0Scope.getByRole("button", { name: "Continue" }).click();

    // Step 1: Expiry
    const expiryLabel = expiry === "24h" ? "24 hours" : expiry === "30d" ? "30 days" : "7 days";
    const expiryRadio = this.page.getByRole("radio", { name: new RegExp(expiryLabel, "i") });
    await expect(expiryRadio).toBeVisible();
    await expiryRadio.click();

    await this.page.getByRole("button", { name: "Make link" }).click();

    // Step 2: Copy link
    const copyBtn = this.page.getByRole("button", { name: /Copy link|Copied/i });
    await expect(copyBtn).toBeVisible();

    const linkElem = this.page.locator("a[href*='/p/']").first();
    let shareUrl = "";
    let token = "";
    if (await linkElem.isVisible({ timeout: 2000 }).catch(() => false)) {
      shareUrl = (await linkElem.getAttribute("href")) || "";
      const match = shareUrl.match(/\/p\/([^/?#]+)/);
      token = match ? match[1] : "";
    }

    return { token, shareUrl };
  }

  /**
   * Navigates to a public passport page and verifies that it renders properly.
   */
  async verifyPublicPassportView(tokenOrUrl: string, _expectedPetName?: string): Promise<void> {
    const path = tokenOrUrl.startsWith("http")
      ? tokenOrUrl
      : tokenOrUrl.startsWith("/p/")
        ? tokenOrUrl
        : `/p/${tokenOrUrl}`;

    await this.page.goto(path);

    await expect(
      this.page.getByRole("heading", { name: /Shared pet profile/i }),
    ).toBeVisible();

    await expect(this.page.getByText(/petdocs passport/i).first()).toBeVisible();
  }

  /**
   * Revokes a share link on /dashboard/share.
   */
  async revokeShareLink(tokenOrLabel: string): Promise<void> {
    const linkRow = this.page.locator("li").filter({ hasText: tokenOrLabel }).first();
    await expect(linkRow).toBeVisible();

    const revokeBtn = linkRow.getByRole("button", { name: /Revoke/i });
    await expect(revokeBtn).toBeVisible();
    await revokeBtn.click();

    await expect(linkRow).not.toBeVisible();
  }

  /**
   * Verifies the Apartment Packet section is rendered on /dashboard/share.
   */
  async verifyApartmentPacket(expectedPetName?: string): Promise<void> {
    const section = this.page.getByRole("region", { name: "Apartment packet" });
    await expect(section).toBeVisible();
    if (expectedPetName) {
      await expect(section.getByRole("heading", { name: expectedPetName })).toBeVisible();
    }
    await expect(section.getByText(/Rental Resume|Vaccinations/i)).toBeVisible();
  }
}

export function createShareLego(page: Page): ShareLego {
  return new ShareLego(page);
}
