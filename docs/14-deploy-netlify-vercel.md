# 14 Deploy: Netlify and Vercel

petdocs is a standard Next.js 16 app. Deploy to Netlify or Vercel with zero code changes.

- Install is bun-only: `bun install --frozen-lockfile`.
- Build is `bun run build` (`next build`, see `netlify.toml` and `package.json` scripts).
- Security headers live in `next.config.ts` (`headers()`). Both platforms respect them, no extra config.

Full env rules: [.env.example](../.env.example). Convex env is separate from web host env.

## 1. The one frontend var

The web app needs exactly one public var:

- `NEXT_PUBLIC_CONVEX_URL`: URL of the Convex deployment to use (`dev`, `demo`, or `prod`).

Set it in the host dashboard (or CLI) per environment. Never commit real values. Copy `.env.example` to `.env.local` for local dev.

```bash
# local
cp .env.example .env.local
# then fill NEXT_PUBLIC_CONVEX_URL from `bunx convex dev` output
```

Backend secrets (`RESEND_API_KEY`, `RESEND_FROM`) are Convex-only. Set per Convex deployment, not in Netlify/Vercel:

```bash
bunx convex env set RESEND_API_KEY "re_xxx" --deployment demo
bunx convex env set RESEND_FROM "PetDocs <hello@yourdomain.com>" --deployment demo
```

## 2. Netlify path

`netlify.toml` already sets build command, publish dir, Node 22, and `@netlify/plugin-nextjs`. The plugin is auto-applied, no code change needed.

```bash
bun install --frozen-lockfile
netlify link  # connect local repo to the Netlify site once
bunx netlify env:set NEXT_PUBLIC_CONVEX_URL "https://xxx.convex.cloud"
bun run build  # sanity check, same command Netlify runs
bunx netlify deploy --build --prod
```

- Production site tracks `main`.
- Branch deploys: enable in Site settings > Build and deploy > Branches. Use a `demo` branch mapped to the demo Convex deployment for stakeholder review.
- Each Netlify context (production, branch, preview) can have its own `NEXT_PUBLIC_CONVEX_URL` value.

## 3. Vercel path

No config file needed. Import the repo in the Vercel dashboard.

1. Import `github.com/4cecoder/petdocs`.
2. Framework preset: Next.js. Build command: `bun run build`. Install command: `bun install --frozen-lockfile`.
3. Add Environment Variable `NEXT_PUBLIC_CONVEX_URL` in Project Settings > Environment Variables (set per Production, Preview, Development as needed).
4. Deploy. Every PR gets a Preview URL automatically.

```bash
bun install --frozen-lockfile
bun run build  # local parity check before push
vercel --prod  # optional CLI deploy, dashboard import is enough
```

## 4. Convex backend deploys separately

The web host only serves the frontend. Convex is deployed on its own, from `main` only.

```bash
bunx convex dev  # daily dev loop, dev deployment
bunx convex deploy  # demo/prod, human-run only, never from CI
```

- Keep Convex dashboard environments (`dev`, `demo`, `prod`) matched to web environments below.
- Frontend `NEXT_PUBLIC_CONVEX_URL` must point at the matching Convex deployment URL after each backend deploy.

## 5. Custom domains and sender alignment

- Add the custom domain in the host (Netlify: Domain settings, Vercel: Project Settings > Domains) with DNS as instructed.
- Set `SITE_URL` (app base URL used in links/emails) to the exact public URL of that environment.
- Set `RESEND_FROM` to an address on the verified sending domain for that environment (for example `PetDocs <hello@yourdomain.com>`).
- Mismatch symptom: magic links or passport links point at the wrong host, or Resend rejects the sender. Fix by realigning all three to the same environment domain.

## 6. Preview URL x backend matrix

| Frontend | `NEXT_PUBLIC_CONVEX_URL` points at | Use |
|---|---|---|
| Localhost (`bun run dev`) | dev Convex deployment | Daily dev |
| PR preview (Netlify Deploy Preview or Vercel Preview) | dev, or demo for data-safe review | Code review, never prod data |
| Branch deploy (`demo` branch) | demo Convex deployment | Stakeholder demo and seed data |
| Production (`main`) | prod Convex deployment | Real users only |

Rule: previews never point at prod Convex. Production frontend only points at prod Convex.

## 7. Rollback

- Netlify: Deploys page > pick prior successful deploy > Publish deploy. Instant.
- Vercel: Deployments tab > prior deployment > Promote to Production. Instant.
- Convex: backend has no instant web-style rollback. Use deployment history in the Convex dashboard to inspect, then fix forward with a new `bunx convex deploy` from `main`. Keep schema changes backward compatible so a frontend rollback still works.

Related: [03-architecture](03-architecture.md), [10-resend-setup](10-resend-setup.md), [AGENTS.md](../AGENTS.md).
