#!/usr/bin/env bash
# Run Lighthouse desktop + mobile against local preview of /simulate/.
# Asserts plan §1 KRs: Perf 85+ (desktop), A11y 95+.
#
# Usage:
#   npm run build && bash scripts/lighthouse-simulate.sh
#
# Requires:
#   - npm run preview running on :4321 (script will NOT start it)
#   - @anthropic/claude env has Chrome / Chromium available
set -euo pipefail

URL="${1:-http://localhost:4321/simulate/}"
OUT_DIR="${OUT_DIR:-/tmp}"

echo "→ Lighthouse scan: $URL"

run() {
  local preset="$1"
  local label="$2"
  local out="$OUT_DIR/lh-$preset.json"
  npx --yes lighthouse@latest "$URL" \
    --only-categories=performance,accessibility,best-practices \
    --output=json --output-path="$out" --quiet \
    --chrome-flags="--headless --no-sandbox" \
    --preset="$preset" 2>/dev/null
  jq -r --arg l "$label" \
    '.categories | "\($l): perf=" + (.performance.score|tostring) + " a11y=" + (.accessibility.score|tostring) + " bp=" + (."best-practices".score|tostring)' \
    "$out"
}

run "desktop" "desktop"
run "perf" "mobile"

echo ""
echo "Plan targets: Perf 85+ (desktop), A11y 95+ (both)."
