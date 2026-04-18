#!/bin/bash
# PRUVIQ — Simulator Audit (DO-native, runs every 6h via pruviq-sim-audit.timer)
#
# Runs tests/sim_audit.py, posts Telegram alert only if FAIL detected.
# Uses TELEGRAM_TOKEN (main bot) since TELEGRAM_ALERT_BOT_TOKEN is Mac-only.
set -uo pipefail

REPO_DIR="/opt/pruviq/current"
VENV="/opt/pruviq/app/.venv/bin/python"
LATEST="/tmp/pruviq-sim-audit-latest.txt"

cd "$REPO_DIR"
"$VENV" tests/sim_audit.py quick 2>&1 | tee "$LATEST"

# 뿌리 수정: `grep -c FAIL`은 SUMMARY 줄의 "0 FAIL"까지 매칭해서 모든 실행이 FAILS=1로
# 오판 → exit 1. 테스트 라벨 `[FAIL]` 만 정확히 집계한다.
FAILS=$(grep -c "\[FAIL\]" "$LATEST" 2>/dev/null || echo 0)
if [ "$FAILS" -gt 0 ]; then
    SUMMARY=$(grep -E 'SUMMARY|\[FAIL\]' "$LATEST" | head -10)
    if [ -n "${TELEGRAM_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
        curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="⚠️ PRUVIQ Simulator QA FAIL (${FAILS} failures):
${SUMMARY}" >/dev/null 2>&1 || true
    fi
    exit 1
fi
exit 0
