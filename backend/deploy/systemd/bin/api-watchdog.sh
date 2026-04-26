#!/bin/bash
# PRUVIQ — API Watchdog (DO-native, every 1 min, root-privileged)
#
# Called by pruviq-api-watchdog.timer. Complements pruviq-api.service's
# `Restart=always` for the case where the process is alive but hung
# (event loop starved, 100% CPU, /health not responding). systemd won't
# restart a live process, so we have to.
#
# Architecture:
#   pruviq-monitor.service (User=pruviq, every 5 min) — sends Telegram alerts
#   pruviq-api-watchdog (this, User=root, every 1 min) — force-restarts API
# Separating the two keeps the high-frequency watchdog minimal (no telegram,
# no python) while the 5-min monitor retains full observability depth.
#
# Action: if /health fails CONSECUTIVE_FAIL_THRESHOLD times in a row,
# force `systemctl restart pruviq-api.service`. Reset the counter on any
# success. Cooldown after a restart so we don't loop if the service keeps
# dying during boot.
set -uo pipefail

HEALTH_URL="http://127.0.0.1:8080/health"
CONSECUTIVE_FAIL_THRESHOLD=3
COOLDOWN_SEC=180
STATE_DIR="/var/lib/pruviq-watchdog"
FAIL_COUNT_FILE="$STATE_DIR/api-fail-count"
LAST_RESTART_FILE="$STATE_DIR/api-last-restart"

mkdir -p "$STATE_DIR" 2>/dev/null || true

# Read current counters (default 0).
fail_count=0
[ -f "$FAIL_COUNT_FILE" ] && fail_count=$(cat "$FAIL_COUNT_FILE" 2>/dev/null || echo 0)
fail_count=${fail_count:-0}

last_restart=0
[ -f "$LAST_RESTART_FILE" ] && last_restart=$(cat "$LAST_RESTART_FILE" 2>/dev/null || echo 0)
last_restart=${last_restart:-0}

now=$(date +%s)

# Probe /health. curl exit 0 only when HTTP 2xx and non-empty body.
# Timeout 15s (was 5s) — 2026-04-26 10:23 KST false-positive: API was
# serving heavy /simulate traffic; /health queued behind big requests
# and timed out at 5s, so 3 consecutive watchdog probes failed and
# force-restarted a perfectly healthy API. 15s is still well under the
# 60s probe interval and just lets /health drain the queue.
if curl -sf -m 15 "$HEALTH_URL" >/dev/null 2>&1; then
    if [ "$fail_count" -gt 0 ]; then
        echo "recovery: reset fail_count from $fail_count to 0"
    fi
    echo 0 > "$FAIL_COUNT_FILE"
    echo "ok"
    exit 0
fi

# Failed probe.
fail_count=$((fail_count + 1))
echo "$fail_count" > "$FAIL_COUNT_FILE"
echo "fail: count=$fail_count threshold=$CONSECUTIVE_FAIL_THRESHOLD"

if [ "$fail_count" -lt "$CONSECUTIVE_FAIL_THRESHOLD" ]; then
    exit 0
fi

# Threshold breached. Respect cooldown to prevent restart-loop on
# persistently-unhealthy service (e.g. bad config, disk full).
age_since_restart=$(( now - last_restart ))
if [ "$last_restart" -gt 0 ] && [ "$age_since_restart" -lt "$COOLDOWN_SEC" ]; then
    echo "cooldown: last restart ${age_since_restart}s ago (< ${COOLDOWN_SEC}s) — skipping"
    exit 0
fi

echo "RESTART: pruviq-api after $fail_count consecutive /health failures"
systemctl restart pruviq-api.service
echo "$now" > "$LAST_RESTART_FILE"
echo 0 > "$FAIL_COUNT_FILE"

# Best-effort Telegram notification. Uses /opt/pruviq/shared/.env if the
# caller sources it; otherwise silently skips.
if [ -n "${TELEGRAM_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    MSG="🔁 PRUVIQ API auto-restarted (watchdog)
pruviq-api.service was unresponsive for ${fail_count} consecutive probes.
Hostname: $(hostname -s). Check: journalctl -u pruviq-api -n 100"
    curl -sf -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
        -d chat_id="${TELEGRAM_CHAT_ID}" \
        -d text="$MSG" >/dev/null 2>&1 || true
fi
