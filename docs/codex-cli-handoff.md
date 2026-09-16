# Codex CLI release handoff

Updated 2026-09-16. This is the handoff for the next Codex CLI session in
`/Users/fource/bytecats/adventurers/petdocs`.

## Release state

`origin/main` was stable at `0929b25` before this follow-up pass. The local
release candidate also includes the previously reviewed commits:

- `e87652f` — close the pet profile editor after a successful save and keep
  the optimistic rename from being overwritten by a stale refetch.
- `5f33b9e` — stabilize share/mobile E2E helpers and add the missing nested
  `reminders:listByPet` mock response.
- `b1a7ef5` — follow the nested Documents tool route and UI-kit comboboxes in
  the document E2E helper.
- `b894fea` — wait for the nested document route and file input instead of
  relying on non-waiting `isVisible({ timeout })` probes.

PRs #51, #54, and #56 are merged. The prior release PRs are merged as well;
`gh pr list --state open` is empty. This pass adds the local demo-role login
shortcuts, seeded staff-role fixtures, the seeded-owner magic-link fix, a
gallery/preview document surface, phone input formatting, and the light-mode
dashboard form fix.

The local checks are green, so Netlify build jobs are ready to be enabled once
this release candidate is pushed to `main`. No production Convex deploy was
run; production deploys remain human-run from `main` only.

## Verification evidence

Run from the release candidate, serially where noted:

- `bun run lint` — passed.
- `bun run typecheck` — passed after the production build completed.
- `bun run test` — 31 files, 303 tests passed.
- `bun run build` — passed; all current App Router routes compiled.
- Focused regression flows — demo-role and gallery assertions passed.
- Full Playwright suite — 62 passed, 1 skipped out of 63. The skip is the
  Gmail/threading integration case that requires its external mail environment.

The full E2E suite uses the dev Convex deployment and local route mocks where
specified. It does not exercise production data. Magic-link tests may report
the honest dev Resend quota state while still validating the minted preview
link.

## Local demo role setup

Run the seed against the same non-production Convex deployment used by the
local app (`bun run seed`; use the existing `seedDemo` reset path when
refreshing it). On `http://localhost`, `/sign-in` shows buttons for Maya, Sam,
auditor, support, manager, team owner, and superadmin. Each button requests a
normal single-use magic link; no demo shortcut is rendered in production.

Maya and Sam carry the pet fixtures. Staff-role accounts carry the admin
fixtures. Documents remain a UI upload step because storage blobs cannot be
fabricated in a database seed.

## Next-session start

```sh
cd /Users/fource/bytecats/adventurers/petdocs
git fetch origin
git switch main
git status --short --branch
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
PORT=3129 bun run test:e2e:smoke
```

For a release decision, also run `PORT=3129 bun run test:e2e`. Stop any local
dev server before switching between `next dev` and `next build`; Next 16 writes
separate `.next/dev` and `.next/types` route outputs. `.next/`, `next-env.d.ts`,
and the Next-generated block in `AGENTS.md` are ignored/generated and must not
be committed.

## Production environment review

The prior OpenCode production audit verified that the production Convex
deployment is `https://hallowed-falcon-806.convex.cloud` and that these values
were present (values are intentionally not recorded here):

- `SITE_URL=https://petdocs.seridian.dev`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `POLAR_ACCESS_TOKEN`

The audit found these items missing or requiring owner confirmation before
billing/admin release:

- `SUPERADMIN_EMAILS`
- `RESEND_DAILY_LIMIT` (optional; defaults to 100, but set an intentional
  production limit)
- `POLAR_WEBHOOK_SECRET`
- `POLAR_ORG_ID`
- `POLAR_PRODUCT_ID_PLUS`
- `POLAR_PRODUCT_ID_FAMILY`

Only the owner should supply production values. Set them on Convex, never in
Netlify or `.env.local`, using the project’s documented production command,
for example:

```sh
bunx convex env set --prod KEY '<owner-provided-value>'
```

Review `RESEND_WEBHOOK_SECRET`, `OCR_API_URL`, and `OCR_API_KEY` separately if
inbound email or OCR is being enabled. Do not run `bunx convex deploy` from a
feature branch or from this handoff automatically.

## Product direction for the vet side

PetDocs is currently an owner-controlled records vault and shareable passport,
not a clinic EHR. The Epic-like ideas worth borrowing for veterinary use are
workflow and provenance, not medical decision-making:

1. Build a canonical chart/timeline with encounters, observations,
   procedures, source, author, timestamps, and revision history.
2. Add clinic intake, pre-visit packets, consent, and structured histories.
3. Turn extracted documents into reviewable discrete orders/results with units,
   dates, attribution, and correction history.
4. Add care plans, follow-up tasks, reminders, and owner/clinician
   instructions.
5. Add clinic workspaces, roles, co-owner/write access, comments,
   signatures/attestation, and a chart-read/write audit trail.
6. Add a versioned import/export contract with preview, deduplication, and
   provenance before attempting PMS/FHIR-style integrations.

Keep the product language and automation bounded: organize records and surface
missing information, but do not diagnose, triage, select treatment, or imply
that PetDocs replaces a veterinarian.

## Final gate

Push only after the local checks above pass, then confirm:

```sh
git status --short --branch
git log -1 --oneline
gh pr list --state open
git worktree list
```

The desired result is a clean `main` tracking `origin/main`, no open release
PRs, only the primary PetDocs worktree, and Netlify still untouched until the
owner explicitly enables the build jobs.
