# 17 - Company Email (shared team inbox)

## For Angela (what you get)

Company email works like adventurers-tech: a shared team inbox, not personal mailboxes.

* `support@` and `hello@` on your domain are shared `mailAccounts`.
* Staff read and reply from `/dashboard/admin/mail` by role (`support` and up).
* Pet owners never see this inbox. They only get magic links and reminders from `RESEND_FROM`. See doc 10 for sending.
* You need a verified domain first. For DNS basics see [10-resend-setup.md](10-resend-setup.md). This doc does not repeat them.

## How it works

1. Someone emails `support@yourdomain.com`.
2. Resend inbound route forwards it to `{convexSite}/resend/inbound`.
3. Convex verifies the request with Svix using `RESEND_WEBHOOK_SECRET`.
4. Convex routes by exact address match to the matching `mailAccount`.
5. Unmatched mail uses the holding pattern: it is held under the first active account, labeled with the original recipient, and auto-claimed when you create that mailbox later. No inbound mail is dropped.

Outbound replies send from the same shared account through Resend, so threads stay in one place.

## Setup for Angela (click path)

1. Verify your domain. Follow doc 10 until Resend shows Verified.
2. In Resend dashboard go to Inbound, add a route for your domain.
3. For the webhook URL: open Convex dashboard, pick your deployment, copy the HTTP Actions URL, add `/resend/inbound` at the end, paste it into the Resend route.
4. Copy the route signing secret from Resend, then set it per deployment:
```bash
bunx convex env set RESEND_WEBHOOK_SECRET whsec_your_secret
```
Do this on dev and on prod separately.
5. Open `/dashboard/admin/mail` and create two accounts: `support@yourdomain.com` and `hello@yourdomain.com`.
6. Send a test from your personal email to `support@yourdomain.com`. It should appear in the admin mail page within a minute.

If the test does not arrive: check Resend Inbound logs, check Convex logs for verify failures, and confirm the secret is set on the same deployment as the webhook URL.

## Env list

Set each key on every Convex deployment. Convex env only, never Netlify:

```bash
bunx convex env set RESEND_API_KEY re_your_key
bunx convex env set RESEND_FROM "PetDocs <hello@yourdomain.com>"
bunx convex env set RESEND_WEBHOOK_SECRET whsec_your_secret
bunx convex env set ADMIN_EMAILS "you@yourdomain.com"
```

* `RESEND_API_KEY`: send and reply delivery.
* `RESEND_FROM`: owner-facing sender for magic links and reminders.
* `RESEND_WEBHOOK_SECRET`: Svix verification for inbound. Without it, inbound is rejected.
* `ADMIN_EMAILS`: who can access the admin mail page. Comma separated.

## Limits (honest MVP scope)

* Team inbox only. No per-owner mailboxes, no attachment viewer yet, no filters or rules yet.
* Spam is handled by Resend inbound filtering. There is no extra spam UI in PetDocs.
* Retention follows the vault policy in doc 15. Mail follows the same delete and audit rules as documents.
* Owners reply by email at most by writing to support@. There is no owner-facing message center in MVP.
