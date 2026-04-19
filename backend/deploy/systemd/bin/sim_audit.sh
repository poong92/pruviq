#!/bin/bash
# PRUVIQ — Simulator Audit (DO-native, runs every 6h via pruviq-sim-audit.timer)
#
# Runs tests/sim_audit.py and posts a Telegram alert when the python harness
# reports failures. The python script is the source of truth for exit code
# (sys.exit(1) when results["fail"] > 0) — this wrapper just propagates it.
#
# History: an earlier version parsed `grep -c "\[FAIL\]"` on the tee'd output.
# When the log had zero [FAIL] labels, grep exited 1, the `|| echo 0` fallback
# appended a second "0", `[ "0\n0" -gt 0 ]` printed "integer expression
# expected" to stderr, and the net effect was that systemd intermittently saw
# status=1/FAILURE on runs that actually passed. Worse, when a real failure
# slipped in (e.g. BTCUSDT indicator cache miss after OKX migration) the same
# bug silently suppressed it. Kill the grep logic entirely.
set -uo pipefail

REPO_DIR="/opt/pruviq/current"
VENV="/opt/pruviq/app/.venv/bin/python"
LATEST="/tmp/pruviq-sim-audit-latest.txt"

cd "$REPO_DIR"
"$VENV" tests/sim_audit.py quick 2>&1 | tee "$LATEST"
RESULT=${PIPESTATUS[0]}

if [ "$RESULT" -ne 0 ]; then
    SUMMARY=$(grep -E 'SUMMARY|\[FAIL\]' "$LATEST" | head -10)
    if [ -n "${TELEGRAM_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
        curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="⚠️ PRUVIQ Simulator QA FAIL:
${SUMMARY}" >/dev/null 2>&1 || true
    fi
fi

exit "$RESULT"
