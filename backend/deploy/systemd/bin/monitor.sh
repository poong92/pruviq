#!/bin/bash
# PRUVIQ — Health Monitor (DO-native)
# Called by pruviq-monitor.timer (every 5 min) and pruviq-monitor-full.timer (hourly --full).
# Uses systemd journal for logs (no file log). Telegram alert with 30-min cooldown.
set -uo pipefail

FULL_CHECK=false
[ "${1:-}" = "--full" ] && FULL_CHECK=true

STATE_FILE="/tmp/pruviq-monitor-state"
ISSUES=()

notify() {
    [ -z "${TELEGRAM_TOKEN:-}" ] && return 0
    [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0
    curl -sf -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
        -d chat_id="${TELEGRAM_CHAT_ID}" \
        -d text="$1" \
        -d parse_mode="Markdown" >/dev/null 2>&1 || true
}

# 30-min cooldown via mtime
should_alert() {
    local key="$1"
    local marker="${STATE_FILE}-${key}"
    if [ -f "$marker" ]; then
        local age=$(( $(date +%s) - $(stat -c %Y "$marker") ))
        [ "$age" -lt 1800 ] && return 1
    fi
    touch "$marker"
    return 0
}

# 1. Local API health
API_RESP=$(curl -s -m 10 http://127.0.0.1:8080/health 2>/dev/null || echo '{"error":true}')
API_OK=$(echo "$API_RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok" if d.get("status")=="ok" else "fail")' 2>/dev/null || echo "fail")
[ "$API_OK" != "ok" ] && ISSUES+=("API down: 127.0.0.1:8080")

# 2. API response time
if [ "$API_OK" = "ok" ]; then
    RT=$(curl -s -m 10 -o /dev/null -w "%{time_total}" http://127.0.0.1:8080/health 2>/dev/null || echo "99")
    RT_MS=$(awk "BEGIN{printf \"%d\", ${RT} * 1000}")
    [ "${RT_MS:-0}" -gt 5000 ] && ISSUES+=("API slow: ${RT_MS}ms")
fi

# Full check: external endpoints + tunnel + disk
if [ "$FULL_CHECK" = true ]; then
    SITE=$(curl -s -m 15 -o /dev/null -w "%{http_code}" https://pruviq.com 2>/dev/null || echo "000")
    [ "$SITE" != "200" ] && ISSUES+=("pruviq.com HTTP $SITE")

    API_EXT=$(curl -s -m 15 -o /dev/null -w "%{http_code}" https://api.pruviq.com/health 2>/dev/null || echo "000")
    [ "$API_EXT" != "200" ] && ISSUES+=("api.pruviq.com HTTP $API_EXT")

    if ! systemctl is-active --quiet pruviq-cloudflared.service; then
        ISSUES+=("pruviq-cloudflared.service not active")
    fi

    DISK=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
    [ "${DISK:-0}" -gt 90 ] && ISSUES+=("Disk usage ${DISK}%")

    echo "full_check: site=$SITE api_ext=$API_EXT disk=${DISK}%"
fi

if [ ${#ISSUES[@]} -gt 0 ]; then
    MSG="🚨 *PRUVIQ Alert (DO)*"
    for issue in "${ISSUES[@]}"; do
        MSG="${MSG}
• ${issue}"
    done
    if should_alert "issues"; then
        notify "$MSG"
        echo "ALERT sent: ${#ISSUES[@]} issues"
    else
        echo "ALERT suppressed (cooldown): ${#ISSUES[@]} issues"
    fi
    exit 1
else
    echo "OK: all checks passed"
    # Clear cooldown markers on recovery
    rm -f "${STATE_FILE}-"*
fi
