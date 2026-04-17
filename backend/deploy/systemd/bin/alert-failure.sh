#!/bin/bash
# PRUVIQ — OnFailure handler for systemd units.
# Invoked by pruviq-alert@UNIT.service when a timer service fails.
set -uo pipefail

UNIT="${1:-unknown}"
HOST=$(hostname)
JOURNAL_TAIL=$(journalctl -u "$UNIT" -n 20 --no-pager 2>/dev/null | tail -15)

if [ -n "${TELEGRAM_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
        -d chat_id="${TELEGRAM_CHAT_ID}" \
        -d text="🚨 PRUVIQ systemd FAIL on ${HOST}
Unit: ${UNIT}

Journal tail:
${JOURNAL_TAIL}" >/dev/null 2>&1 || true
fi
