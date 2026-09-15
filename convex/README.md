# convex/ — backend

Full schema lives in `schema.ts` (10 tables, including `magicTokens` and
`adminAudit`). Per-domain functions sit beside it.

## First run

```bash
bunx convex dev   # provisions a dev deployment, generates convex/_generated/
```

`_generated/` is codegen output and is committed (like the reference
portal). `tsconfig.json` includes `convex/**/*.ts` and `bun run test` runs
both unit and convex projects.

## Files

| File | Purpose |
|------|---------|
| `schema.ts` | owners, pets, documents, vaccinations, medications, vetVisits, reminders, shareLinks, magicTokens, adminAudit |
| `pets.ts` | listByOwner, get, create, update, archive |
| `documents.ts` | generateUploadUrl, create, listByPet, getUrl, rename, trash/restore/empty |
| `vaccinations.ts` | listByPet, dueSoon, create, markAdministered |
| `medications.ts` | listByPet, create, setStatus |
| `vetVisits.ts` | listByPet, create, attachDocument |
| `reminders.ts` | listByOwner, listByPet, create, setStatus |
| `shareLinks.ts` | createToken, listByPet, revoke, resolve (public), recordView |
| `http.ts` | HTTP router placeholder |
| `resend.ts` | shared Resend sender (`sendEmail` internal action; reads RESEND_API_KEY + RESEND_FROM; gated by the daily outbox quota) |
| `outboxQuota.ts` | daily outbound email counter (atomic increment, UTC day rollover, 429 handling, `status` for UI) |
| `magicLink.ts` | passwordless auth (`requestMagicLink` action, `verifyMagicLink` mutation; needs `magicTokens` table below) |

## Auth (magic link)

Server-only — never import `resend.ts` / `magicLink.ts` from `src/`.

- `requestMagicLink({ email })` (action): normalizes + validates the email,
  enforces a 60s resend cooldown per email, mints a 32-byte hex token, stores
  only its SHA-256 hash (15-min expiry, single-use via `usedAt`), and emails
  `${SITE_URL}/sign-in?token=...&email=...` via `internal.resend.sendEmail`.
  Always returns `{ ok: true }` — even for invalid emails, cooldown hits, or
  send failures — to avoid account enumeration. Never throws for missing
  email config.
- `verifyMagicLink({ email, token })` (mutation): hashes the token, looks it
  up scoped to the email (only the `by_email` index is needed), rejects
  unknown/expired/already-used links, marks the token used, then
  find-or-creates the `owners` row (`externalId` = email, `name` = email
  prefix, `createdAt`) and returns `{ ok: true, ownerId }`
  (or `{ ok: false, error }`).

## Magic tokens table

`magicTokens` lives in `schema.ts` (added after the first codegen run unblocked
`bunx convex dev`):

```ts
magicTokens: defineTable({
  email: v.string(),
  tokenHash: v.string(),
  expiresAt: v.number(),
  usedAt: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_email", ["email"]),
```

## Daily email quota (`outboxQuota`)

One `outboxQuota` row per UTC day; `resend.sendEmail` checks remaining before
sending, increments after a successful send, and marks the day exhausted when
Resend answers 429 (quota failures return `{ ok: false, error: "quota" }`).
Callers surface the state via `outboxQuota:status { day }` (public), or the
optional `quota` field on `resend:status` / `integrations:status` when the
client passes the current UTC day (`utcDayKey()` in `src/lib/utils.ts`).
Reminder emails that fail on quota stay `scheduled` and raise one
`reminder_queued` in-app notification per reminder per day.

```ts
outboxQuota: defineTable({
  day: v.string(),          // "YYYY-MM-DD" (UTC)
  sent: v.number(),
  exhaustedAt: v.optional(v.number()),
  updatedAt: v.number(),
}).index("by_day", ["day"]),
```

## Convex env vars

Convex env ≠ Netlify env — set these on the Convex deployment (never commit
secrets; never use `NEXT_PUBLIC_*` for the API key):

```bash
bunx convex env set RESEND_API_KEY re_…
bunx convex env set RESEND_FROM "PetDocs <hello@yourdomain.com>"
bunx convex env set SITE_URL http://localhost:3000   # prod: https://your-app-url
bunx convex env set RESEND_DAILY_LIMIT 100           # optional; default 100 (free tier)
```

`SITE_URL` defaults to `http://localhost:3000` when unset. Missing
`RESEND_API_KEY` / `RESEND_FROM` does not crash login — `sendEmail` returns
`{ ok: false, error }` and `requestMagicLink` still returns `{ ok: true }`.
