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
# /market/live on local API is too slow (572-coin live fetch, ~30s).
SITE_URL="${STALENESS_URL:-https://pruviq.com/data/market.json}"
STATE_FILE="/tmp/pruviq-staleness-alerted-$(date -u +%Y%m%d).json"

notify() {
    [ -z "${TELEGRAM_TOKEN:-}" ] && return 0
    [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0
    curl -sf -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
        -d chat_id="${TELEGRAM_CHAT_ID}" \
        -d text="$1" >/dev/null 2>&1 || true
}

[ ! -f "$STATE_FILE" ] && echo '{}' > "$STATE_FILE"

already_alerted() {
    python3 -c "
import json,sys
try:
    with open('$STATE_FILE') as f:
        d=json.load(f)
    sys.exit(0 if '$1' in d else 1)
except: sys.exit(1)
"
}

mark_alerted() {
    python3 -c "
import json
with open('$STATE_FILE') as f: d=json.load(f)
d['$1']=True
with open('$STATE_FILE','w') as f: json.dump(d,f)
" 2>/dev/null || true
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
