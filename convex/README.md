# convex/ — backend

Full schema lives in `schema.ts` (8 tables). Per-domain functions sit beside it.

## First run

```bash
bunx convex dev   # provisions a dev deployment, generates convex/_generated/
```

`_generated/` is codegen output (committed once it exists, like the reference
portal). Until then, `tsconfig.json` only includes `convex/schema.ts` and
`bun run test` only runs the `unit` project — widen both after codegen:

- `tsconfig.json` → add `"convex/**/*.ts"` to `include`
- `package.json` → `test` → `vitest run` (all projects)

## Files

| File | Purpose |
|------|---------|
| `schema.ts` | owners, pets, documents, vaccinations, medications, vetVisits, reminders, shareLinks |
| `pets.ts` | listByOwner, get, create, update, archive |
| `documents.ts` | generateUploadUrl, create, listByPet, getUrl, rename, trash/restore/empty |
| `vaccinations.ts` | listByPet, dueSoon, create, markAdministered |
| `medications.ts` | listByPet, create, setStatus |
| `vetVisits.ts` | listByPet, create, attachDocument |
| `reminders.ts` | listByOwner, listByPet, create, setStatus |
| `shareLinks.ts` | createToken, listByPet, revoke, resolve (public), recordView |
| `http.ts` | HTTP router placeholder |
| `resend.ts` | shared Resend sender (`sendEmail` internal action; reads RESEND_API_KEY + RESEND_FROM) |
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

## Schema addition (first codegen run)

`magicTokens` does not exist in `schema.ts` yet — `magicLink.ts` was written
before `bunx convex dev` codegen (which is also why `convex/_generated/` is
still missing). Do NOT hand-edit `schema.ts` now; add this table when codegen
first runs:

```ts
magicTokens: defineTable({
  email: v.string(),
  tokenHash: v.string(),
  expiresAt: v.number(),
  usedAt: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_email", ["email"]),
```

## Convex env vars

Convex env ≠ Netlify env — set these on the Convex deployment (never commit
secrets; never use `NEXT_PUBLIC_*` for the API key):

```bash
bunx convex env set RESEND_API_KEY re_…
bunx convex env set RESEND_FROM "PetDocs <hello@yourdomain.com>"
bunx convex env set SITE_URL http://localhost:3000   # prod: https://your-app-url
```

`SITE_URL` defaults to `http://localhost:3000` when unset. Missing
`RESEND_API_KEY` / `RESEND_FROM` does not crash login — `sendEmail` returns
`{ ok: false, error }` and `requestMagicLink` still returns `{ ok: true }`.
