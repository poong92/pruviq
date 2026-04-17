#!/bin/bash
# PRUVIQ — External data fetch ONLY (DO-native, every 20 min)
#
# Responsibility: call refresh_static.py to fetch Binance + CoinGecko +
# news RSS → write public/data/*.json. That's it. No git, no build, no deploy.
#
# Follow-up responsibilities live in their own units/workflows:
#   - git commit + push → pruviq-commit-data.service (deploy key scope)
#   - build + wrangler deploy → .github/workflows/data-deploy.yml (CF_TOKEN scope)
#
# Design principle: single responsibility. Fetch failures must not poison
# commits; commit failures must not block next fetch; deploy failures must
# not require SSH back into DO.
set -uo pipefail

REPO_DIR="/opt/pruviq/current"
VENV_PY="/opt/pruviq/app/.venv/bin/python"

notify_fail() {
    [ -z "${TELEGRAM_TOKEN:-}" ] && return 0
    [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0
    curl -sf -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
        -d chat_id="${TELEGRAM_CHAT_ID}" \
        -d text="🚨 PRUVIQ data fetch failed (DO): $1" >/dev/null 2>&1 || true
}

cd "$REPO_DIR"

# 1. Fetch external sources → public/data/*.json
if ! "$VENV_PY" backend/scripts/refresh_static.py 2>&1; then
    notify_fail "refresh_static.py exited non-zero"
    exit 1
fi

# 2. Rankings from our own API (cheap, already cached server-side)
RANKINGS_JSON="$REPO_DIR/public/data/rankings-daily.json"
if curl -sf --max-time 15 "http://127.0.0.1:8080/rankings/daily" -o "$RANKINGS_JSON.tmp" 2>/dev/null; then
    mv "$RANKINGS_JSON.tmp" "$RANKINGS_JSON"
else
    rm -f "$RANKINGS_JSON.tmp"
    # Non-critical: previous rankings stay valid for 24h
fi

# 3. site-stats.json — coins/strategies/trading_days counters
"$VENV_PY" - <<'PYEOF' 2>/dev/null || true
import json, datetime, urllib.request
path = '/opt/pruviq/current/public/data/site-stats.json'
with open(path) as f: d = json.load(f)
try:
    h = json.loads(urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=5).read())
    d['coins_analyzed'] = h.get('coins_loaded', d.get('coins_analyzed'))
except Exception: pass
try:
    s = json.loads(urllib.request.urlopen('http://127.0.0.1:8080/strategies', timeout=5).read())
    if isinstance(s, list): d['strategies_tested'] = len(s)
except Exception: pass
d['trading_days'] = (datetime.date.today() - datetime.date(2023, 12, 30)).days
d['last_updated'] = datetime.date.today().isoformat()
with open(path, 'w') as f: json.dump(d, f)
PYEOF

echo "data fetch OK"
