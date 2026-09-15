import { expect, type Locator, type Page } from "@playwright/test";

export type NavTab = "Home" | "Pets" | "Docs" | "Records" | "Reminders" | "Share" | "Settings";

export class NavLego {
  constructor(private page: Page) {}

  /**
   * Hides Next.js dev overlay that sits on the bottom-left corner of the viewport.
   */
  async hideDevOverlay(): Promise<void> {
    await this.page
      .addStyleTag({
        content: "nextjs-portal, [data-nextjs-dev-overlay] { display: none !important; pointer-events: none !important; }",
      })
      .catch(() => {});
  }

  /**
   * Sets viewport to standard mobile device dimensions (e.g. 390x844).
   */
  async setMobileViewport(width = 390, height = 844): Promise<void> {
    await this.page.setViewportSize({ width, height });
    await this.hideDevOverlay();
  }

  /**
   * Returns the mobile bottom navigation bar locator.
   */
  getMobileNav(): Locator {
    return this.page.locator("nav[aria-label='Mobile Navigation']");
  }

  /**
   * Returns desktop sidebar nav locator.
   */
  getDesktopNav(): Locator {
    return this.page.locator("nav[aria-label='Dashboard']");
  }

  /**
   * Locates a tab link in the mobile bottom bar.
   * Maps "Docs" -> "Records" since mobile bottom bar uses "Records".
   */
  getTabLink(tab: NavTab): Locator {
    const label = tab === "Docs" ? "Records" : tab;
    return this.getMobileNav().getByRole("link", { name: label, exact: true });
  }

  /**
   * Clicks a tab in the mobile bottom navigation bar and waits for navigation.
   */
  async navigateTo(tab: NavTab): Promise<void> {
    await this.hideDevOverlay();
    const link = this.getTabLink(tab);
    await expect(link).toBeVisible();
    await link.click();

    const expectedRegex =
      tab === "Home"
        ? /\/dashboard(?:\?.*)?$/
        : tab === "Records" || tab === "Docs"
          ? /\/dashboard\/docs(?:\?.*)?$/
          : new RegExp(`/dashboard/${tab.toLowerCase()}(?:\\?.*)?$`);

    await expect(this.page).toHaveURL(expectedRegex);
  }

  /**
   * Asserts that the specified tab has the active `aria-current="page"` attribute.
   */
  async expectActiveTab(tab: NavTab): Promise<void> {
    const link = this.getTabLink(tab);
    await expect(link).toHaveAttribute("aria-current", "page");
  }
}

export function createNavLego(page: Page): NavLego {
  return new NavLego(page);
}
