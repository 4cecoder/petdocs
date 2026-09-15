import { expect, test } from "@playwright/test";
import {
  expectSignedIn,
  formAlert,
  getOwnerId,
  getSessionEmail,
  magicTokenRow,
  randomToken,
  requestMagicLinkViaUi,
  signUpViaUi,
  storeExpiredMagicToken,
  uniqueEmail,
} from "./helpers";

/**
 * REAL signup e2e against the dev Convex deployment.
 *
 * Token recovery mechanism: the sign-in form's requestMagicLink action
 * returns a previewUrl in dev (the client origin is localhost-allowlisted,
 * convex/magicLink.ts resolveBaseUrl), which the page renders as the
 * "Direct Sign-In Link" panel (src/app/sign-in/page.tsx). The database only
 * ever stores the SHA-256 hash of the token, so that panel is the sole
 * source of the raw token; the `bunx convex run
 * magicLink:latestTokenForEmail` CLI round-trip is used in addition to
 * assert DB-level row state (minted, unexpired, single-use consumed).
 *
 * Cooldown safety: every test mints a unique email, and no test submits the
 * sign-in form twice for the same email (60s per-email resend cooldown,
 * convex/magicLink.ts RESEND_COOLDOWN_MS).
 *
 * KNOWN PRODUCT BUG (documented, do not weaken these tests): a public
 * `magicLink:directSignIn` mutation (convex/magicLink.ts:338) lets ANY
 * email sign in without proving mailbox ownership. sign-in/page.tsx wires
 * it as (a) the "Continue to Dashboard (Instant Access)" button, (b) a
 * fallback on invalid/used/expired token verify, and (c) a fallback on
 * verify exceptions; DashboardGuard.tsx:59 also self-heals sessions with
 * it. The three negative tests below are marked test.fail(): they document
 * the regression while keeping the suite green. The moment the bypass is
 * removed they will PASS, Playwright will report them as unexpected passes,
 * and the test.fail() calls must be deleted.
 */
const DIRECT_SIGN_IN_BUG =
  "BUG: magicLink:directSignIn (convex/magicLink.ts:338) bypasses mailbox " +
  "ownership; sign-in/page.tsx falls back to it for invalid/used/expired " +
  "tokens, so the strict negative assertions below cannot pass. Remove " +
  "test.fail() when the bypass is removed.";

test.describe("auth: real magic-link signup", () => {
  test("signup through the product flow lands in the authenticated dashboard", async ({
    page,
  }) => {
    const email = uniqueEmail("auth");
    const { token, url } = await requestMagicLinkViaUi(page, email);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(new URL(url).pathname).toBe("/sign-in");
    expect(new URL(url).searchParams.get("email")).toBe(email);

    // DB round-trip through the Convex CLI: the minted row exists, live.
    const row = magicTokenRow(email);
    expect(row, "magicTokens row must exist after requestMagicLink").not.toBeNull();
    expect(row!.expiresAt).toBeGreaterThan(Date.now());
    expect(row!.usedAt).toBeUndefined();

    // Verify through the UI exactly like a real user (single use).
    await page.getByRole("link", { name: /Sign in directly/ }).click();
    await page.waitForURL("**/dashboard", { timeout: 20_000 });
    await expectSignedIn(page);
    expect(await getSessionEmail(page)).toBe(email);
    expect(await getOwnerId(page)).toMatch(/^[a-z0-9]+$/);

    // Consumption is visible at the DB level too.
    const consumed = magicTokenRow(email);
    expect(consumed!.usedAt).toBeGreaterThan(0);
  });

  test("invalid token stays on sign-in with an error", {
    annotation: [{ type: "issue", description: DIRECT_SIGN_IN_BUG }],
  }, async ({ page }) => {
    test.fail(true, DIRECT_SIGN_IN_BUG);
    const email = uniqueEmail("auth-badtoken");
    await page.goto(
      `/sign-in?token=${randomToken()}&email=${encodeURIComponent(email)}`,
    );

    const alert = formAlert(page);
    await expect(alert).toContainText("This sign-in link is invalid.", {
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/sign-in\?token=/);
    expect(await getOwnerId(page)).toBeNull();

    // Recovery path stays available: form intact, email prefilled.
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(email);
    await expect(page.getByRole("button", { name: /magic link/ })).toBeEnabled();
  });

  test("expired token shows the expired error", {
    annotation: [{ type: "issue", description: DIRECT_SIGN_IN_BUG }],
  }, async ({ page }) => {
    test.fail(true, DIRECT_SIGN_IN_BUG);
    // Seed a genuinely expired row through the dev CLI (internalMutation
    // magicLink:storeToken with a past expiresAt; no convex code changed).
    const email = uniqueEmail("auth-expired");
    const token = storeExpiredMagicToken(email);
    expect(magicTokenRow(email)!.expiresAt).toBeLessThan(Date.now());

    await page.goto(
      `/sign-in?token=${token}&email=${encodeURIComponent(email)}`,
    );
    await expect(formAlert(page)).toContainText(
      "Link expired. Request a new one.",
      { timeout: 15_000 },
    );
    expect(await getOwnerId(page)).toBeNull();
  });

  test("magic links are single-use", {
    annotation: [{ type: "issue", description: DIRECT_SIGN_IN_BUG }],
  }, async ({ page }) => {
    test.fail(true, DIRECT_SIGN_IN_BUG);
    const { email, token, ownerId } = await signUpViaUi(page, "auth-reuse");
    expect(ownerId).toMatch(/^[a-z0-9]+$/);

    // Re-visit the exact same link: the token was already consumed.
    await page.goto(`/sign-in?token=${token}&email=${encodeURIComponent(email)}`);
    await expect(formAlert(page)).toContainText("already been used", {
      timeout: 15_000,
    });
    // The existing session is untouched; reuse must not mint a new owner.
    expect(await getOwnerId(page)).toBe(ownerId);
  });
});
