# 09 - Stripe Compliance

Billing via Stripe. Plus $6.99/mo or $69/yr, Family $9.99/mo, $9 packets. B2C2B motion.

## Rules we follow

- Show full price, billing period, and renewal terms before the pay button.
- Disclose trial length, renewal price, cancel method, and refund window at checkout.
- Send a receipt for every charge (Stripe emails on, plus in app history).
- Offer self-serve cancellation in Settings, no email or call required.
- Publish Terms, Privacy, Refunds, and a support contact before going live. Stripe verification asks for these.
- Verify webhook signatures with the raw body and dedupe by event id.
- Never touch card numbers. Use Stripe Checkout or Elements only (SAQ-A scope).
- Collect tax with Stripe Tax once we sell outside our home state.
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
| Stripe webhook handler with signature verify + idempotency | todo | create `src/app/api/stripe/webhook/route.ts`, see `adventurers/vaylo/src/app/api/stripe/webhook/route.ts` |
| Billing state machine (checkout, portal, renew, cancel) | todo | create `convex/billing.ts`, see `adventurers/vaylo/convex/billing.ts` |
| Receipt emails via Stripe + Resend copy | todo | `convex/billing.ts`, Resend `receipts` template |
| Enable Stripe Tax at checkout | todo | Stripe Dashboard + checkout session params |
| Dunning for failed payments (3 retries + cancel notice) | todo | Stripe Billing retries + `convex/billing.ts` |
| Price change notice flow (30 days, email + in app) | todo | `convex/billing.ts`, `src/app/dashboard/settings/page.tsx` |
| Self-serve cancel in Settings via Customer Portal | todo | `src/app/dashboard/settings/page.tsx` |

## Webhook notes (when we build it)

- Use `stripe.webhooks.constructEvent(rawBody, sig, secret)` with the raw body. No JSON parse first.
- Store processed event ids and skip repeats.
- Handle `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- Never trust client success params. Grant access only from webhooks.

## PCI scope

- Card entry only in Stripe hosted UI (Checkout or Elements).
- Our servers see tokens and ids only, never PAN or CVC.
- That keeps us at SAQ-A. Adding any custom card field breaks this.
