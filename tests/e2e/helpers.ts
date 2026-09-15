/**
 * Shared helpers for backend-exercising e2e specs.
 *
 * Unlike smoke/flows.spec.ts, these specs drive the REAL Convex dev
 * deployment (necessary-cod-965) through the running Next dev server:
 *   - Sign-up uses the product's own magic-link flow (sign-in form ->
 *     requestMagicLink action -> verifyMagicLink mutation -> dashboard).
 *   - The raw token is read from the dev-only "Direct Sign-In Link" panel
 *     (src/app/sign-in/page.tsx renders requestMagicLink's previewUrl when
 *     the origin is localhost). The database stores only a SHA-256 hash
 *     (convex/magicLink.ts:216-222), so the previewUrl is the ONLY way to
 *     recover the raw token; `bunx convex run magicLink:latestTokenForEmail`
 *     is used alongside it to assert DB-level row state (minted/consumed).
 *   - Every test mints a UNIQUE email, so the 60s per-email resend cooldown
 *     (convex/magicLink.ts:33,212-214) can never trigger. Never submit the
 *     sign-in form twice for the same email inside a test.
 *   - All Convex CLI calls run against the deployment named in .env.local
 *     (CONVEX_DEPLOYMENT), which the guard below pins to a `dev:` target.
 *     Nothing here may ever touch prod.
 */
