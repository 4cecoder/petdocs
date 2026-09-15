import type { MetadataRoute } from "next";

/**
 * PWA manifest served at /manifest.webmanifest by the Next.js file
 * convention (src/app/manifest.ts). Icons are the full-bleed maskable
 * set rasterized from docs/brand-assets/icon-fullbleed.svg.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "petdocs: Own your pet's docs",
    short_name: "petdocs",
    description:
      "One vault for every pet document: vaccines, labs, prescriptions, insurance, travel certs. Share a pet passport in seconds.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FFFBF5",
    theme_color: "#0D9488",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
