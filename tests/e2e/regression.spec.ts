import { expect, test } from "@playwright/test";
import {
  addPetViaUi,
  archivePetViaHttp,
  devConvexUrl,
  formAlert,
  getOwnerId,
  magicTokenRow,
  randomToken,
  requestMagicLinkViaUi,
  signUpViaUi,
  storeExpiredMagicToken,
  uniqueEmail,
} from "./helpers";

/**
 * Regression layer (Issue #27): fixed bugs get a permanent test here so
 * they never come back.
 *
 * Status legend:
 *   - Green tests  : the guard already exists on main; these pin it.
 *   - Fixed bugs   : tests written while a bug was still open are flipped
 *                    to plain (passing) assertions the moment the fix
 *                    lands; the bug reference stays in the annotation for
 *                    history. Never delete a regression test itself.
 *
 * Backend-exercising specs drive the REAL dev deployment through the
 * running Next server, exactly like tests/e2e/helpers.ts documents:
 * unique per-test emails (60s resend cooldown can never trigger), Convex
 * CLI/HTTP calls guarded to the dev:* deployment from .env.local, and the
 * dev-only Direct Sign-In Link panel as the only source of the raw token.
 */

/**
 * FIXED in #30 (sec/auth-hardening): magicLink:directSignIn (convex/
 * magicLink.ts) used to bypass mailbox ownership and sign-in/page.tsx
 * fell back to it for invalid/used/expired tokens. The bypass is gone
 * and single-use verification is enforced, so these strict negative
 * assertions run as ordinary (passing) regression guards now.
 */
const DIRECT_SIGN_IN_FIXED =
  "FIXED (#17/#18, via #30): magic-link tokens are single-use, expire " +
  "honestly, and are scoped to the email that requested them. Kept as a " +
  "permanent regression guard.";

// ---------------------------------------------------------------------------
// Public Convex HTTP API helpers (same wire format the product client uses)
// ---------------------------------------------------------------------------

interface ConvexErrorBody {
  status?: string;
  value?: unknown;
  errorMessage?: string;
}

const IS_NETWORK_ERROR = /fetch failed|abort|timeout|network|econn|und_err|terminated|closed/i;

/**
 * Retry transport-level failures only (undici can throw "fetch failed"
 * when the full suite hammers the dev deployment concurrently). App-level
 * errors (parsed backend responses) propagate immediately.
 */
