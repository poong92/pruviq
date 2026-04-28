#!/bin/bash
# post-merge-verify.sh — production health check after a PR-batch merge.
#
# Run this after a multi-PR queue drain to verify pruviq.com is sane:
#   - Home + KO home reachable (200 OK)
#   - Critical pages (simulate, strategies, ranking, performance, coins,
#     trust, market, leaderboard) reachable in EN + KO
#   - api.pruviq.com /health, /rankings/daily, /trust/metrics, /hot-strategies
#   - OG image endpoints (sample) reachable + non-zero PNG
#   - Critical strings present (verifies no white-screen / blank deploy)
#   - PWA manifest + service worker reachable
#
# Used after the design-overhaul PR batch (#1448-#1461) merges, to catch
# regressions that the per-PR CI didn't catch (cross-PR interaction).
#
# Exit code: 0 = all checks pass, 1 = any check failed (count printed at end).
#
# Usage:
#   bash scripts/post-merge-verify.sh             # checks production
#   BASE=http://localhost:4321 bash scripts/post-merge-verify.sh   # local dev

set -u

BASE="${BASE:-https://pruviq.com}"
API="${API:-https://api.pruviq.com}"

# colors
GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[0;33m'
RESET=$'\033[0m'

PASS=0
FAIL=0
FAILED_URLS=()

# check_url <url> [<expected_substring>]
# Verifies HTTP 200 + (optional) substring presence.
check_url() {
  local url="$1"
  local needle="${2:-}"
  local body
  local code
  # -L follow redirects, -s silent, -w status code
  body=$(curl -sL -o /tmp/post-merge-verify.body -w "%{http_code}" --max-time 15 "$url" || echo "000")
  code="$body"
  if [ "$code" != "200" ]; then
    echo "${RED}✗${RESET} $url → HTTP $code"
    FAIL=$((FAIL + 1))
    FAILED_URLS+=("$url (HTTP $code)")
    return 1
  fi
  if [ -n "$needle" ]; then
    if ! grep -q -F "$needle" /tmp/post-merge-verify.body; then
      echo "${RED}✗${RESET} $url → 200 but missing \"$needle\""
      FAIL=$((FAIL + 1))
      FAILED_URLS+=("$url (missing: $needle)")
      return 1
    fi
  fi
  echo "${GREEN}✓${RESET} $url"
  PASS=$((PASS + 1))
  return 0
}

# check_image <url> <min_bytes>
# Verifies HTTP 200 + Content-Type image/(png|jpeg) + size >= min_bytes.
# Accepts both — /og-image.jpg is JPEG legacy, /og/*.png are satori output.
check_image() {
  local url="$1"
  local min_bytes="$2"
  local size
  local headers
  headers=$(curl -sIL --max-time 15 "$url" || echo "")
  if ! echo "$headers" | head -1 | grep -q "200"; then
    echo "${RED}✗${RESET} $url → not 200"
    FAIL=$((FAIL + 1))
    FAILED_URLS+=("$url (not 200)")
    return 1
  fi
  if ! echo "$headers" | grep -iqE "content-type:.*image/(png|jpe?g)"; then
    echo "${RED}✗${RESET} $url → not image"
    FAIL=$((FAIL + 1))
    FAILED_URLS+=("$url (not image)")
    return 1
  fi
  size=$(echo "$headers" | grep -i "content-length:" | head -1 | tr -d '\r' | awk '{print $2}')
  if [ -n "$size" ] && [ "$size" -lt "$min_bytes" ]; then
    echo "${RED}✗${RESET} $url → ${size} bytes (< $min_bytes)"
    FAIL=$((FAIL + 1))
    FAILED_URLS+=("$url (${size}B)")
    return 1
  fi
  echo "${GREEN}✓${RESET} $url (${size:-?} bytes)"
  PASS=$((PASS + 1))
  return 0
}

# check_optional <url> <expected_substring>
# Like check_url but missing-pages count as ${YELLOW}WARN${RESET}, not fail.
# Use for assets that may not be deployed yet (PWA, future endpoints).
check_optional() {
  local url="$1"
  local needle="${2:-}"
  local body code
  body=$(curl -sL -o /tmp/post-merge-verify.body -w "%{http_code}" --max-time 15 "$url" || echo "000")
  code="$body"
  if [ "$code" = "200" ]; then
    if [ -n "$needle" ] && ! grep -q -F "$needle" /tmp/post-merge-verify.body; then
      echo "${YELLOW}⚠${RESET}  $url → 200 but missing \"$needle\" (not yet deployed?)"
      return 0
    fi
    echo "${GREEN}✓${RESET} $url"
    PASS=$((PASS + 1))
  else
    echo "${YELLOW}⚠${RESET}  $url → HTTP $code (optional — not yet deployed?)"
  fi
  return 0
}

echo "=== post-merge verify (BASE=$BASE, API=$API) ==="
echo ""

echo "── Critical pages — EN ──"
check_url "$BASE/" "PRUVIQ"
check_url "$BASE/simulate" "PRUVIQ"
check_url "$BASE/strategies" "PRUVIQ"
check_url "$BASE/strategies/ranking" "PRUVIQ"
check_url "$BASE/performance" "PRUVIQ"
check_url "$BASE/coins" "PRUVIQ"
check_url "$BASE/trust" "PRUVIQ"
check_url "$BASE/market" "PRUVIQ"
check_url "$BASE/leaderboard" "PRUVIQ"
check_url "$BASE/about" "PRUVIQ"
check_url "$BASE/methodology" "PRUVIQ"
check_url "$BASE/fees" "PRUVIQ"

echo ""
echo "── Critical pages — KO ──"
check_url "$BASE/ko/" "PRUVIQ"
check_url "$BASE/ko/simulate" "PRUVIQ"
check_url "$BASE/ko/strategies" "PRUVIQ"
check_url "$BASE/ko/strategies/ranking" "PRUVIQ"
check_url "$BASE/ko/performance" "PRUVIQ"
check_url "$BASE/ko/coins" "PRUVIQ"
check_url "$BASE/ko/trust" "PRUVIQ"
check_url "$BASE/ko/market" "PRUVIQ"
check_url "$BASE/ko/about" "PRUVIQ"
check_url "$BASE/ko/methodology" "PRUVIQ"
check_url "$BASE/ko/fees" "PRUVIQ"

echo ""
echo "── API endpoints ──"
check_url "$API/health" "status"
check_url "$API/rankings/daily?period=30d&group=top50" "top3"
check_url "$API/trust/metrics" "trades_24h"
check_url "$API/hot-strategies" "strategies"

echo ""
echo "── OG images (build-time satori) ──"
check_image "$BASE/og-image.jpg" 5000
check_image "$BASE/og/home.png" 10000
check_image "$BASE/og/simulate.png" 10000
check_image "$BASE/og/strategies/bb-squeeze-short.png" 10000

echo ""
echo "── PWA assets (optional — PR #1429/#1441 not yet merged) ──"
check_optional "$BASE/manifest.webmanifest" "PRUVIQ"
check_optional "$BASE/sw.js" "self.addEventListener"

echo ""
echo "── Critical content checks (catches white-screen regressions) ──"
# Strategies index renders strategy cards — sanity name check
check_url "$BASE/strategies" "BB Squeeze"
# Trust page renders metric labels (no white-screen / no JS error)
check_url "$BASE/trust" "Slippage"
# KO home renders Korean H1 (i18n routing works)
check_url "$BASE/ko/" "검증"
# Reveal CSS class — homepage now has reveal sections (#1455 in queue)
check_optional "$BASE/" "class=\"reveal"

echo ""
echo "── /events telemetry endpoint (P1 fix verification, 2026-04-28) ──"
# Valid event → 204 (Cloudflare Pages Advanced Mode bypasses functions/, so
# routing must live in public/_worker.js).
EVENTS_VALID_CODE=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$BASE/events" \
  -H "Content-Type: application/json" \
  -d '{"type":"sim.view","ts":1}' || echo "000")
if [ "$EVENTS_VALID_CODE" = "204" ]; then
  echo "${GREEN}✓${RESET} POST $BASE/events {sim.view} → 204"
  PASS=$((PASS + 1))
else
  echo "${RED}✗${RESET} POST $BASE/events {sim.view} → HTTP $EVENTS_VALID_CODE (expected 204) — telemetry funnel dropping data"
  FAIL=$((FAIL + 1))
  FAILED_URLS+=("POST /events sim.view (HTTP $EVENTS_VALID_CODE)")
fi
# Invalid event type → 400 (closed event set)
EVENTS_INVALID_CODE=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$BASE/events" \
  -H "Content-Type: application/json" \
  -d '{"type":"bogus.unknown"}' || echo "000")
if [ "$EVENTS_INVALID_CODE" = "400" ]; then
  echo "${GREEN}✓${RESET} POST $BASE/events {bogus.unknown} → 400 (closed event set enforced)"
  PASS=$((PASS + 1))
else
  echo "${YELLOW}△${RESET} POST $BASE/events {bogus.unknown} → HTTP $EVENTS_INVALID_CODE (expected 400)"
  FAIL=$((FAIL + 1))
  FAILED_URLS+=("POST /events bogus (HTTP $EVENTS_INVALID_CODE)")
fi

echo ""
echo "=== Result: ${GREEN}${PASS} pass${RESET} · ${RED}${FAIL} fail${RESET} ==="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "${RED}FAILED${RESET}:"
  for u in "${FAILED_URLS[@]}"; do
    echo "  - $u"
  done
  exit 1
fi

echo "${GREEN}ALL PASS${RESET}"
exit 0
