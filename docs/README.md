# docs/ — index

| Doc | One line |
|-----|----------|
| [01-product-brief.md](01-product-brief.md) | Problem, personas, user stories, KPIs. |
| [02-business-model.md](02-business-model.md) | Pricing, B2B2C, questions for Agnela. |
| [03-architecture.md](03-architecture.md) | System blueprint, auth, uploads, envs, CI. |
| [04-data-model.md](04-data-model.md) | Convex schema + queries/mutations. |
| [05-ux-frontend.md](05-ux-frontend.md) | Routes, screens, components, onboarding. |
| [06-roadmap.md](06-roadmap.md) | Build order, phases v0.1→v1.0. |
| [07-feature-parity.md](07-feature-parity.md) | Web ↔ Android ↔ backend parity, pains, model, steal-list. |

## How docs map to GitHub issues

- `01` (brief) → epic + acceptance criteria on the MVP milestone issues.
- `02` (business model) → pricing/packaging issues (Plus gates, add-ons, B2B2C) + Agnela decision log.
- `03` (architecture) → scaffold/infra issues (Next shell, Convex, auth, CI, envs).
- `04` (data model) → one issue per Convex table/function group (`pets`, `documents`, `shareLinks`, …).
- `05` (UX) → one issue per route/screen (`/onboarding`, `/dashboard/pets`, `/p/[shareToken]`, …).
- `06` (roadmap) → phase checklists (v0.1 must-have vs v0.2/v1.0) + definition of done.
- `07` (parity) → per-flow parity issues: each flow-table row gets an issue labeled `scaffolded` / `planned` / `post-MVP`; pain-mapping rows link back as `Closes #…` evidence.
