#!/usr/bin/env bash
# Phase 2.2 — daily parity smoke for the trailing TP wire-up.
#
# Runs the integration tests that pin the simulator↔OKX request-shape
# parity. Two tests cover the regression surface:
#
#   T1: test_t1_trailing_signal_places_two_algo_legs
#       — trailing strategy emits SL conditional + move_order_stop.
#         callbackRatio == str(trail_pct/100) (the single seam between
#         simulator decimal-form and OKX decimal-string).
#
#   T5: test_t5_dry_run_endpoint_emits_no_okx_post
#       — /execute/dry-run produces the three request bodies with zero
#         POSTs. Trailing payload's callbackRatio matches the expected
#         decimal-string. Fixed-path branch returns null trailing payload.
#
# Drift in *either* test means a refactor or dependency bump silently
# changed how a real auto-trade signal would map to OKX. Phase 4
# production rollout pre-condition: 7 consecutive days of OK from this
# script (advisor parity-correctness scope; result-equivalence is
# unmeasurable since simulator uses 4h candle high/low and OKX live ticks).
#
# Cron entry suggestion (Mac Mini or DO):
#   0 0 * * *  /Users/jepo/pruviq/scripts/dry-run-monitor.sh >> /var/log/pruviq-dry-run-monitor.log 2>&1
#
# Telegram alert on FAIL — uses TELEGRAM_TOKEN + TELEGRAM_CHAT_ID env.
# Quietly OK on PASS so cron logs stay readable.

set -euo pipefail

REPO_ROOT="${PRUVIQ_REPO_ROOT:-$HOME/pruviq}"
LOG_FILE="${PHASE22_MONITOR_LOG:-/tmp/phase22-monitor.log}"

# Telegram alert is optional — script still fails (exit 1) if env vars
# are missing, so cron emails the operator. The notify_telegram helper
# is a best-effort layer on top.
notify_telegram() {
    local msg="$1"
    if [ -z "${TELEGRAM_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
        return 0
    fi
    curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${msg}" \
        -d "disable_web_page_preview=true" \
        > /dev/null 2>&1 || true
}

cd "$REPO_ROOT/backend"

# uv ephemeral env keeps the runtime hermetic — pinning Python 3.12
# avoids local interpreter drift dependening on which Mac/DO host runs
# the cron. Only the deps the tests actually need are pulled in.
if uv run \
    --with pytest \
    --with anyio \
    --with pydantic \
    --with httpx \
    --with cryptography \
    --with fastapi \
    --python 3.12 \
    python -m pytest \
        tests/test_auto_executor.py::test_t1_trailing_signal_places_two_algo_legs \
        tests/test_auto_executor.py::test_t5_dry_run_endpoint_emits_no_okx_post \
        -v \
    > "$LOG_FILE" 2>&1
then
    echo "OK: Phase 2.2 dry-run parity verified at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    exit 0
else
    msg="🚨 PRUVIQ Phase 2.2 dry-run parity DRIFT at $(date -u +%Y-%m-%dT%H:%M:%SZ) — log: ${LOG_FILE} on $(hostname)"
    notify_telegram "$msg"
    echo "$msg" >&2
    echo "--- Last 30 lines of test output ---"
    tail -30 "$LOG_FILE"
    exit 1
fi
