/**
 * Public HTTP surface for passport email sharing (#39).
 *
 * GET /api/passport/[token]/qr.svg
 *   Renders the QR code for a LIVE passport share link as an SVG image.
 *   Used as the hosted QR image inside share emails (cleaner than data
 *   URIs for email clients) and scannable anywhere the link works.
 *
 *   - No auth (it backs a public email image), but the token must resolve
 *     to a live share link — unknown/revoked/expired tokens 404, so a
 *     revoked passport never keeps a working QR around.
 *   - The QR encodes the APP passport URL (`SITE_URL`/p/[token], same
 *     resolution as magic-link emails), not the Convex site URL.
 *   - SVG is rendered in-process by convex/qr.ts (pure JS, no external
 *     API calls). Short public cache; the underlying link state is
 *     re-checked after expiry of the cache window.
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { renderQrSvg, qrSvgResponse } from "./qr";
import { resolveBaseUrl } from "./magicLink";

const QR_PATH_RE = /^\/api\/passport\/([0-9a-f]{64})\/qr\.svg$/;

const qrRouteHandler = httpAction(async (ctx, req) => {
  const match = new URL(req.url).pathname.match(QR_PATH_RE);
  if (!match) return new Response("Not found", { status: 404 });
  const token = match[1];

  const live = await ctx.runQuery(internal.passportShare.isTokenLive, {
    token,
  });
  if (!live) return new Response("Not found", { status: 404 });

  const passportUrl = `${resolveBaseUrl()}/p/${token}`;
  let svg: string;
  try {
    svg = await renderQrSvg(passportUrl);
  } catch {
    return new Response("QR render failed", { status: 500 });
  }
  return qrSvgResponse(svg);
});

/**
 * Route specs mounted by convex/http.ts at the clearly-marked #39 anchor.
 * Kept as data (instead of a second router) so the mount stays ≤5 lines.
 */
export const passportRoutes = [
  {
    pathPrefix: "/api/passport/",
    method: "GET" as const,
    handler: qrRouteHandler,
  },
];

export default httpRouter();
