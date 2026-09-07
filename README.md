# petdocs — Own Your Pet's Docs

Portal for pet owners to own their pets' documents end-to-end.
For Agnela (stakeholder — business model owner). Built for the pet industry.

**Stack:** Next.js 16 App Router + React 19 + ConvexDB + Tailwind v4 + TypeScript + bun.
**Reference:** `../adventurers/adventurers-portal/` (patterns only — dashboard shell, Convex storage, magic-link auth, typed routes, Netlify+Convex deploy). No domain code copied.

## The idea in one line

> Upload once, prove vaccination in <30s, share via link/QR, never miss a booster.

Shoes boxes + email threads + 3 vet portals → one vault + shareable pet passport.

## MVP scope (v0.1, 6–8 wks)

Must-have:
- Pets CRUD (dog/cat first, photo, breed, DOB, weight, microchip, spay/neuter)
- Document vault (PDF/photo upload, categories: vaccine_record, lab_result, prescription, insurance, microchip, travel_certificate, photo, other)
- Vaccine + medication records with due dates
- Reminders (boosters, flea/tick, annual exam)
- Vet visit history log
- Shareable pet passport link `/p/[token]` (read-only, QR, expiry, revoke)

Explicitly out of MVP: OCR auto-extract (reserve field), wallet passes, multi-owner roles, vet-portal upload, insurance claim export, weight charts, lost-pet mode.

## Docs

| Doc | What |
|-----|------|
| [docs/01-product-brief.md](docs/01-product-brief.md) | Problem, personas, user stories, KPIs |
| [docs/02-business-model.md](docs/02-business-model.md) | Pricing, B2B2C, questions for Agnela |
| [docs/03-architecture.md](docs/03-architecture.md) | System blueprint, auth, uploads, envs, CI |
| [docs/04-data-model.md](docs/04-data-model.md) | Convex schema + queries/mutations |
| [docs/05-ux-frontend.md](docs/05-ux-frontend.md) | Routes, screens, components, onboarding |
| [docs/06-roadmap.md](docs/06-roadmap.md) | Build order, phases v0.1→v1.0 |

## Quickstart (once scaffolded)

```bash
bun install --frozen-lockfile
bunx convex dev   # first terminal — creates dev deployment
bun run dev       # second terminal — http://localhost:3000
```

See [docs/06-roadmap.md](docs/06-roadmap.md) for the empty-dir → deployed build order,
and [AGENTS.md](AGENTS.md) for bun-only rules + gates.

## Status

Repo: [github.com/4cecoder/petdocs](https://github.com/4cecoder/petdocs) (public — Actions build jobs free).
Docs index: [docs/README.md](docs/README.md) (docs/01–07).

Scaffolded: web shell (marketing + dashboard + `/p/[shareToken]`) + Convex
schema/functions + magic-link auth + seed + CI. Next: `android-app/` +
codegen wiring (`convex/_generated/` + `magicTokens` table).

Flow-by-flow parity (web ↔ Android ↔ backend): [docs/07-feature-parity.md](docs/07-feature-parity.md).

## Deploy

Standard Next.js 16 app, deployable to Netlify and Vercel with zero code changes. Full guide: [docs/14-deploy-netlify-vercel.md](docs/14-deploy-netlify-vercel.md).

```bash
bun install --frozen-lockfile
bunx convex dev  # first terminal, creates dev deployment
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud bun run dev  # or set in host dashboard
bunx netlify deploy --build --prod  # or `vercel --prod`
bunx convex deploy  # backend only, from main, human-run for prod
```
