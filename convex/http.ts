import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Public HTTP surface (resend webhooks, share oEmbed later).
// Auth for /p/[token] stays in shareLinks.resolve - no HTTP routes needed
// for MVP beyond this placeholder.
const http = httpRouter();

// Svix verification for Resend inbound, ported small from portal
// convex/lib/webhookVerify.ts. Uses constant time compare for digests.
const SIGNATURE_TOLERANCE_SECONDS = 300;

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifySvixSignature(input: {
  id: string;
  timestamp: string;
  payload: string;
  signatureHeader: string;
  secret: string;
  nowSeconds?: number;
}): Promise<boolean> {
  try {
    const timestamp = Number.parseInt(input.timestamp, 10);
    if (!Number.isFinite(timestamp)) return false;
    const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
    const secretPart = input.secret.startsWith("whsec_")
      ? input.secret.slice("whsec_".length)
      : input.secret;
    const keyBytes = base64ToBytes(secretPart);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes as unknown as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signedContent = `${input.id}.${input.timestamp}.${input.payload}`;
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedContent),
    );
    const expected = bytesToBase64(new Uint8Array(signature));
    return input.signatureHeader.split(" ").some((entry) => {
      const parts = entry.split(",");
      if (parts.length !== 2) return false;
      const [version, digest] = parts;
      if (version !== "v1" || !digest) return false;
      return timingSafeEqual(digest, expected);
    });
  } catch {
    return false;
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function emailAddressOf(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const r = value as Record<string, unknown>;
    return asString(r.address) ?? asString(r.email);
  }
  return undefined;
}

function firstAddress(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = emailAddressOf(entry);
      if (found) return found;
    }
    return undefined;
  }
  return emailAddressOf(value);
}

http.route({
  path: "/resend/inbound",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const payload = await req.text();
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    const secret = process.env.RESEND_WEBHOOK_SECRET;

    if (secret) {
      if (!svixId || !svixTimestamp || !svixSignature) {
        return new Response("Missing svix signature headers", { status: 401 });
      }
      const valid = await verifySvixSignature({
        id: svixId,
        timestamp: svixTimestamp,
        payload,
        signatureHeader: svixSignature,
        secret,
      });
      if (!valid) {
        return new Response("Invalid signature", { status: 401 });
      }
    }

    let body: unknown;
    try {
      body = JSON.parse(payload);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    const root = asRecord(body);
    if (!root) return new Response("Invalid JSON", { status: 400 });

    // Defensive: accept top level fields or nested data envelope.
    const data = asRecord(root.data) ?? root;
    const to =
      firstAddress(root.to) ??
      firstAddress(data.to) ??
      asString(root.to) ??
      asString(data.to);
    const from =
      emailAddressOf(root.from) ??
      emailAddressOf(data.from) ??
      asString((data as Record<string, unknown>).from_email);
    const subject =
      asString(root.subject) ?? asString(data.subject) ?? "(no subject)";
    const text =
      asString(root.text) ?? asString(data.text) ?? "";
    const html = asString(root.html) ?? asString(data.html);
    const resendId =
      asString(root.resendId) ??
      asString(data.resendId) ??
      asString(root.id) ??
      asString(data.email_id) ??
      asString(data.message_id) ??
      asString(data.messageId);

    if (!to || !from) {
      return new Response("Missing required fields", { status: 400 });
    }

    await ctx.runMutation(internal.mail.ingestInbound, {
      to,
      from,
      subject,
      text,
      ...(html ? { html } : {}),
      ...(resendId ? { resendId } : {}),
    });
    return jsonResponse({ ok: true }, 200);
  }),
});

export default http;
