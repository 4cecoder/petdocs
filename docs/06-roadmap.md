# 06 — Roadmap: empty dir → deployed MVP

## Phase 0 — Scaffold (day 1)
1. `bun init; bun add next@^16 react@^19 react-dom@^19 convex @tanstack/react-query lucide-react`
   `bun add -d typescript @types/node @types/react @types/react-dom vitest convex-test @playwright/test tailwindcss @tailwindcss/postcss eslint eslint-config-next`
2. Scaffold: `package.json` scripts (dev/build/lint/typecheck/test), `next.config.ts` (securityHeaders),
   `tsconfig.json` (`@/*`), `netlify.toml` (`bun run build` + next plugin), `.env.example`, `AGENTS.md`,
   `src/app/{layout.tsx,globals.css,ConvexClientProvider.tsx,QueryProvider.tsx}`, `src/lib/routes.ts`.
3. Gate check: `bun run lint && bun run typecheck && bun run build` green on empty shell.

## Phase 1 — Backend (week 1–2)
4. `bunx convex dev` → `convex/schema.ts` ( §04, 8 tables) + `convex/pets.ts` + `convex/files.ts`
   (`generateUploadUrl/create/getStorageUrl`) + `convex-test` CRUD tests.
5. Auth: `convex/magicLink.ts + resend.ts`, `/sign-in`, `DashboardGuard` in `dashboard/layout.tsx`.
6. `shareLinks.ts` + `vaccinations.ts` + `medications.ts` + `vetVisits.ts` + `reminders.ts` (+ cron `sendDue`).

## Phase 2 — Frontend (week 3–5)
7. Shell: dashboard layout + nav (5 items) + marketing `/` + `/pricing` + `/how-it-works`.
8. Pets: list + `[petId]` profile + timeline; `DocUploader` (camera-first) + `DocList`; reminders list + FAB.
9. Share: `ShareButton` + owner manage page + public `/p/[shareToken]` + QR.

## Phase 3 — Harden + launch (week 6–8)
10. Tests: vitest unit (route-leak, validators) + convex (isolation, upload validation, token auth) +
    playwright `@smoke`; `pr.yml` gate; `test:e2e:smoke:prod` via `BASE_URL=`.
11. Deploy: demo Convex + Netlify branch deploy + locked seed (Maya/Mochi/Udon, Sam/Pickle);
    validate activation (1 pet + 3 docs + 1 share); then human-run prod `bunx convex deploy` from `main`.

## v0.2 → v1.0 (after validation)
- v0.2: OCR backfill (`extractedText` + search), co-owner invites, groomer-verify view, visit-summary ingest, QR collar tag.
- v1.0: subscriptions (Stripe), clinic B2B2C dashboard, insurer partnerships, travel packs, booking-platform API.

## Definition of done (MVP)
`bun run lint + typecheck + test + build` green; smoke passes locally + prod;
owner completes onboarding <3min; proof-of-vax <30s; share revoke instant;
no cross-owner leak (convex tests prove it).