import { execFileSync, execSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

const REPO_ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Env (Playwright's process does not load .env.local, so read it directly)
// ---------------------------------------------------------------------------

function readEnvLocal(key: string): string | null {
  try {
    const raw = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
    const match = raw.match(new RegExp(`^${key}=(\\S+)`, "m"));
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Dev deployment id from .env.local (e.g. "necessary-cod-965"). */
function devDeploymentName(): string {
  const deployment = readEnvLocal("CONVEX_DEPLOYMENT");
  if (!deployment || !deployment.startsWith("dev:")) {
    throw new Error(
      "e2e helpers refuse to run Convex CLI: CONVEX_DEPLOYMENT in .env.local is missing or not a dev deployment.",
    );
  }
  return deployment.slice("dev:".length);
}

/** Convex HTTP endpoint of the dev deployment (no keys needed: public API). */
export function devConvexUrl(): string {
  return readEnvLocal("NEXT_PUBLIC_CONVEX_URL") ?? `https://${devDeploymentName()}.convex.cloud`;
}

// ---------------------------------------------------------------------------
// Convex CLI (admin-capable round-trip against the dev deployment)
// ---------------------------------------------------------------------------

/** Row shape of magicTokens as returned by magicLink:latestTokenForEmail. */
export interface MagicTokenRow {
  _id: string;
  email: string;
  tokenHash: string;
  expiresAt: number;
  usedAt?: number;
  createdAt: number;
}

/**
 * Run a Convex function via the CLI. Uses the dev deployment from
 * .env.local (guarded above); never passes --prod. Returns the parsed JSON
 * result (may be null).
 *
 * Retries transient infrastructure failures up to 3 attempts (the CLI
 * spawns are heavy and the full suite runs fully parallel against one dev
 * deployment; sockets/timeouts flake under that load). App-level errors
 * thrown by the function itself propagate immediately — the CLI prints
 * them and exits non-zero with an "App Error"-style message.
 */
export function convexRun<T = unknown>(functionPath: string, args: unknown): T {
  devDeploymentName(); // guard: refuse anything that is not dev:*
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const stdout = execFileSync(
        "bunx",
        ["convex", "run", functionPath, JSON.stringify(args)],
        {
          cwd: REPO_ROOT,
          encoding: "utf8",
          timeout: 90_000,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const trimmed = stdout.trim();
      // Mutations print NOTHING on success (empty stdout, exit 0); queries
      // and actions print their JSON result.
      if (trimmed === "") return null as T;
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        // Tolerate stray non-JSON lines: parse from the first { or [ onward.
        const start = trimmed.search(/[{[]/);
        if (start === -1) throw new Error(`convex run ${functionPath}: unparseable output: ${trimmed.slice(0, 200)}`);
        return JSON.parse(trimmed.slice(start)) as T;
      }
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      // Only transport/spawn-level failures are worth retrying; app-level
      // rejections ("App Error ...") and unparseable-output bugs are not.
      const isTransient =
        /fetch failed|timed? ?out|ECONNRESET|ETIMEDOUT|EPIPE|socket hang up|spawn (ENOENT|EBUSY)|interrupted/i.test(
          message,
        );
      if (!isTransient || attempt === 2) throw err;
      // Brief synchronous pause; this helper is already fully blocking.
      execSync(`sleep ${attempt + 1}`, { stdio: "ignore" });
    }
  }
  throw lastError;
}

/** Latest magicTokens row for an email, or null (CLI query round-trip). */
export function magicTokenRow(email: string): MagicTokenRow | null {
  return convexRun<MagicTokenRow | null>("magicLink:latestTokenForEmail", { email });
}

export function randomToken(): string {
  return randomBytes(32).toString("hex");
}

/** Seed an ALREADY-EXPIRED magic token row directly (dev-only helper). */
export function storeExpiredMagicToken(email: string): string {
  const token = randomToken();
  convexRun("magicLink:storeToken", {
    email,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: Date.now() - 1_000,
  });
  return token;
}

// ---------------------------------------------------------------------------
// Session helpers (mirror src/lib/api.ts localStorage keys)
// ---------------------------------------------------------------------------

export function getSessionEmail(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem("petdocs-owner"));
}

export function getOwnerId(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem("petdocs-owner-id"));
}

// ---------------------------------------------------------------------------
// UI flow helpers
// ---------------------------------------------------------------------------

/** Unique, lowercase, parseable e2e email. Unique per call => no 60s cooldown. */
export function uniqueEmail(label: string): string {
  const rand = randomBytes(3).toString("hex");
  return `e2e+${label}-${Date.now().toString(36)}-${rand}@seridian.dev`;
}

export interface MagicLink {
  email: string;
  /** Raw 64-hex token parsed from the dev previewUrl. */
  token: string;
  /** Absolute previewUrl (origin + /sign-in?token=...&email=...). */
  url: string;
}

/**
 * Submit the real sign-in form and recover the raw magic-link token from
 * the dev-only "Direct Sign-In Link" panel. Proves the requestMagicLink
 * action round-trip (the panel only renders after the action resolves).
 */
export async function requestMagicLinkViaUi(page: Page, email: string): Promise<MagicLink> {
  await page.goto("/sign-in");
  const emailBox = page.getByRole("textbox", { name: "Email", exact: true });
  await expect(emailBox).toBeVisible();
  await emailBox.fill(email);
  // Exact match: after sending, the button relabels to "Resend magic link
  // email", which we must never click (single request per email per test).
  await page
    .getByRole("button", { name: "Email me a magic link instead", exact: true })
    .click();

  // Backend round-trip proof: the inbox status only appears once the action
  // resolved, and the dev direct-link panel carries the raw token.
  await expect(page.getByText("Check your inbox")).toBeVisible({ timeout: 20_000 });
  const directHeading = page.getByText("Direct Sign-In Link");
  await expect(directHeading).toBeVisible({ timeout: 10_000 });

  const href = await page
    .getByRole("link", { name: /Sign in directly/ })
    .getAttribute("href");
  if (!href) throw new Error("Direct sign-in link anchor has no href");
  const parsed = new URL(href);
  const token = parsed.searchParams.get("token");
  const emailed = parsed.searchParams.get("email");
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    throw new Error(`previewUrl did not carry a 64-hex token: ${href}`);
  }
  if (emailed !== email) {
    throw new Error(`previewUrl email mismatch: ${emailed} != ${email}`);
  }
  expect(parsed.pathname).toBe("/sign-in");
  return { email, token, url: href };
}

export interface AuthSession {
  email: string;
  token: string;
  ownerId: string | null;
}

/** Authenticated markers of the dashboard shell (DashboardLayout). */
export async function expectSignedIn(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Dashboard" }).filter({ visible: true }),
  ).toBeVisible();
}

/**
 * The page's own form-level alert. Scoped to <main> because Next.js renders
 * a global route announcer with role="alert" outside it, which would trip
 * strict-mode locators.
 */
export function formAlert(page: Page) {
  return page.locator("main").getByRole("alert");
}

/**
 * Full real sign-up: request link via the form, click the dev direct link,
 * and wait for the auth-gated dashboard. Returns the session details.
 */
export async function signUpViaUi(page: Page, label: string): Promise<AuthSession> {
  const { email, token } = await requestMagicLinkViaUi(page, uniqueEmail(label));
  await page.getByRole("link", { name: /Sign in directly/ }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
  await expectSignedIn(page);
  const ownerId = await getOwnerId(page);
  expect(ownerId, "verifyMagicLink should have stored the owner id").toMatch(/^[a-z0-9]+$/);
  return { email, token, ownerId };
}

// ---------------------------------------------------------------------------
// Dashboard flows
// ---------------------------------------------------------------------------

export interface AddPetInput {
  name: string;
  species?: "dog" | "cat" | "bird" | "rabbit" | "reptile" | "other";
  breed?: string;
}

/**
 * Add a pet through the /dashboard/pets wizard and return the new petId
 * (parsed from the rendered PetCard href).
 */
export async function addPetViaUi(page: Page, input: AddPetInput): Promise<string> {
  // Direct goto instead of clicking the sidebar link: a click issued before
  // the client bundle finishes hydrating is silently swallowed (URL never
  // changes) and flaked under parallel workers. URL navigation is
  // hydration-independent and keeps this helper focused on the wizard.
  await page.goto("/dashboard/pets");
  await expect(page.getByRole("heading", { name: "Pets", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "+ Add pet" }).click();
  const nameInput = page.getByRole("textbox", { name: "Name", exact: true });
  await expect(nameInput).toBeVisible();
  await nameInput.fill(input.name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  if (input.species) {
    // The species field is a @seridian/ui-kit dropdown (Radix Select): open
    // the combobox, then pick the option from the rendered listbox.
    const speciesTrigger = page.getByLabel("Species");
    await expect(speciesTrigger).toBeVisible();
    await speciesTrigger.click();
    await page.getByRole("option", { name: input.species }).click();
  }
  if (input.breed) {
    await page.getByLabel("Breed").fill(input.breed);
  }
  // Exact: avoids the "+ Add pet" toggle button.
  await page.getByRole("button", { name: "Add pet", exact: true }).click();

  const card = page.getByRole("link", { name: new RegExp(`^${input.name}`) });
  // pets:create runs against the shared dev deployment; under parallel
  // workers the mutation round-trip can take tens of seconds (the submit
  // button sits in its "Working…" state meanwhile). Give it real headroom.
  await expect(card).toBeVisible({ timeout: 30_000 });
  const href = await card.getAttribute("href");
  if (!href || !href.startsWith("/dashboard/pets/")) {
    throw new Error(`PetCard href missing or unexpected: ${href}`);
  }
  return href.replace("/dashboard/pets/", "");
}

/**
 * Best-effort TEST DATA CLEANUP only: archive a pet through the public
 * Convex HTTP API (identity-from-arg mutation, same as the product client).
 * There is no delete UI yet (documented gap), so specs call this in a final
 * best-effort pass; failure never affects test results.
 */
export async function archivePetViaHttp(ownerId: string, petId: string): Promise<void> {
  try {
    await fetch(`${devConvexUrl()}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "pets:archive", args: { ownerId, petId }, format: "json" }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Cleanup is best-effort by design.
  }
}