async function withNetworkRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      // Never retry app-level errors; only genuine transport failures.
      const isAppError = /^(convex |REGRESSION:)/.test(message);
      if (isAppError || !IS_NETWORK_ERROR.test(message)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function convexFetch(
  kind: "query" | "mutation",
  path: string,
  args: Record<string, unknown>,
): Promise<{ res: Response; body: ConvexErrorBody | null }> {
  return withNetworkRetry(async () => {
    const res = await fetch(`${devConvexUrl()}/api/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as ConvexErrorBody | null;
    return { res, body };
  });
}

/** Run one public query/mutation; resolve the value or throw the message. */
async function convexCall<T>(
  kind: "query" | "mutation",
  path: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { res, body } = await convexFetch(kind, path, args);
  if (body && body.status === "success") return body.value as T;
  throw new Error(
    `convex ${kind} ${path} failed: ${(body?.errorMessage ?? `HTTP ${res.status}`).slice(0, 400)}`,
  );
}

/**
 * Run one public query/mutation that is EXPECTED to fail its ownership
 * guard; resolve the backend error message. Throws if the call succeeds,
 * which would mean a guard regressed.
 */
async function convexCallMustFail(
  kind: "query" | "mutation",
  path: string,
  args: Record<string, unknown>,
): Promise<string> {
  const { res, body } = await convexFetch(kind, path, args);
  if (body && body.status === "success") {
    throw new Error(
      `REGRESSION: convex ${kind} ${path} succeeded but its ownership guard should reject it`,
    );
  }
  return (body?.errorMessage ?? `HTTP ${res.status}`).slice(0, 400);
}

function uniqueName(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${randomToken().slice(0, 6)}`;
}

// ---------------------------------------------------------------------------
// (a) (b) (c) magic-link negatives
// ---------------------------------------------------------------------------

test.describe("regression: magic-link negatives", () => {
  test("a used magic link shows an honest error and never grants access", {
    annotation: [{ type: "issue", description: DIRECT_SIGN_IN_FIXED }],
  }, async ({ page }) => {
    const { email, token, ownerId } = await signUpViaUi(page, "regr-reuse");
    expect(ownerId).toMatch(/^[a-z0-9]+$/);
    const firstUse = magicTokenRow(email);
    expect(firstUse!.usedAt).toBeGreaterThan(0);
    const usedAtFirstUse = firstUse!.usedAt!;

    // Re-visit the exact same link: the token was consumed at sign-up.
    await page.goto(`/sign-in?token=${token}&email=${encodeURIComponent(email)}`);

    // Honest error in the form alert (the fallback would redirect to the
    // dashboard instead and never render this).
    await expect(formAlert(page)).toContainText("already been used", {
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/sign-in\?token=/);
    expect(await getOwnerId(page)).toBe(ownerId);

    // DB level: the row keeps its original consumption time; reuse must
    // never re-mint or re-consume anything.
    const after = magicTokenRow(email);
    expect(after!.usedAt).toBe(usedAtFirstUse);
  });

  test("an expired magic link is rejected", {
    annotation: [{ type: "issue", description: DIRECT_SIGN_IN_FIXED }],
  }, async ({ page }) => {
    // Seed a genuinely expired row via the dev CLI (no convex code changed).
    const email = uniqueEmail("regr-expired");
    const token = storeExpiredMagicToken(email);
    expect(magicTokenRow(email)!.expiresAt).toBeLessThan(Date.now());

    await page.goto(`/sign-in?token=${token}&email=${encodeURIComponent(email)}`);
    await expect(formAlert(page)).toContainText(
      "Link expired. Request a new one.",
      { timeout: 15_000 },
    );
    await expect(page).toHaveURL(/\/sign-in\?token=/);
    // Fresh browser context: no session may have been minted.
    expect(await getOwnerId(page)).toBeNull();
  });

  test("a magic link is rejected when opened with a different email", {
    annotation: [{ type: "issue", description: DIRECT_SIGN_IN_FIXED }],
  }, async ({ page }) => {
    // Mint a real token for email A, but do NOT click its link.
    const { email, token } = await requestMagicLinkViaUi(
      page,
      uniqueEmail("regr-wrongemail-a"),
    );
    expect(magicTokenRow(email)!.usedAt).toBeUndefined();

    // Try to consume it as email B. verifyMagicLink scopes the lookup by
    // email, so this must be an invalid link, never a sign-in as B.
    const other = uniqueEmail("regr-wrongemail-b");
    await page.goto(
      `/sign-in?token=${token}&email=${encodeURIComponent(other)}`,
    );
    await expect(formAlert(page)).toContainText(
      "This sign-in link is invalid.",
      { timeout: 15_000 },
    );
    expect(await getOwnerId(page)).toBeNull();
    // The real token row stays unconsumed (nobody proved ownership of A).
    expect(magicTokenRow(email)!.usedAt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// (d) authz spot-checks: ownership.ts + shareLinks
// ---------------------------------------------------------------------------

test.describe("regression: authorization spot-checks", () => {
  // Two full signups + wizard + ~10 backend round-trips against the shared
  // dev deployment; 60s default is not enough when workers run in parallel.
  test.setTimeout(120_000);
  /**
   * Two real accounts, one pet each, driven end to end. A share capability
   * for pet A must resolve pet A only, and owner B must be unable to mint,
   * revoke, archive, or transfer anything owned by owner A (and vice
   * versa). All backend calls go through the same public HTTP API the
   * product client uses, so these are true e2e authz assertions.
   */
  test("share token resolves only its own pet; cross-owner writes are refused", async ({
    page,
  }) => {
    // Owner A + pet A through the real UI.
    const sessionA = await signUpViaUi(page, "regr-authz-a");
    const nameA = uniqueName("Rex");
    const petAId = await addPetViaUi(page, { name: nameA, species: "dog" });

    // Owner B + pet B in a separate logged-in context.
    const contextB = await page.context().browser()!.newContext();
    const pageB = await contextB.newPage();
    const sessionB = await signUpViaUi(pageB, "regr-authz-b");
    const nameB = uniqueName("Felix");
    const petBId = await addPetViaUi(pageB, { name: nameB, species: "cat" });

    try {
      // Owner A mints a share link for pet A via the public API.
      const created = await convexCall<{ linkId: string; token: string }>(
        "mutation",
        "shareLinks:createToken",
        { ownerId: sessionA.ownerId, petId: petAId, scope: "passport" },
      );
      expect(created.token).toMatch(/^[0-9a-f]{64}$/);

      // 1. Anonymous resolve returns ONLY pet A's scoped projection.
      const resolved = await convexCall<{ pet: { name: string } }>(
        "query",
        "shareLinks:resolve",
        { token: created.token },
      );
      expect(resolved.pet.name).toBe(nameA);
      const projection = JSON.stringify(resolved);
      expect(projection, "share token leaked pet B").not.toContain(nameB);
      expect(projection, "share token leaked the owner email").not.toContain(
        sessionA.email,
      );

      // 2. Bogus tokens resolve to a clean null (dead link), not an error.
      const bogus = await convexCall<null>("query", "shareLinks:resolve", {
        token: randomToken(),
      });
      expect(bogus).toBeNull();

      // 3. Owner B cannot mint a capability for pet A.
      expect(
        await convexCallMustFail("mutation", "shareLinks:createToken", {
          ownerId: sessionB.ownerId,
          petId: petAId,
          scope: "passport",
        }),
      ).toContain("Pet not found");

      // 4. Owner B cannot revoke A's link.
      expect(
        await convexCallMustFail("mutation", "shareLinks:revoke", {
          ownerId: sessionB.ownerId,
          linkId: created.linkId,
        }),
      ).toContain("Link not found");

      // 5. Owner B cannot archive pet A (pets:archive guard).
      expect(
        await convexCallMustFail("mutation", "pets:archive", {
          ownerId: sessionB.ownerId,
          petId: petAId,
        }),
      ).toContain("Pet not found");

      // 6. Owner B cannot start a transfer of pet A (ownership.ts guard).
      expect(
        await convexCallMustFail("mutation", "ownership:createTransfer", {
          ownerId: sessionB.ownerId,
          petId: petAId,
        }),
      ).toContain("Pet not found");

      // 7. The reverse direction: owner A cannot mint for pet B either.
      expect(
        await convexCallMustFail("mutation", "shareLinks:createToken", {
          ownerId: sessionA.ownerId,
          petId: petBId,
          scope: "passport",
        }),
      ).toContain("Pet not found");

      // 8. Transfer redemption refuses unknown codes outright.
      expect(
        await convexCallMustFail("mutation", "ownership:redeemTransfer", {
          ownerId: sessionB.ownerId,
          code: "BADCODE1",
        }),
      ).toContain("Invalid transfer code");

      // 9. The public UI surface renders pet A and never pet B.
      await page.goto(`/p/${created.token}`);
      await expect(page.getByRole("heading", { level: 1, name: nameA })).toHaveText(
        nameA,
        { timeout: 20_000 },
      );
      await expect(page.locator("body")).not.toContainText(nameB);
    } finally {
      // Best-effort cleanup; failure never affects results.
      await archivePetViaHttp(sessionA.ownerId, petAId);
      await archivePetViaHttp(sessionB.ownerId, petBId);
      await contextB.close();
    }
  });

  test("unauthenticated dashboard routes bounce to sign-in", async ({
    page,
  }) => {
    for (const path of ["/dashboard", "/dashboard/pets", "/dashboard/share"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in/);
      expect(await getOwnerId(page)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// (e) sign-in email threading (Issue #21) - not inspectable yet
// ---------------------------------------------------------------------------

test.describe("regression: transactional email threading", () => {
  test("sign-in emails carry unique subjects so Gmail does not thread them", async () => {
    // TODO(#21): skip until the email is inspectable end to end.
    //
    // Why skipped today: the sign-in email is sent by the internal action
    // convex/resend.ts sendEmail, which POSTs to Resend and persists
    // NOTHING to any table. The mail* tables (convex/mail.ts) are the
    // inbound TEAM INBOX only (staff-gated requireRole("support")), and
    // magicTokens stores just email + tokenHash + timestamps, never the
    // message subject. There is currently no queryable outbox, so an e2e
    // assertion on the subject is impossible without product changes.
    //
    // When #21 lands: if a queryable outbox (or a dev-only inspection
    // path) exists, assert here that two sign-in emails sent to the SAME
    // mailbox carry subjects containing distinct timestamps (so Gmail
    // does not collapse them into one "Re:" thread), and that resend
    // within the 60s cooldown is refused instead of silently swallowed.
    test.skip(
      true,
      "TODO(#21): sign-in email subject is not inspectable (resend.sendEmail persists nothing; mail tables are inbound-only). Revisit when #21 lands.",
    );
  });
});
