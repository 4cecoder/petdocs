## Summary
<!-- What does this PR change? Link related issues. -->

## Checklist (bun only — do not use npm/yarn/pnpm)
- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test:unit` passes
- [ ] `bun run test:e2e:smoke` passes locally (or CI Playwright smoke is green)
- [ ] `bun run build` succeeds
- [ ] Web/Android parity checked against `docs/07-feature-parity.md`
- [ ] No secrets committed (no `.env.local`, tokens, keys, or `google-services.json`)
- [ ] Bun-only lockfile: `bun install --frozen-lockfile` is clean (no `package-lock.json`)
- [ ] CHANGELOG.md Unreleased entry added

## Preview / notes
<!-- Netlify Deploy Preview link, APK artifact link, or manual test notes. -->
