# Development workflow

Trunk-based development. `main` is always shippable; short-lived branches
land through squash merges after gates pass.

## Branch model: worktree per task

Work happens in a git worktree, never directly on `main`:

```sh
cd petdocs
git worktree add ../petdocs-<topic> -b <type>/<topic> main   # type: feat|fix|chore|sec
cd ../petdocs-<topic>
ln -s "$(pwd)/../petdocs/.env.local" .env.local   # worktrees share the real .env.local (gitignored)
bun install --frozen-lockfile
bun run hooks:install                             # one-time per clone (see below)
```

Rules:

* Branch from `main`, keep the lifetime short (days, not weeks).
* One PR per branch, one concern per PR.
* `bun` only. Never `npm`/`yarn`/`pnpm`, never commit `package-lock.json`.

## PR gates (all must be green before merge)

| Gate | Command | Notes |
|---|---|---|
| Types | `bun run typecheck` | `tsc --noEmit` |
| Lint | `bun run lint` | eslint on `src/` |
| Unit + convex | `bun run test` | vitest, both projects |
| Full e2e | `PORT=3111 bunx playwright test` | own server, dev deployment |

PRs merge by **squash merge** (`gh pr merge --squash`) so `main` stays a
clean, revertable line of single-purpose commits. Delete the branch after.

## Merge sequence

1. CI green on the PR (same four gates).
2. No unresolved review threads.
3. If the PR touches auth, authz, or anything under `convex/` that guards
   data, a second pair of eyes is required, not self-merge.
4. Squash merge. Never rebase-merge or merge-commit; history stays linear.

## Deployment (manual, from `main` only)

* **Convex prod**: a human runs `bunx convex deploy` from a clean `main`
  checkout. Never from a branch, never scripted into hooks or CI.
* **Frontend**: Netlify deploys from `main` automatically.
* **Convex env is not Netlify env.** Set secrets per deployment with
  `bunx convex env set KEY ...`; Netlify only needs frontend vars.

## Security fix rule

Never push `main` (and therefore never trigger a Netlify deploy) while a
known CRITICAL security fix is still open in review. Land the security fix
first, even if it means holding other PRs; a deploy must never ship a
`main` that is known-vulnerable. If `main` somehow contains a regression,
the revert lands before any deploy.

## Hotfixes

1. Branch `fix/<topic>` from `main`, fix, add a regression test in
   `tests/e2e/regression.spec.ts`, open a PR.
2. Squash merge after fast-tracked review.
3. Deploy prod Convex manually (see above).
4. If a release branch ever exists, backport with
   `git cherry-pick -x <sha>` (keeps the source commit reference), PR the
   cherry-pick, never cherry-pick merge commits.

## Git hooks

Plain POSIX sh in `.githooks/`, no husky/lefthook dependency. Install once
per clone (and once per worktree, config is shared):

```sh
bun run hooks:install     # git config core.hooksPath .githooks
```

| Hook | Runs | Budget |
|---|---|---|
| `pre-commit` | eslint on staged JS/TS + `tsc --noEmit` | seconds |
| `pre-push` | `bun run test` (vitest) + `@smoke` e2e on `PORT=3111` (own server) | under ~90s warm |

Emergencies: skip with `git commit --no-verify` / `git push --no-verify`.
That is for emergencies only; CI reruns everything on the PR, and a red
CI from a skipped hook is on the author to fix immediately.

## Dev environment rules for e2e

* The dev Convex deployment is `necessary-cod-965` (from `.env.local`,
  `CONVEX_DEPLOYMENT=dev:...`). e2e helpers hard-refuse any non-`dev:`
  target; nothing test-driven may ever touch prod.
* `bunx convex dev` runs in the owner terminal only; tests call one-shot
  `bunx convex run` (CLI) or the public HTTP API, never their own dev.
* e2e uses `PORT=3111` so it never collides with the owner's dev server
  on :3000. Playwright boots its own Next server when none is listening.
* `.env.local` is gitignored; symlink it into worktrees (see above).
