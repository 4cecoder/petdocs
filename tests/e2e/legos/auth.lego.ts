import { expect, type Page } from "@playwright/test";

export const EMAIL_KEY = "petdocs-owner";
export const ID_KEY = "petdocs-owner-id";

export class AuthLego {
  constructor(private page: Page) {}

  /**
   * Sets the owner email and ownerId in localStorage.
   * Mirrors `src/lib/api.ts` setSession.
   */
  async setSession(email: string, ownerId = "owner-e2e-123"): Promise<void> {
    await this.page.evaluate(
      ({ eKey, idKey, emailVal, idVal }) => {
        window.localStorage.setItem(eKey, emailVal);
        window.localStorage.setItem(idKey, idVal);
      },
      { eKey: EMAIL_KEY, idKey: ID_KEY, emailVal: email, idVal: ownerId },
    );
  }

  /**
   * Clears the session keys from localStorage.
   */
  async clearSession(): Promise<void> {
    await this.page.evaluate(
      ({ eKey, idKey }) => {
        window.localStorage.removeItem(eKey);
        window.localStorage.removeItem(idKey);
      },
      { eKey: EMAIL_KEY, idKey: ID_KEY },
    );
  }

  /**
   * Directly authenticates the user by writing localStorage before navigating
   * to the destination (defaulting to /dashboard).
   */
  async directLogin(
    email = "test@petdocs.test",
    ownerId = "owner-e2e-123",
    targetPath = "/dashboard",
  ): Promise<void> {
    await this.page.goto("/sign-in");
    await this.setSession(email, ownerId);
    await this.page.goto(targetPath);
  }

  async directSignIn(email: string): Promise<void> {
    await this.page.goto("/sign-in");
    const emailInput = this.page.getByRole("textbox", { name: /email/i });
    await expect(emailInput).toBeVisible();
    await emailInput.fill(email);
    await this.page.getByRole("button", { name: /Continue to Dashboard/i }).click();
  }

  /**
   * Fills the magic link email input on /sign-in and clicks "Email me a magic link instead".
   */
  async requestMagicLink(email: string): Promise<void> {
    await this.page.goto("/sign-in");
    const emailInput = this.page.getByRole("textbox", { name: /email/i });
    await expect(emailInput).toBeVisible();
    await emailInput.fill(email);
    await this.page.getByRole("button", { name: /magic link/i }).click();
  }

  /**
   * Complete sign-in flow via the UI (using a direct link if presented, or mock token).
   */
  async signIn(email: string): Promise<void> {
    await this.requestMagicLink(email);
    // If dev direct-link is shown, follow it to complete verification
    const directLink = this.page.getByRole("link", { name: /http:\/\/.*\/sign-in\?email=/i });
    if (await directLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await directLink.click();
    }
  }

  /**
   * Clicks the "Sign out" button in the dashboard layout and verifies redirection.
   */
  async signOut(): Promise<void> {
    const signOutBtn = this.page.getByRole("button", { name: /sign out/i });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();
    await expect(this.page).toHaveURL(/\/(#.*)?$/);
    await this.clearSession();
  }

  /**
   * Asserts the user is authenticated in the dashboard shell.
   */
  async expectAuthenticated(): Promise<void> {
    await expect(this.page.getByRole("button", { name: /sign out/i })).toBeVisible();
  }

  /**
   * Asserts the user is unauthenticated (redirected to /sign-in or shows sign-in heading).
   */
  async expectUnauthenticated(): Promise<void> {
    await expect(this.page).toHaveURL(/\/sign-in/);
    await expect(
      this.page.getByRole("heading", { name: "Welcome to petdocs" }),
    ).toBeVisible();
  }
}

export function createAuthLego(page: Page): AuthLego {
  return new AuthLego(page);
}
