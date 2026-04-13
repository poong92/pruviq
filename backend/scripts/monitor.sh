#!/bin/bash
# PRUVIQ — Health Monitoring Script
# Checks API and site availability, sends Telegram alerts on failure.
#
# Crontab (every 5 min):
#   */5 * * * * /Users/jepo/pruviq/backend/scripts/monitor.sh >> ~/pruviq-monitor.log 2>&1
# Crontab (hourly full check):
#   0 * * * * /Users/jepo/pruviq/backend/scripts/monitor.sh --full >> ~/pruviq-monitor.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
ENV_FILE="$REPO_DIR/backend/.env"
STATE_FILE="/tmp/pruviq-monitor-state"
LOG_FILE="$HOME/pruviq-monitor.log"

# Load Telegram tokens
source "$HOME/.secrets.env" 2>/dev/null || true

# Load project .env if exists
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

FULL_CHECK=false
if [ "${1:-}" = "--full" ]; then
    FULL_CHECK=true
fi

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') — $*" >> "$LOG_FILE"; }

notify() {
    if [ -n "${TELEGRAM_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="$1" \
            -d parse_mode="Markdown" > /dev/null 2>&1 || true
    fi
}

# Prevent duplicate alerts (cooldown 30 min)
should_alert() {
    local key="$1"
    local now
    now=$(date +%s)
    local last
    last=$(grep "^${key}=" "$STATE_FILE" 2>/dev/null | cut -d= -f2 || echo 0)
    if [ $((now - last)) -gt 1800 ]; then
        touch "$STATE_FILE"
        if grep -q "^${key}=" "$STATE_FILE" 2>/dev/null; then
            sed -i '' "s/^${key}=.*/${key}=${now}/" "$STATE_FILE" 2>/dev/null || true
        else
            echo "${key}=${now}" >> "$STATE_FILE"
        fi
        return 0
    fi
    return 1
}

ISSUES=()

# Check 1: API health
API_RESPONSE=$(curl -s -m 10 http://localhost:8080/health 2>/dev/null || echo '{"error":true}')
API_OK=$(echo "$API_RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok" if d.get("status")=="ok" else "fail")' 2>/dev/null || echo "fail")

if [ "$API_OK" != "ok" ]; then
    ISSUES+=("API down: localhost:8080")
    log "FAIL: API health check"
fi

# Check 2: API response time
if [ "$API_OK" = "ok" ]; then
    RESPONSE_TIME=$(curl -s -m 10 -o /dev/null -w "%{time_total}" http://localhost:8080/health 2>/dev/null || echo "99")
    RT_MS=$(echo "$RESPONSE_TIME * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "0")
    if [ "${RT_MS:-0}" -gt 5000 ]; then
        ISSUES+=("API slow: ${RT_MS}ms (>5s)")
        log "WARN: API response time ${RT_MS}ms"
    fi
fi

# Full check: site availability + external API + disk
if [ "$FULL_CHECK" = true ]; then
    # pruviq.com
    SITE_STATUS=$(curl -s -m 15 -o /dev/null -w "%{http_code}" https://pruviq.com 2>/dev/null || echo "000")
    if [ "$SITE_STATUS" != "200" ]; then
        ISSUES+=("pruviq.com HTTP $SITE_STATUS")
        log "FAIL: pruviq.com returned $SITE_STATUS"
    fi

    # api.pruviq.com
    API_EXT_STATUS=$(curl -s -m 15 -o /dev/null -w "%{http_code}" https://api.pruviq.com/health 2>/dev/null || echo "000")
    if [ "$API_EXT_STATUS" != "200" ]; then
        ISSUES+=("api.pruviq.com HTTP $API_EXT_STATUS")
        log "FAIL: api.pruviq.com returned $API_EXT_STATUS"
    fi

    # Cloudflare Tunnel
    TUNNEL_PID=$(pgrep cloudflared 2>/dev/null || echo "")
    if [ -z "$TUNNEL_PID" ]; then
        ISSUES+=("Cloudflare Tunnel not running")
        log "FAIL: cloudflared process not found"
    fi

    # Disk space
    DISK_USE=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
    if [ "${DISK_USE:-0}" -gt 90 ]; then
        ISSUES+=("Disk usage ${DISK_USE}%")
        log "WARN: Disk usage ${DISK_USE}%"
    fi

    log "Full check: site=$SITE_STATUS api_ext=$API_EXT_STATUS tunnel=${TUNNEL_PID:-none} disk=${DISK_USE}%"
fi

# Send alert if issues found
if [ ${#ISSUES[@]} -gt 0 ]; then
    ALERT_MSG="🚨 *PRUVIQ Alert*"
    for issue in "${ISSUES[@]}"; do
        ALERT_MSG="${ALERT_MSG}
• ${issue}"
    done
    ALERT_MSG="${ALERT_MSG}
_$(date -u '+%H:%M UTC')_"

    if should_alert "pruviq_issues"; then
        notify "$ALERT_MSG"
        log "ALERT sent: ${#ISSUES[@]} issues"
    else
        log "ALERT suppressed (cooldown): ${#ISSUES[@]} issues"
    fi
else
    log "OK: all checks passed"
    # Clear alert state on recovery
    if [ -f "$STATE_FILE" ]; then
        > "$STATE_FILE"
    fi
fi
