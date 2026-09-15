#!/bin/sh
# Polar.sh billing env bootstrap for Convex (issue #33).
#
# Prints (or with --apply, runs) the `bunx convex env set` commands for the
# Polar billing keys. Placeholders are NEVER applied — the owner supplies
# real values from the Polar dashboard. See docs/billing.md for the full
# runbook (webhook endpoint, product metadata, sandbox).
#
# Usage:
#   ./scripts/setup-polar-env.sh                 # dry-run: print commands
#   ./scripts/setup-polar-env.sh --apply         # set on dev deployment
#   ./scripts/setup-polar-env.sh --apply --prod  # set on prod deployment
#
# Values come from the environment:
#   POLAR_ACCESS_TOKEN POLAR_WEBHOOK_SECRET POLAR_ORG_ID
#   POLAR_PRODUCT_ID_PLUS POLAR_PRODUCT_ID_FAMILY
#   POLAR_API_BASE (optional, e.g. https://sandbox-api.polar.sh)
set -eu

APPLY=0
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --prod) TARGET="--prod" ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

fail_missing() {
  echo "MISSING: $1 — get it from the Polar dashboard (see docs/billing.md)." >&2
}

run_set() {
  key="$1"
  value="$2"
  if [ -z "$value" ]; then
    fail_missing "$key"
    return 1
  fi
  if [ "$APPLY" = "1" ]; then
    echo "Setting $key..."
    bunx convex env set $TARGET "$key" "$value" >/dev/null
  else
    echo "bunx convex env set $TARGET $key <${key#POLAR_}>"
  fi
}

STATUS=0
for key in POLAR_ACCESS_TOKEN POLAR_WEBHOOK_SECRET POLAR_ORG_ID \
           POLAR_PRODUCT_ID_PLUS POLAR_PRODUCT_ID_FAMILY; do
  eval "value=\$$key"
  if [ -z "$value" ]; then
    STATUS=1
  fi
  run_set "$key" "$value" || true
done

# Optional override (sandbox). Only set when provided.
if [ -n "${POLAR_API_BASE:-}" ]; then
  run_set POLAR_API_BASE "$POLAR_API_BASE"
fi

if [ "$APPLY" = "1" ]; then
  echo "Done. Verify via /dashboard/admin/integrations (integrations:status)."
else
  echo
  echo "Dry run. Export the vars above and re-run with --apply to set them."
  echo "NEVER commit real values; Convex env is the only home for these keys."
fi

exit $STATUS
