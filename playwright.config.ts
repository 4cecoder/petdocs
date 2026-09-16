import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
const port = process.env.PORT || "3000";
const baseURL = process.env.BASE_URL || `http://localhost:${port}`;
const runRealBackend = process.env.E2E_REAL_BACKEND === "1";
const mockConvexUrl = `http://localhost:${port}`;
/** When BASE_URL points at a deployed site, skip starting a local server. */
const isRemoteBase =
  !!process.env.BASE_URL &&
  !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(baseURL);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? "github" : "list",
  timeout: 60_000,
  // Convex round-trips (actions can attempt an email send) and the in-spec
  // `bunx convex run` CLI calls used by the backend-exercising specs can
  // take several seconds each; give expects generous headroom.
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: CI ? "on-first-retry" : "off",
  },

  // Browser E2E is mock-first so routine CI/pipeline runs do not spend
  // Resend quota or mutate a Convex deployment. The backend-auth specs remain
  // available as an explicit, local-only diagnostic pass via
  // `bun run test:e2e:backend`.
  testIgnore: runRealBackend
    ? []
    : [
        "**/auth.spec.ts",
        "**/hydration.spec.ts",
        "**/passport-share.spec.ts",
        "**/pet-crud.spec.ts",
        "**/regression.spec.ts",
        "**/share.spec.ts",
      ],

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  ...(isRemoteBase
    ? {}
    : {
        webServer: {
          command: CI ? "bun run start" : "bun run dev",
          url: baseURL,
          reuseExistingServer: !CI,
          timeout: 120_000,
          env: {
            ...process.env,
            PORT: port,
            // Keep local E2E's Next lock/cache separate from an owner's dev
            // server. CI uses the normal build output for `next start`.
            NEXT_DIST_DIR: CI
              ? ".next"
              : runRealBackend
                ? ".next-e2e-backend"
                : ".next-e2e-mock",
            // Keep the Convex client mounted so page.route() can intercept
            // its calls, while the same-origin mock base URL keeps fallback
            // traffic inside this local Next server. This also covers server
            // components such as the public passport, whose fetches cannot
            // be intercepted by page.route().
            ...(runRealBackend ? {} : { NEXT_PUBLIC_CONVEX_URL: mockConvexUrl }),
          },
        },
      }),
});
