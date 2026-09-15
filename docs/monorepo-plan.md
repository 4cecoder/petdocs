# Monorepo plan (#34) — one repo, many clients

Status: **proposal** (groundwork only — this doc). Nothing has moved yet.

PetDocs is one product with several clients: the Next.js web dashboard, the
Android app (`android/`, this PR), a planned iOS app, and future shared
surface area (API contracts, design tokens, domain types). Today everything
lives in one repo with the web app at the root, and the Android project in
`android/` at top level.

## Current state (this PR)

```
petdocs/
├── src/                  # Next.js web app (root — Netlify deploys from here)
├── convex/               # backend (shared by web + mobile)
├── android/              # Android client (Kotlin + Compose), Gradle root
├── android-app/          # legacy prior Android attempt (to be removed once
│                         #   android/ reaches parity — see "Migration")
├── scripts/              # repo tooling (publish-apk.ts, setup-env.mjs)
└── docs/
```

Web stays at the repo root on purpose: Netlify builds from the root, `bun
run *` scripts assume it, and CI path filters already treat `android/**` as
a separate surface. Moving web into a subdirectory would churn Netlify
settings, `netlify.toml`, and every import path for zero product value
right now.

## Target layout (when it's worth it)

```
petdocs/
├── apps/
│   ├── web/              # Next.js app (moved from root)
│   └── android/          # Kotlin app (moved from android/)
├── packages/
│   ├── shared/           # API contracts: OpenAPI/schema-derived types
│   │                     #   + Kotlin DTO sources of truth
│   └── config/           # shared eslint/tsconfig/gradle conventions
├── convex/               # stays at root (backend is not a "client")
├── package.json          # bun workspaces root: apps/* + packages/*
└── docs/
```

### Why this shape

- **bun workspaces** (`workspaces: ["apps/*", "packages/*"]`) fit the
  existing bun-only rule; no new package manager, no Nx/Turborepo until
  task-graph caching actually pays for itself.
- **`packages/shared`** owns the mobile API contract: the request/response
  shapes defined in `convex/http.ts` (auth, /api/me, pet summary, builds)
  get a single source of truth from which TypeScript types and Kotlin DTOs
  are derived (or, pragmatically, kept in lockstep via contract tests on
  both sides).
- **Gradle stays self-contained** inside the Android app directory (its own
  wrapper, own settings.gradle.kts). Wrapping Gradle in a JS workspace must
  not leak Gradle/Caches into bun's dependency graph — the two toolchains
  only share CI.

## Migration phases

1. **Now (this PR):** `android/` at root; `android.yml` CI path-scoped to
   `android/**`; web gates stay root-scoped. Documented contract: mobile
   HTTP endpoints live in `convex/http.ts` + `convex/mobileAuth.ts`.
2. **Contract extraction:** extract the mobile API response shapes into
   `packages/shared` (TS types + generated Kotlin DTOs or a shared fixture
   file consumed by both sides' tests). Both clients' test suites assert
   against the same fixtures.
3. **Workspace split:** add bun workspaces; move web to `apps/web`
   (Netlify base directory change, `netlify.toml` update, `@/` alias
   becomes `apps/web/src`); move `android/` to `apps/android`. One PR per
   move, each keeping all gates green.
4. **Legacy cleanup:** delete `android-app/` (the cancelled prior attempt)
   once `android/` reaches the parity bar of `docs/20-android-parity.md`;
   re-point `docs/20-android-parity.md` at the new screens.

## Risks / notes

- Netlify root-build assumption is the main blocker for phase 3; phase 1–2
  are safe precisely because nothing moves.
- CI cost: path filters (`android/**`, `src/**`, `convex/**`) already keep
  the three pipelines from waking each other up.
- Convex is the shared backend for both clients — it stays at the root and
  is never nested inside a workspace package.
