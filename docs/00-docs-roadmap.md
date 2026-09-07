# 00 - Docs Roadmap

Where docs stand, what is missing, and what may retire. Read this before adding a doc.

## Have

| Doc | Covers | Status |
|-----|--------|--------|
| 01-product-brief.md | Problem, personas, stories, KPIs | current |
| 02-business-model.md | Pricing tiers, B2B2C options, open questions | needs-refresh after pricing decision |
| 03-architecture.md | Stack, auth, uploads, envs, CI | current |
| 04-data-model.md | Convex schema, tables, functions | current |
| 05-ux-frontend.md | Routes, screens, onboarding | needs-refresh as screens land |
| 06-roadmap.md | Build order v0.1 to v1.0 | current |
| 07-feature-parity.md | Web, Android, backend parity | current |
| 08-design-system.md | PetArt, tokens, components | current |
| 09-stripe-compliance.md | Billing rules, checkout, tax, refunds | needs-refresh with webhook build guide |
| 10-resend-setup.md | Magic links, reminders, domain DNS | current |
| 11-ai-ocr.md | OCR catalog UC-1 to UC-10, parsers | current |
| 12-demo-day.md | 5 min script, seed, objections | needs-refresh if seed changes |
| 14-deploy-netlify-vercel.md | Netlify and Vercel deploy, envs | current |
| 15-trust.md | KYC, AI disclosure, retention, incidents | needs-refresh with incident detail |
| 16-team-access.md | Staff roles, invites, offboarding | current |
| 17-company-email.md | Shared inbox, inbound routing | current |
| 18-operations.md | Superadmin operations runbook | incoming, lands in parallel |
| CHANGELOG.md | Release notes per deploy | incoming, lands in parallel |

## Need

Missing docs picked from real gaps in Have. No placeholders beyond this list.

| Needed doc | Why |
|------------|-----|
| Stripe webhook build guide | 09 states rules only, no handler, raw body, dedupe, or test plan |
| Server OCR runbook | 11 catalogs use cases, no server pipeline, costs, or fallback |
| B2B2C partner onboarding | 02 prices clinic plans, no invite, subsidy, or support flow |
| Incident playbook detail | 15 names response, no severity levels, pages, or comms template |
| Android release signing | android-app README covers debug only, no keystore or Play track |
| Analytics and events | No doc defines events, funnels, or privacy-safe tracking |

## Stale and retire candidates

Retire nothing yet. Watch list below, refresh or merge when flagged.

| Candidate | Reason |
|-----------|--------|
| 06-roadmap.md Phase 0 | Retire scaffold steps once v0.1 ships, keep phase checklists |
| 07-feature-parity.md market stats | Refresh yearly, numbers date fast |
| 12-demo-day.md seed rows | Refresh on any seed or route change |

## Owners

| Area | Owner | Docs |
|------|-------|------|
| Product | Angela | 01, 02, 12, plus decisions in 15 and 16 |
| Engineering | eng | 03, 04, 05, 06, 07, 08, 09, 10, 11, 14, 17, 18 |
| Shared | Angela plus eng | 15 trust, 16 access, CHANGELOG entries |

## Cadence

* Update docs on every feature PR that changes behavior, schema, routes, or pricing.
* Feature PR touches code plus the matching doc plus 07 parity plus CHANGELOG when it exists.
* Angela confirms 01, 02, and 12 monthly or on any pricing or pitch change.
* Eng confirms 03, 04, 06, 07, 14, and 18 on every backend, route, or deploy change.
