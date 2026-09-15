/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { sanitizeHeaders } from "./resend";

/**
 * #21: magic-link emails must each be a standalone Gmail conversation.
 * sendEmail only ever forwards headers through sanitizeHeaders, so these
 * guarantees hold for every send: Message-ID passes, threading headers
 * (In-Reply-To / References) never do.
 */
describe("resend sanitizeHeaders (#21)", () => {
  test("keeps a unique Message-ID header", () => {
    const out = sanitizeHeaders({
      "Message-ID": "<abc123@petdocs.seridian.dev>",
    });
    expect(out).toEqual({ "Message-ID": "<abc123@petdocs.seridian.dev>" });
  });

  test("strips In-Reply-To and References regardless of casing", () => {
    const out = sanitizeHeaders({
      "In-Reply-To": "<thread@old.example>",
      "in-reply-to": "<thread2@old.example>",
      References: "<ref@old.example>",
      "REFERENCES": "<ref2@old.example>",
    });
    expect(out).toEqual({});
  });

  test("trims keys/values and drops empties", () => {
    const out = sanitizeHeaders({
      "  X-Custom ": "  value-1  ",
      "X-Empty": "   ",
      "": "ignored",
    });
    expect(out).toEqual({ "X-Custom": "value-1" });
  });

  test("bounds header count to 10", () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < 15; i++) many[`X-H${i}`] = `v${i}`;
    const out = sanitizeHeaders(many);
    expect(Object.keys(out).length).toBe(10);
  });

  test("bounds header value length to 998 chars", () => {
    const out = sanitizeHeaders({ "X-Long": "a".repeat(2000) });
    expect(out["X-Long"]).toHaveLength(998);
  });
});
