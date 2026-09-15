# 09 - Billing Compliance (Polar.sh)

Billing via Polar.sh (supersedes the earlier Stripe approach — issue #33 closes #11). Polar acts as merchant of record for checkout and tax. Plus (monthly/annual) and Family tiers, $9 packets planned. Setup runbook: `docs/billing.md`.

## Rules we follow

- Show full price, billing period, and renewal terms before the pay button.
- Disclose trial length, renewal price, cancel method, and refund window at checkout.
- Send a receipt for every charge (Polar emails on, plus in app history).
- Offer self-serve cancellation in Settings, no email or call required.
- Publish Terms, Privacy, Refunds, and a support contact before going live. Payment processor verification asks for these.
- Verify webhook signatures with the raw body (Standard Webhooks HMAC) and stay idempotent by event type.
- Never touch card numbers. Card entry happens only in Polar's hosted checkout.
- Collect tax via Polar (merchant of record) once we sell outside our home state.
- Give 30 days notice before raising prices on existing subscribers.

## Checklist

| Requirement | Status | Where (file) |
|---|---|---|
| Public pricing with period and renewal terms | done | `src/app/(marketing)/pricing/page.tsx` |
| Cancel anytime copy in pricing fine print | done | `src/app/(marketing)/pricing/page.tsx` |
| Published refund window (monthly, annual, packets) | done | `src/app/(marketing)/legal/refunds/page.tsx` |
| Terms of Service published | done | `src/app/(marketing)/legal/terms/page.tsx` |
| Privacy Policy published | done | `src/app/(marketing)/legal/privacy/page.tsx` |
| Legal links in footer | done | `src/components/Footer.tsx` |
| Typed legal routes, no group leak | done | `src/lib/routes.ts` |
| Polar webhook handler with signature verify + idempotency | done | `convex/polarHttp.ts` (registered in `convex/http.ts`) |
| Billing state machine (checkout, renew, cancel, revoke) | done | `convex/polar.ts` + `convex/billing.ts` |
| Entitlement sync into `owners` billing fields | done | `convex/schema.ts` + `convex/billing.ts` |
| Tier gating on premium surfaces | done | `convex/billing.ts` (`requireTier`, `requireWithinLimit`) |
| Receipt emails via Polar + Resend copy | todo | Polar sends receipts; optional Resend copy later |
| Dunning for failed payments (retries + cancel notice) | todo | Polar retries natively; add in-app notice via `subscription.past_due` |
| Price change notice flow (30 days, email + in app) | todo | `convex/billing.ts`, `src/app/dashboard/settings/page.tsx` |
| Self-serve cancel in Settings via Polar customer portal | todo | `src/app/dashboard/settings/page.tsx` |
| $9 travel packet one-time checkout | todo | follow-up issue (metadata `tier` does not apply to one-time orders) |

## Webhook notes

- Endpoint: `POST /polar/webhook` on the Convex site URL, handler in `convex/polarHttp.ts`, registered in `convex/http.ts`.
- Standard Webhooks verification: HMAC-SHA256 over `webhook-id.webhook-timestamp.rawBody`, `whsec_` secret, constant-time compare, 5-minute timestamp window. Fail closed when the secret is unset.
- Handle `subscription.created|updated|active|canceled|past_due|revoked`, `checkout.confirmed`, `customer.deleted`. Everything else is ack'd and ignored.
- Never trust client success params. Grant access only from verified webhooks.
- Same event twice is safe: sync writes are pure upserts on `owners.billing*`.

## PCI scope

- Card entry only in Polar's hosted checkout.
- Our servers see Polar customer/subscription ids only, never PAN or CVC.
- Polar being merchant of record keeps card handling entirely off our compliance surface.
