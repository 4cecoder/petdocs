# Product direction (owner notes, 2026-09-15)

Captured from owner conversation. Feed into sprint planning.

## 1. Two-sided platform: pet owners + vets
- Vets get their own login into petdocs (not just receiving owner-shared links).
- Build on existing staff RBAC (convex/staff.ts) — vet is a role with clinic scope, not a full superadmin.
- Worth designing: clinic workspace → attached pets → vet-signed entries.

## 2. Manually-signed documents on the owner side
- Owners can manually enter records that were signed offline (paper/clinic printouts) — vet name, clinic, date, signature reference.
- Distinct from raw uploads (petlia's whole model): signed manual entries are structured + attributable.

## 3. Enterprise inbound API
- Clinics/enterprises push documents INTO petdocs via API (e.g. after a visit, clinic sends the record directly).
- Natural shape: HTTP action on convex/http.ts with scoped API keys per enterprise, idempotent ingest into documents table, optional owner-claim flow.
- Differentiator: petlia has no API and no vet surface at all (see petlia.md).

## Constraints / context
- Owner knows partner vets (relationship-led pilot later — product must be demoable first).
- Launch is a few sprints out; lander at petdocs.seridian.dev is live, prod backend deployed 2026-09-15.
- Email sender: no-reply@seridian.dev (Resend, domain verified).
