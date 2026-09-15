/**
 * Publishes an Android APK to Convex storage for the settings "Mobile apps"
 * panel + GET /api/builds/latest (convex/apkBuilds.ts, #42). Admin-gated:
 * the email you pass must be on the deployment's superadmin allowlist
 * (SUPERADMIN_EMAILS env or the built-in default in convex/admin.ts).
 *
 * Usage:
 *   bun run scripts/publish-apk.ts <path-to-apk> <version> <superadmin-email> ["notes"]
 *
 * Build the APK first, e.g.:
 *   cd android && ./gradlew :app:assembleDebug -PappVersionName=0.2.0
 *
 * The upload is two-step, matching the app's document flow:
 *   generateUploadUrl → POST bytes → finalize(platform, version, sha256).
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const [apkPath, version, adminEmail, notes] = process.argv.slice(2);

if (!apkPath || !version || !adminEmail) {
  console.error(
    'Usage: bun run scripts/publish-apk.ts <path-to-apk> <version> <superadmin-email> ["notes"]',
  );
  process.exit(1);
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not set (see .env.example).");
  process.exit(1);
}

const fileBuffer = await readFile(apkPath);
const bytes = fileBuffer.buffer.slice(
  fileBuffer.byteOffset,
  fileBuffer.byteOffset + fileBuffer.byteLength,
) as ArrayBuffer;
const sha256 = createHash("sha256").update(fileBuffer).digest("hex");

const client = new ConvexHttpClient(convexUrl);
console.log(
  `Uploading ${apkPath} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB) v${version} → ${convexUrl}`,
);

const uploadUrl = await client.mutation(api.apkBuilds.generateUploadUrl, {
  uploadedBy: adminEmail,
});
const uploadRes = await fetch(uploadUrl, {
  method: "POST",
  headers: { "Content-Type": "application/vnd.android.package-archive" },
  body: bytes,
});
if (!uploadRes.ok) {
  throw new Error(
    `Storage upload failed: ${uploadRes.status} ${await uploadRes.text()}`,
  );
}
const { storageId } = (await uploadRes.json()) as { storageId: string };

const buildId = await client.mutation(api.apkBuilds.finalize, {
  platform: "android",
  version,
  storageId: storageId as unknown as Id<"_storage">,
  sha256,
  ...(notes ? { notes } : {}),
  uploadedBy: adminEmail,
});

console.log(`Published: apkBuilds ${buildId}`);
console.log(`sha256: ${sha256}`);
console.log("The settings “Mobile apps” panel + /api/builds/latest now serve this build.");
