# 18 - Operations runbook

Superadmin only. Developers see infra, Angela sees business. Page: `/dashboard/admin/integrations`.

## Env matrix per deployment

Set each key on every Convex deployment. Convex env only, never Netlify. Never commit secrets.

| Key | Dev | Prod | Used for |
|---|---|---|---|
| `RESEND_API_KEY` | yes | yes | magic links, reminders, replies, test email |
| `RESEND_FROM` | yes | yes | owner-facing sender, must use verified domain |
| `RESEND_WEBHOOK_SECRET` | yes | yes | Svix verify for inbound |
| `STRIPE_SECRET_KEY` | test key | live key | billing, planned webhook |
| `STRIPE_WEBHOOK_SECRET` | test secret | live secret | webhook verify, planned |
| `SITE_URL` | `http://localhost:3000` | public app URL | magic link and reminder links |
| `ADMIN_EMAILS` | dev emails | Angela plus devs | bootstrap superadmin |

```bash
bunx convex env set RESEND_API_KEY re_your_key
bunx convex env set RESEND_FROM "PetDocs <hello@yourdomain.com>"
bunx convex env set RESEND_WEBHOOK_SECRET whsec_your_secret
bunx convex env set SITE_URL https://your-app-url
bunx convex env set ADMIN_EMAILS "you@yourdomain.com"
```

## Webhook endpoints

Base is the Convex HTTP Actions URL from the Convex dashboard. Copy paths from the integrations page.

| Method | Path | Status | Secret |
|---|---|---|---|
| POST | `/resend/inbound` | live | `RESEND_WEBHOOK_SECRET` |
| POST | `/stripe/webhook` | planned | `STRIPE_WEBHOOK_SECRET` |

## Test inbox and test email

1. Create mailboxes in `/dashboard/admin/mail`: `support@` and `hello@` on your domain.
2. Send a personal email to `support@yourdomain.com`. It appears in the team inbox within a minute.
3. If it misses: check Resend Inbound logs, Convex logs for verify failures, secret on same deployment as URL.
4. Superadmin test: open `/dashboard/admin/integrations`, enter your Resend account email, Send test.
5. Until domain is verified, Resend delivers only to the account owner address. Test with that address first.

## Notifications, who gets what

| Kind | To | Trigger |
|---|---|---|
| `passport_view` | pet owner | share link viewed |
| `reminder_sent` | pet owner | reminder email sent |
| `claim_filed` | active staff | ownership claim filed |
| `inbound_mail` | active staff | inbound mail ingested |
| `transfer_redeemed` | pet owner | transfer code redeemed |
| `team_invite` | staff | reserved, currently unwired |

## Angela checklist

Never touches: keys, deploys, webhooks, Convex dashboard, DNS records.
Always does: invite staff with least privilege, review ownership claims, revoke wrong links, read audit log.

## Incident steps

1. Revoke active `shareLinks` for the affected pet first.
2. Rotate keys: Resend, Stripe, Convex deploy key. Set per deployment.
3. Force new magic links by asking owners to sign in again.
4. Audit: export `adminAudit`, confirm each `support` and `admin`, demote the rest.
5. Notify affected owners from support@ with what leaked, what was revoked, what to check.

## Code map

- `convex/integrations.ts`: `status`, `sendTestEmail`, superadmin only, no secrets returned.
- `convex/http.ts`: `/resend/inbound` with Svix verify.
- `convex/resend.ts`: shared sender plus public `status`.
- `src/app/dashboard/admin/integrations/page.tsx`: superadmin cards, copy buttons, test email.
