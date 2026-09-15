# petdocs Branding Kit

The mark, palette, and icon/OG assets for petdocs. Everything derives from the
hand-drawn kawaii kit in `src/components/art/PetArt.tsx` and the Tailwind v4
tokens in `src/app/globals.css`.

## Palette

| Token | Hex | Use |
| --- | --- | --- |
| `cream` | `#FFFBF5` | App/page background |
| `cream-dark` | `#F7EFE2` | Cards on cream, soft fills, background paws |
| `ink` | `#1C1917` | Primary text / mark outline |
| `ink-soft` | `#57534E` | Secondary text |
| `brand-500` | `#14B8A6` | Accent (light) |
| `brand-600` | `#0D9488` | **Primary teal** — buttons, icon background |
| `brand-700` | `#0F766E` | Teal dark — links hover, stamp details |
| `amber` | `#F59E0B` | Paw badge, alerts, stamps |
| `amber-soft` | `#FCD34D` | Illustration fills (`AMBER_SOFT` in PetArt) |
| `blush` | `#FDA4AF` | Kawaii accents (`BLUSH` in PetArt) |

Brand-50…900 scale lives in `src/app/globals.css` (`--color-brand-*`).

## The mark

A rounded teal square with a cream paw print (main pad + four toes). Two
variants:

- **Rounded** (`docs/brand-assets/icon-rounded.svg`) — favicons and in-app
  avatars. Rounded corners baked in.
- **Full-bleed** (`docs/brand-assets/icon-fullbleed.svg`) — anything a host
  masks (apple-touch-icon, Android maskable). Square edges, no transparency,
  paw kept inside the maskable safe zone (center ~66%).

The paw geometry is shared with `PawPrint` in `src/components/art/PetArt.tsx`.

## Assets

| File | Purpose |
| --- | --- |
| `public/og.png` | Open Graph / Twitter card (1200×630). Referenced by `src/app/layout.tsx` metadata. |
| `src/app/icon.svg` | Favicon (Next file convention, auto-served). |
| `public/favicon.ico` | Legacy favicon fallback (16/32/48). |
| `src/app/apple-icon.png` | Apple touch icon (180×180, auto-served by Next). |
| `public/icon-192.png` / `public/icon-512.png` | PWA icons — registered as both `any` and `maskable` in `src/app/manifest.ts`. |
| `docs/brand-assets/og.svg` | Editable source for the OG card. |
| `docs/brand-assets/icon-rounded.svg` | Editable source for the rounded icon. |
| `docs/brand-assets/icon-fullbleed.svg` | Editable source for masked icons. |

## Regenerating the rasters

`rsvg-convert` (librsvg) renders the SVG sources; ImageMagick builds the
legacy `.ico`:

```sh
rsvg-convert -w 1200 -h 630 docs/brand-assets/og.svg -o public/og.png
rsvg-convert -w 180 -h 180 docs/brand-assets/icon-fullbleed.svg -o src/app/apple-icon.png
rsvg-convert -w 192 -h 192 docs/brand-assets/icon-fullbleed.svg -o public/icon-192.png
rsvg-convert -w 512 -h 512 docs/brand-assets/icon-fullbleed.svg -o public/icon-512.png
rsvg-convert -w 16 -h 16 docs/brand-assets/icon-rounded.svg -o icon16.png
rsvg-convert -w 32 -h 32 docs/brand-assets/icon-rounded.svg -o icon32.png
rsvg-convert -w 48 -h 48 docs/brand-assets/icon-rounded.svg -o icon48.png
magick icon16.png icon32.png icon48.png public/favicon.ico
```

`src/app/icon.svg` is a copy of `docs/brand-assets/icon-rounded.svg` — update
the source, then re-copy.

## Link previews

`src/app/layout.tsx` sets `metadataBase` (`https://petdocs.seridian.dev`),
Open Graph (`og:title`, `og:description`, `og:type`, `og:url`, `og:image`),
and Twitter `summary_large_image` tags. Chat apps and social crawlers resolve
`/og.png` (1200×630 PNG — rasterized, since some scrapers ignore SVG
previews).

## Icon usage rules

- Never place the cream paw on a light background — it needs the teal (or
  amber) field for contrast.
- Keep clear space around the mark equal to one toe radius.
- Don't outline, gradient-fill, or rotate the paw.
- For illustrations, reuse `PetArt` scenes rather than inventing new marks.
