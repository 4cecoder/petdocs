# 03 — Architecture (Next.js 16 + ConvexDB)

Mirrors `adventurers-portal` patterns where they earn it; drops everything enterprise.

## 1. Stack
- Next.js 16 App Router + React 19 + TypeScript strict (`@/*` → `src/*`)
- Tailwind v4 (`@tailwindcss/postcss`, `@import "tailwindcss"` in `globals.css`, no config file)
- Convex backend (`convex/`, realtime queries/mutations/actions, `convex-test`)
- bun-only (`bun@1.x`, `bun.lock`; never npm/yarn/pnpm)
- `QueryProvider` + `ConvexClientProvider`; root layout = metadata/fonts only;
  `dashboard/layout.tsx` wraps auth guard + shell
- Netlify + `@netlify/plugin-nextjs` for web; Convex hosted backend
- DROP from portal: telephony/IVR, arena AI (transformers/three/tiptap/tesseract),
  finance (stripe/mercury), Firebase, vendored ui-kit (use Tailwind + lucide + local `cn()`)

## 2. Repo structure (create first → last)
```
petdocs/
  package.json  next.config.ts  tsconfig.json  netlify.toml
  .env.example  AGENTS.md
  src/app/layout.tsx  src/app/globals.css
  src/app/ConvexClientProvider.tsx  src/app/QueryProvider.tsx
  src/lib/routes.ts  src/lib/dashboardNav.ts  src/lib/utils.ts  src/lib/validators.ts
  src/app/(marketing)/page.tsx  src/app/(marketing)/pricing/page.tsx  src/app/(marketing)/how-it-works/page.tsx
  src/app/sign-in/page.tsx  src/app/onboarding/page.tsx
  src/app/dashboard/layout.tsx  src/app/dashboard/page.tsx
  src/app/dashboard/pets/page.tsx  src/app/dashboard/pets/[petId]/page.tsx
  src/app/dashboard/docs/page.tsx  src/app/dashboard/reminders/page.tsx
  src/app/dashboard/share/[token]/page.tsx
  src/app/p/[shareToken]/page.tsx   # public passport, NO auth
  src/components/{ui,pets,docs,upload,reminders,share}/
  convex/schema.ts  convex/pets.ts  convex/documents.ts  convex/files.ts
  convex/vaccinations.ts  convex/medications.ts  convex/vetVisits.ts
  convex/reminders.ts  convex/shareLinks.ts  convex/magicLink.ts  convex/resend.ts  convex/http.ts
  docs/  tests/e2e/  scripts/setup-env.mjs
```

## 3. Auth (mobile-first, pet-owner simple)
- Primary: magic link (mirror portal `convex/magicLink.ts`): `requestMagicLink({email})` →
  32B random token, sha256 hash stored, 15-min TTL, single-use, 60s resend cooldown,
  sent via Resend (`convex/resend.ts`).
- Optional password fallback for shared/clinic devices (post-MVP).
- `DashboardGuard` enforces auth for all `/dashboard/**`; `/p/[token]` bypasses (public).

## 4. File uploads (pet docs)
- Mirror portal `convex/files.ts`: `generateUploadUrl()` mutation → client POST file →
  `documents.create({petId, storageId, mime, size, category})` → `getStorageUrl({documentId})`.
- Allow: `application/pdf`, `image/jpeg|png|webp|heic`. Deny executables/svg (client + server check).
- Limits MVP: 10MB/file, 100 files/pet (reject in mutation before `storage.store()`).
- Reserve `extractedText` for future OCR; no OCR dep in MVP.
- Trash pattern: `isTrash` + `deletedAt`, `isFavorite`; `emptyTrash` deletes blob + row.

## 5. Environments (3-tier)
- `dev` (any branch, `bunx convex dev`) → `demo` (Netlify branch deploy + demo Convex, seeded pets) → `prod` (Netlify prod + Convex prod, real PII).
- **Convex env ≠ Netlify env.** `bunx convex env set RESEND_API_KEY …` per Convex deployment;
  `bunx netlify env:list` is frontend only (`NEXT_PUBLIC_CONVEX_URL`). Setting one never fills the other.
- Never commit `.env.local`, secrets, or `CONVEX_DEPLOY_KEY`. `.env.example` holds keys only.
- Human-only `bunx convex deploy` to prod from `main`.

## 6. Testing / CI (portal, simplified)
- vitest `unit` (`src/**/*.test.ts`: route-leak guard, validators) + `convex` (`convex/**/*.test.ts` via `convex-test`: pets CRUD, upload validation, share-token auth).
- playwright smoke (`@smoke`): `/` loads, `/dashboard` → sign-in redirect, upload happy-path mocked. `BASE_URL=` for prod smoke.
- Gate `.github/workflows/pr.yml`: lint (`eslint src/`) → typecheck (`tsc --noEmit`) → vitest → build (`next build`) → smoke. No `next lint` (removed in Next 16).

## 7. Security / CSP / PII
- Copy portal `next.config.ts` securityHeaders, trimmed: `default-src 'self'`;
  `img-src 'self' data: blob: https://*.convex.cloud`;
  `connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site`;
  keep `frame-ancestors 'none'`, HSTS, nosniff. Drop huggingface/xethub/unsplash.
- Scope every query by resolved `ownerId` (from auth identity → `owners.by_externalId`); never trust client `ownerId`; never unfiltered `listAll`; no PII in URLs/logs.
- Share tokens: 32B random, hashed in DB, expiry + maxViews + revoke, rate-limit guesses, no sequential IDs; `getStorageUrl` only via valid token; return shaped projections, never raw `storageId`/email.
