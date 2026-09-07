#!/usr/bin/env node
// Copies .env.example to .env.local on first run (never overwrites).
// Does NOT invent a Convex URL — run `bunx convex dev` to provision a real
// deployment; it writes NEXT_PUBLIC_CONVEX_URL into .env.local for you.
import { existsSync, readFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envExamplePath = path.join(root, ".env.example");
const envLocalPath = path.join(root, ".env.local");

if (!existsSync(envLocalPath)) {
  if (!existsSync(envExamplePath)) process.exit(0);
  copyFileSync(envExamplePath, envLocalPath);
  console.log("[setup-env] Created .env.local from .env.example");
}

const contents = readFileSync(envLocalPath, "utf8");
const hasRealConvexUrl = /^NEXT_PUBLIC_CONVEX_URL=https?:\/\//m.test(contents);

if (!hasRealConvexUrl) {
  console.log(
    "[setup-env] NEXT_PUBLIC_CONVEX_URL isn't set yet — run `bunx convex dev` to provision one.",
  );
}
