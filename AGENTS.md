# AGENTS.md — petdocs

## Package manager — bun only
- `bun@1.x` enforced (`packageManager`, `.nvmrc` Node 22, `netlify.toml`). Never `npm`/`yarn`/`pnpm`.
- Install: `bun install --frozen-lockfile`. Do not commit `package-lock.json`.

## Commands
- `bun run dev` — Next.js dev (http://localhost:3000) — run `bunx convex dev` in parallel
- `bun run lint` — `eslint src/` (no `next lint` — removed in Next 16)
- `bun run typecheck` — `tsc --noEmit`
- `bun run test` — vitest unit + convex
- `bun run test:e2e` / `test:e2e:smoke` — playwright (`BASE_URL=` for prod smoke)
- `bun run build` — `next build`

## Architecture
- Next.js 16 App Router + React 19 + Tailwind v4 + TS strict (`@/*` → `src/*`).
- Marketing `src/app/(marketing)/` (no URL segment) — `/`, `/pricing`, `/how-it-works`.
- App `src/app/dashboard/` → `/dashboard/*`; public passport `src/app/p/[shareToken]/` (no auth).
- Root layout = metadata/fonts/providers only; `dashboard/layout.tsx` enforces auth via DashboardGuard.
- Typed routes `src/lib/routes.ts` — never hardcode `(marketing)` in hrefs (leak test guards).
- Convex `convex/` — schema + per-domain functions; storage via `generateUploadUrl → POST → create`.

## Env
- `.env.example` = keys only. Real values in `.env.local` (gitignored) + Convex dashboard + Netlify.
- **Convex env ≠ Netlify env.** `bunx convex env set KEY …` per deployment; Netlify is frontend only.
- Never commit secrets or `CONVEX_DEPLOY_KEY`. Prod `bunx convex deploy` is human-run from `main` only.

## Reference
- Patterns from `../adventurers/adventurers-portal/` (shell, uploads, magic-link, CSP, CI).
- Reuse patterns, never copy domain code. Portal extras (telephony, arena AI, finance, mail) are out of scope.
