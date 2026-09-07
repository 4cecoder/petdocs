import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 20000,
    projects: [
      {
        // Convex tests need `bunx convex dev` codegen first (convex/_generated).
        // Run explicitly once a dev deployment exists: `bun run test:convex`.
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
          testTimeout: 20000,
        },
      },
      {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
          },
        },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          environment: "node",
        },
      },
    ],
  },
});
