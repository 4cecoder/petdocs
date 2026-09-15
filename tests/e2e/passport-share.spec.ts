import { expect, test } from "@playwright/test";
import {
  addPetViaUi,
  archivePetViaHttp,
  devConvexUrl,
  signUpViaUi,
  uniqueEmail,
} from "./helpers";

/**
 * #39 — Email a pet passport from the dashboard share tool:
 *   owner form (recipient + note) -> passportShare:emailPassport action
 *   -> creates/reuses a share token -> Resend send attempt -> send recorded
 *   in the Email history -> hosted QR route serves the link's QR.
 *
 * Send mocking: the Resend call happens INSIDE the Convex action, so it
 * cannot be Playwright-mocked (route mocking only covers browser traffic).
 * The spec therefore asserts the honest outcome either way: when the dev
 * deployment's Resend daily quota is exhausted (or keys unset), the send is
 * recorded as "failed" with Resend's error and the link STILL exists.
 * Real-send delivery verification remains pending (noted in the PR).
 */
test.describe("share: email passport (#39)", () => {
  test("email form sends, history records, QR route serves SVG", async ({
    page,
  }) => {
    const { ownerId } = await signUpViaUi(page, "pssem");
    const name = `Pepper${Date.now().toString(36)}`;
    const petId = await addPetViaUi(page, { name, species: "dog", breed: "E2E Beagle" });
    const recipient = uniqueEmail("psrecipient");
    await page.goto("/dashboard/share");

    // --- Email a passport form ---
    const form = page.getByRole("region", { name: "Email a passport" });
    await expect(form.getByLabel("Pet")).toBeVisible();
    await form.getByLabel("Recipient email").fill(recipient);
    await form.getByLabel(/Note/).fill("For the Friday checkup");
    await form.getByRole("button", { name: "Send passport email" }).click();

    // Action resolves with an honest result: delivered, or failed-with-error
    // (quota exhausted / Resend unconfigured). Either way the link exists.
    const status = page.getByRole("status").filter({ hasText: /Sent!|go out/ });
    await expect(status).toBeVisible({ timeout: 30_000 });
    const delivered = (await status.textContent())?.includes("Sent!") ?? false;

    // --- Email history records the attempt ---
    const history = page.getByRole("region", { name: "Email history" });
    await expect(history.getByText(recipient)).toBeVisible({ timeout: 15_000 });
    await expect(
      history.getByText(delivered ? "Sent" : "Failed", { exact: true }),
    ).toBeVisible();
    if (!delivered) {
      await expect(
        history.getByText(/Resend|email/i).first(),
      ).toBeVisible();
    }

    // --- The created/reused link is live in the Active share links list ---
    const linksSection = page.getByRole("region", { name: "Active share links" });
    const linkAnchor = linksSection.getByRole("link", {
      name: /\/p\/[0-9a-f]{8}/,
    });
    await expect(linkAnchor).toBeVisible({ timeout: 15_000 });
    const href = await linkAnchor.getAttribute("href");
    if (!href || !href.startsWith("/p/")) {
      throw new Error(`unexpected passport href: ${href}`);
    }
    const token = href.slice("/p/".length);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    await expect(linksSection.getByText("Email to")).toBeVisible();

    // --- Hosted QR route (#39): live token -> SVG image ---
    const convexSite = devConvexUrl().replace(".convex.cloud", ".convex.site");
    const qr = await page.request.get(
      `${convexSite}/api/passport/${token}/qr.svg`,
    );
    expect(qr.status()).toBe(200);
    expect(qr.headers()["content-type"]).toContain("image/svg+xml");
    const svg = await qr.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");

    // Bogus and malformed tokens must not render a QR.
    expect(
      (await page.request.get(`${convexSite}/api/passport/${"f".repeat(64)}/qr.svg`)).status(),
    ).toBe(404);
    expect(
      (await page.request.get(`${convexSite}/api/passport/nope/qr.svg`)).status(),
    ).toBe(404);

    // --- The emailed link works logged out (brand-new context) ---
    const publicContext = await page.context().browser()!.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(new URL(href, page.url()).toString());
    await expect(
      publicPage.getByRole("heading", { level: 1, name }),
    ).toHaveText(name, { timeout: 20_000 });
    await publicContext.close();

    // Best-effort cleanup (never affects results).
    await archivePetViaHttp(ownerId, petId);
  });

  test("invalid recipient email is rejected client-side without a send", async ({
    page,
  }) => {
    await signUpViaUi(page, "psinvalid");
    await addPetViaUi(page, {
      name: `Truffle${Date.now().toString(36)}`,
      species: "cat",
    });
    await page.goto("/dashboard/share");

    const form = page.getByRole("region", { name: "Email a passport" });
    // type="email" input: the browser blocks submit for malformed addresses.
    await form.getByLabel("Recipient email").fill("not-an-email");
    await form.getByRole("button", { name: "Send passport email" }).click();

    const history = page.getByRole("region", { name: "Email history" });
    await expect(history.getByText("No passport emails yet.")).toBeVisible({
      timeout: 15_000,
    });
  });
});
