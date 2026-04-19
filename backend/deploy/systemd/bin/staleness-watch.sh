#!/bin/bash
# PRUVIQ — Data Staleness Watchdog (DO-native, every 10 min)
# Checks live API data freshness via CF-served market.json. On STALE,
# alerts the owner via Telegram (once per UTC day, deduped via state file).
# Does NOT attempt auto-remediation — the refresh owner is Mac cron, which
# cannot be triggered from DO. Separating detection from remediation is
# intentional: false self-healing claims (previous behavior) hid the real
# architectural gap between Mac cron and DO systemd.
set -uo pipefail

STALE_HOURS="${STALE_HOURS:-1}"
# Check CF-served static data (fast, edge-cached).
# /market/live on local API is too slow (238-coin live fetch, ~30s).
SITE_URL="${STALENESS_URL:-https://pruviq.com/data/market.json}"
# Per-key daily lock dir. Previous JSON state file corrupted on concurrent
# writes (observed 2026-04-19: `{"market_stale": true}{"market_stale": true}...`
# — four concatenated objects). json.load() then raised, except-pass returned
# "not alerted", and notify() fired every 10-min tick. Replacing mutable JSON
# with immutable per-key lock files: existence = dedup, mtime reset daily.
LOCK_DIR="/tmp/pruviq-staleness-alerts"
LOCK_DATE="$(date -u +%Y%m%d)"
mkdir -p "$LOCK_DIR"
# GC any lock files older than 2 days (harmless remnants from prior runs).
find "$LOCK_DIR" -type f -mtime +2 -delete 2>/dev/null || true

notify() {
    [ -z "${TELEGRAM_TOKEN:-}" ] && return 0
    [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0
    curl -sf -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
        -d chat_id="${TELEGRAM_CHAT_ID}" \
        -d text="$1" >/dev/null 2>&1 || true
}

# Returns 0 if already alerted today, non-zero otherwise.
already_alerted() {
    [ -f "$LOCK_DIR/$1-$LOCK_DATE" ]
}

# Records an alert; idempotent via file-create + touch.
mark_alerted() {
    : > "$LOCK_DIR/$1-$LOCK_DATE"
}

generated=$(curl -sf -m 15 "$SITE_URL" 2>/dev/null | python3 -c "
import sys,json
from datetime import datetime,timezone
try:
    d=json.load(sys.stdin)
    ts=d.get('generated','')
    if ts:
        dt=datetime.fromisoformat(ts.replace('Z','+00:00'))
        age_h=(datetime.now(timezone.utc)-dt).total_seconds()/3600
        print(f'{age_h:.2f}')
    else:
        print('ERROR')
except:
    print('ERROR')
" 2>/dev/null)

if [ -z "$generated" ] || [ "$generated" = "ERROR" ]; then
    if ! already_alerted "fetch_failed"; then
        notify "🚨 PRUVIQ: Cannot fetch data from $SITE_URL"
        mark_alerted "fetch_failed"
    fi
    echo "fetch failed"
    exit 1
fi

echo "age=${generated}h threshold=${STALE_HOURS}h"

state=$(python3 -c "
a=${generated}; t=${STALE_HOURS}
print('STALE' if a>=t else ('WARN' if a>=t*0.75 else 'OK'))
")

if [ "$state" = "STALE" ]; then
    if ! already_alerted "market_stale"; then
        # Architecture: refresh_static.sh runs on Mac cron (external-data fetch needs
        # non-DO IP for Binance 451 workaround). Staleness-watch on DO cannot
        # trigger Mac cron — alert the owner to investigate manually.
        # Do NOT call `systemctl start` here: even though pruviq-refresh-data.service
        # exists, it runs as user `pruviq` which cannot invoke systemctl without
        # polkit auth, and the unit was designed for a Phase-5 full-DO migration
        # that is intentionally on hold (Mac-cron stays authoritative for now).
        notify "🚨 PRUVIQ: Data STALE ${generated}h old (limit ${STALE_HOURS}h). Mac refresh_static.sh cron may be stuck — check /tmp/pruviq-refresh.log on Mac Mini."
        mark_alerted "market_stale"
    fi
fi
