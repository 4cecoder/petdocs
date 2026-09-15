/**
 * Minimal ambient types for the pure-JS browser build of `qrcode` used by
 * convex/qr.ts (#39). The package ships no types and @types/qrcode only
 * covers the main (Node/fs) entry, so we declare exactly the surface we use.
 */
declare module "qrcode/lib/browser.js" {
  export interface QrSvgOptions {
    type?: "svg";
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
  }
  /** Renders `text` as a standalone `<svg>` string via the svg-tag renderer. */
  export function toString(
    text: string,
    options?: QrSvgOptions,
  ): Promise<string>;
}
