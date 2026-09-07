# 10 — Resend Setup (magic links + reminders)

petdocs sends two emails through Resend, both via the shared sender
`convex/resend.ts` (`sendEmail` internal action):

- Magic links: `convex/magicLink.ts` `requestMagicLink` (subject `Sign in to PetDocs`)
- Reminders: `convex/reminders.ts` `sendDue` (subject `Reminder: {title} for {pet}`)

Server only. Never import `resend.ts` / `magicLink.ts` from `src/`.

## 1. Domain setup

1. Resend dashboard → Domains → Add domain, enter your sending domain.
2. Add every DNS record Resend shows (typically an SPF TXT, a DKIM TXT set,
   and a DMARC TXT), then press Verify in Resend.
3. Wait for status Verified before sending from that domain.

`RESEND_FROM` must use the verified domain, for example:

```bash
bunx convex env set RESEND_FROM "PetDocs <hello@yourdomain.com>"
```

## 2. Test-mode caveat

Until your domain is verified (and while the key is restricted), Resend only
delivers to the account owner address. A magic link requested for any other
address returns `{ ok: true }` but nothing arrives. Always test with your own
Resend account email first.

## 3. Env per deployment

Convex env is separate from Netlify env. Set each key on every Convex
deployment (dev and prod separately). Never commit secrets.

```bash
bunx convex env set RESEND_API_KEY re_your_key
bunx convex env set RESEND_FROM "PetDocs <hello@yourdomain.com>"
bunx convex env set SITE_URL http://localhost:3000   # prod: https://your-app-url
```

`SITE_URL` defaults to `http://localhost:3000` when unset. It builds the
magic-link URL (`/sign-in?token=...&email=...`) and the reminder
`Open petdocs` button link.

## 4. How to test

1. Run `bunx convex dev` and open the app sign-in page.
2. Submit your own Resend account email via `requestMagicLink`.
3. Check your inbox (and spam). The response is always `{ ok: true }` by
   design, so the inbox is the only signal.
4. Check Convex dashboard → Logs for `Resend error {status}` lines if mail
   does not arrive. Common causes: wrong deployment env, unverified domain,
   `RESEND_FROM` on a domain you do not own.
5. For reminders: create a reminder due within 24h, then run the
   `internal.reminders.sendDue` action from the Convex playground and confirm
   the count plus inbox delivery.

## 5. Rate limits and cooldowns already in code

- Magic links: 60s resend cooldown per email (`RESEND_COOLDOWN_MS`), 15-min
  single-use tokens (SHA-256 hash stored, raw token never stored).
- `requestMagicLink` always returns `{ ok: true }`, even for invalid emails,
  cooldown hits, or send failures, to avoid account enumeration.
- Reminders: hourly cron tick (`convex/crons.ts`), 24h horizon; a reminder
  flips `scheduled` to `sent` only when `sendEmail` returns `{ ok: true }`,
  so failures stay scheduled and retry next hour.
- Resend also enforces its own per-plan sending limits. See the Resend
  dashboard if volume grows.

## 6. What breaks without keys (verified in code)

- `sendEmail` never throws for missing config. It returns
  `{ ok: false, error }` (missing `RESEND_API_KEY` or `RESEND_FROM`,
  empty recipient, empty content, non-2xx with `Resend error {status}`,
  network failure). It never logs secrets.
- Login does not crash without keys: `requestMagicLink` catches send
  failures and still returns `{ ok: true }`. Truthfully, sign-in still
  stalls because no email arrives, so the user can never get the link.
- `verifyMagicLink` sends no email and is unaffected by Resend config.
- Reminders without keys: `sendDue` returns `0`, rows stay `scheduled`,
  next hourly tick retries.
