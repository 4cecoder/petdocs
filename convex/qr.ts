/**
 * QR SVG rendering for passport share links (#39).
 *
 * Server-side only — never import from src/. Uses the `qrcode` npm package's
 * PURE-JS browser build (`qrcode/lib/browser.js`): no fs, no pngjs, no canvas,
 * no Node builtins — verified to run inside the default Convex action/HTTP
 * runtime (see convex/passportShare.test.ts, which executes the renderSvg
 * action through convex-test's edge-runtime VM).
 *
 * No external API calls: the SVG string is generated in-process.
 */
import QRCode from "qrcode/lib/browser.js";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Render `text` as a standalone `<svg>` string. Brand colors match the
 * PetDocs email card (ink on white) so the QR stays scannable on any client.
 */
export async function renderQrSvg(text: string): Promise<string> {
  return await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: { dark: "#1C1917", light: "#FFFFFF" },
  });
}

/**
 * Response wrapper for the hosted QR route (pure, exported for tests):
 * always image/svg+xml with a short public cache.
 */
export function qrSvgResponse(svg: string): Response {
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

/**
 * Internal action wrapper — usable from any action that needs a QR
 * (and exercised directly by convex-test). Kept in a file with no
 * queries/mutations so the module stays action-runtime only.
 */
export const renderSvg = internalAction({
  args: { text: v.string() },
  returns: v.string(),
  handler: async (_ctx, args) => {
    return await renderQrSvg(args.text);
  },
});
