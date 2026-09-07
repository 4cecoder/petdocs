# docs/ - index

All product and engineering docs. Start with 00, then follow your path below.

## Start here

* Angela (non-technical): 01, then 02, then 12, then 16.
* Engineer: 03, then 04, then 06, then 18.

## Index

| Doc | One line |
|-----|----------|
| [00-docs-roadmap.md](00-docs-roadmap.md) | Docs status: have vs need vs stale, owners, cadence. |
| [01-product-brief.md](01-product-brief.md) | Problem, personas, user stories, KPIs. |
| [02-business-model.md](02-business-model.md) | Pricing, B2B2C, questions for Angela. |
| [03-architecture.md](03-architecture.md) | System blueprint, auth, uploads, envs, CI. |
| [04-data-model.md](04-data-model.md) | Convex schema plus queries and mutations. |
| [05-ux-frontend.md](05-ux-frontend.md) | Routes, screens, components, onboarding. |
| [06-roadmap.md](06-roadmap.md) | Build order, phases v0.1 to v1.0. |
| [07-feature-parity.md](07-feature-parity.md) | Web plus Android plus backend parity and pains. |
| [08-design-system.md](08-design-system.md) | PetArt, tokens, components, accessibility. |
| [09-stripe-compliance.md](09-stripe-compliance.md) | Billing rules, checkout, refunds, tax. |
| [10-resend-setup.md](10-resend-setup.md) | Magic links, reminders, domain setup. |
| [11-ai-ocr.md](11-ai-ocr.md) | OCR and AI catalog UC-1 to UC-10, parsers. |
| [12-demo-day.md](12-demo-day.md) | 5 min demo script, seed, objections, ask. |
| [13-reserved.md](13-reserved.md) | Reserved number, no doc assigned yet. |
| [14-deploy-netlify-vercel.md](14-deploy-netlify-vercel.md) | Netlify and Vercel deploy, envs, headers. |
| [15-trust.md](15-trust.md) | KYC, AI disclosure, retention, incidents. |
| [16-team-access.md](16-team-access.md) | Team access playbook, roles, invites, offboarding. |
| [17-company-email.md](17-company-email.md) | Shared team inbox, inbound routing, limits. |
| [18-operations.md](18-operations.md) | Superadmin operations runbook, incoming, lands in parallel. |
| [CHANGELOG.md](../CHANGELOG.md) | Release notes per deploy, incoming, lands in parallel. |

Notes: 13 has no doc file today and is held as a reserved number. 18 and CHANGELOG are incoming and land in parallel with this index.

## How docs map to GitHub issues and milestones

* `00` (roadmap) tracks doc debt: each Need row becomes a docs issue in the current milestone.
* `01` (brief) maps to the epic plus acceptance criteria on MVP milestone issues.
* `02` (business model) maps to pricing and packaging issues (Plus gates, add-ons, B2B2C) plus the Angela decision log.
* `03` (architecture) maps to scaffold and infra issues (Next shell, Convex, auth, CI, envs).
* `04` (data model) maps to one issue per Convex table and function group (`pets`, `documents`, `shareLinks`, more).
* `05` (UX) maps to one issue per route and screen (`/onboarding`, `/dashboard/pets`, `/p/[shareToken]`, more).
* `06` (roadmap) maps to phase checklists (v0.1 must-have vs v0.2 and v1.0) plus definition of done.
* `07` (parity) maps to per-flow parity issues: each flow-table row gets an issue labeled `scaffolded` or `planned` or `post-MVP`.
* `08` through `11` map to component and integration issues (design tokens, Stripe, Resend, OCR parsers).
* `12` (demo day) maps to the demo milestone and release-readiness checklist.
* `14` (deploy) maps to release issues (preview, prod promote, env checks).
* `15` through `18` map to ops issues (trust, access, inbox, superadmin) with `ops` label.
* `CHANGELOG` entries close the feature and fix issues in each shipped milestone.
