# Billing — Polar.sh setup runbook (issue #33, supersedes Stripe #11)

PetDocs uses [Polar.sh](https://polar.sh) for checkout, webhooks, and
entitlements. There is no official `@polar-sh/convex` component, so the
integration is Convex-native raw `fetch` + a Standard Webhooks-verified
webhook route. **No Stripe anywhere.**

```
Browser/Dashboard ──▶ polar.createCheckout (action, raw fetch)
                        │  POST https://api.polar.sh/v1/checkouts/
                        ▼
                 Polar hosted checkout ─── success_url ──▶ /dashboard
                        │
                        ▼ (webhook events)
POST https://<deployment>.convex.site/polar/webhook
  └─ convex/polarHttp.ts  (signature verify, fail closed)
      └─ internal.polar.syncSubscription / linkCheckoutCustomer / detachCustomer
          └─ owners.billingTier / polarCustomerId / polarSubId / currentPeriodEnd
              └─ convex/billing.ts requireTier / requireWithinLimit gates
```

## 1. One-time Convex env setup (owner runs; placeholders until then)

Convex env ≠ Netlify env. These live per Convex deployment:

```sh
# dev deployment first, then repeat with --prod after go-live sign-off
bunx convex env set POLAR_ACCESS_TOKEN <token-from-polar-dashboard>
bunx convex env set POLAR_WEBHOOK_SECRET <whsec_...-from-polar-webhook-endpoint>
bunx convex env set POLAR_ORG_ID <org-id-from-polar-settings>
bunx convex env set POLAR_PRODUCT_ID_PLUS <uuid-of-plus-product>
bunx convex env set POLAR_PRODUCT_ID_FAMILY <uuid-of-family-product>

# optional
bunx convex env set POLAR_API_BASE https://sandbox-api.polar.sh   # sandbox testing
```

Or run the placeholder script (dry-run by default, never invents secrets):

```sh
POLAR_ACCESS_TOKEN=... POLAR_WEBHOOK_SECRET=... POLAR_ORG_ID=... \
POLAR_PRODUCT_ID_PLUS=... POLAR_PRODUCT_ID_FAMILY=... \
./scripts/setup-polar-env.sh            # prints the commands
./scripts/setup-polar-env.sh --apply    # actually sets them on the dev deployment
```

Check status anytime: superadmin → `/dashboard/admin/integrations` shows
which Polar keys are set (`integrations:status` never returns values).

## 2. Polar dashboard setup

1. Create two products: **PetDocs Plus** and **PetDocs Family**
   (monthly + annual prices per the pricing page). Copy their product ids
   into `POLAR_PRODUCT_ID_PLUS` / `POLAR_PRODUCT_ID_FAMILY`.
2. On each product, add metadata `tier` = `plus` / `family`. That metadata
   flows through checkout → subscription webhooks and is the primary tier
   signal. (Product-id env mapping is the fallback; with neither set every
   paid subscription maps to `plus`.)
3. Create a webhook endpoint with URL
   `https://<deployment>.convex.site/polar/webhook`
   (find the exact site URL in the Convex dashboard → HTTP Actions).
   Subscribe to: `subscription.created`, `subscription.updated`,
   `subscription.active`, `subscription.canceled`, `subscription.past_due`,
   `subscription.revoked`, `checkout.confirmed`, `customer.deleted`.
   Copy the signing secret (`whsec_…`) into `POLAR_WEBHOOK_SECRET`.

## 3. Tiers + limits (source of truth: `convex/billing.ts`)

| | Free | Plus | Family |
|---|---|---|---|
| Active pets | 1 | 5 | 10 |
| Documents | 25 | unlimited | unlimited |
| Active share links | 1 | unlimited | unlimited |
| Receipts | — | Polar email | Polar email |

- Archived pets and revoked links free up slots (limits count active rows).
- A paid tier stays active until `currentPeriodEnd` passes — scheduled
  cancellations and `past_due` keep access through the paid period.
  `subscription.revoked` (and `customer.deleted`) drop to `free` immediately.
- Gating surfaces wired today: `pets.create`, `shareLinks.createToken`
  (`requireWithinLimit`); `requireTier(ctx, ownerId, "plus")` is the hook
  for upcoming premium features (AI helper, OCR, SMS alerts).
- Dashboard read model: `billing.billingStatus({ ownerId })` returns
  `{ tier, limits, currentPeriodEnd }` (no secrets).

## 4. Entitlement state on `owners`

Only webhook-verified code writes these fields — never client args:

```ts
billingTier:    "free" | "plus" | "family"   // optional, undefined = free
polarCustomerId: string                      // indexed: by_polarCustomerId
polarSubId:      string
currentPeriodEnd: number                     // epoch ms; expiry → free
```

Tier mapping precedence: subscription `metadata.tier` → product-id env →
`plus` fallback (see `convex/polar.ts: tierFromMetadata`).

## 5. Security posture

- Webhook fails **closed**: without `POLAR_WEBHOOK_SECRET` every event is
  rejected (503). Bad signatures → 401. Optional `POLAR_ORG_ID` drops
  foreign-org events.
- Constant-time digest compare, 5-minute timestamp tolerance, raw body
  signing per Standard Webhooks (Polar-compatible, same scheme as the
  Resend/Svix receiver in `convex/http.ts`).
- Handler errors are logged + ack'd 200 so Polar does not retry-loop a
  permanent local failure; syncs are idempotent upserts so retries are safe.
- Checkout creation verifies the caller's email against the owners row
  before calling Polar.

## 6. Tests (no live Polar calls)

`convex/polar.test.ts` covers: webhook signature verify (valid / wrong
secret / tampered / stale / malformed), entitlement sync (grant, revoke,
past_due grace, unknown customer), tier + limit gating (allow/deny per
tier), and the checkout request builder/parse (mocked, pure functions).
Run: `bun run test:convex`.

## 7. Follow-ups (not in this PR)

- Upgrade UI: settings billing card + pricing CTA calling
  `api.polar.createCheckout` and redirecting to the returned URL.
- Self-serve cancel via Polar customer portal link in Settings.
- `subscription.past_due` in-app notice (dunning copy).
- $9 travel packet one-time checkout.
