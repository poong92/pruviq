#!/bin/bash
# PRUVIQ — Static Data Refresh
# Fetches Binance+CoinGecko data → build → deploy to CF Workers.
# Cron: */20 * * * * (every 20 minutes)
# Note: generated-data branch removed 2026-03-19 — CF deploys from local build, not git branch.
set -euo pipefail

# Detect running user and set HOME accordingly
RUNNING_USER=$(whoami)
export HOME="/Users/${RUNNING_USER}"
REPO_DIR="/Users/${RUNNING_USER}/pruviq"
export PATH="/opt/homebrew/bin:$HOME/.npm-global/bin:$PATH"

VENV_DIR="$REPO_DIR/backend/.venv"
LOCK_FILE="/tmp/pruviq-refresh.lock"
LOCK_MAX_AGE_SEC=1200  # 20 minutes — auto-expire stuck locks
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

# Telegram alerting (safe: check file exists before source to avoid set -e exit)
TELEGRAM_TOKEN=""
TELEGRAM_CHAT_ID=""
if [[ -f "$HOME/.secrets.env" ]]; then
    source "$HOME/.secrets.env"
elif [[ -f "$HOME/.config/telegram.env" ]]; then
    source "$HOME/.config/telegram.env"
fi
TG_TOKEN="${TELEGRAM_TOKEN:-}"
TG_CHAT="${TELEGRAM_CHAT_ID:-}"

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') — $*"; }

send_alert() {
    local level="$1" msg="$2"
    log "$level: $msg"
    [[ -z "${TG_TOKEN}" || -z "${TG_CHAT}" ]] && return 0
    local icon="✅"
    [[ "$level" == "ERROR" ]] && icon="🚨"
    [[ "$level" == "WARN" ]] && icon="⚠️"
    curl -sf -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
        -d chat_id="${TG_CHAT}" \
        -d text="${icon} PRUVIQ Data Refresh: ${msg}" \
        -d parse_mode="HTML" >/dev/null 2>&1 || true
}

# --- Concurrency lock (with time-based expiry) ---
acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid lock_age_sec
        lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "0")
        lock_age_sec=$(( $(date +%s) - $(stat -f %m "$LOCK_FILE" 2>/dev/null || echo "0") ))
        if [ "$lock_age_sec" -gt "$LOCK_MAX_AGE_SEC" ]; then
            log "Lock expired (${lock_age_sec}s old, PID $lock_pid). Removing."
            rm -f "$LOCK_FILE"
        elif kill -0 "$lock_pid" 2>/dev/null; then
            log "Another refresh is running (PID $lock_pid). Skipping."
            exit 0
        else
            log "Stale lock found (PID $lock_pid dead). Removing."
            rm -f "$LOCK_FILE"
        fi
    fi
    echo $$ > "$LOCK_FILE"
}
release_lock() { rm -f "$LOCK_FILE"; }
trap release_lock EXIT

acquire_lock

cd "$REPO_DIR"

# --- Cron self-healing (re-register if accidentally removed) ---
CRON_ENTRY="*/20 * * * * bash $SCRIPT_PATH >> /tmp/pruviq-refresh.log 2>&1"
if ! crontab -l 2>/dev/null | grep -qF "refresh_static.sh"; then
    log "Cron entry missing — auto-installing..."
    ( crontab -l 2>/dev/null; echo "$CRON_ENTRY" ) | crontab -
    send_alert "WARN" "Cron entry was missing — auto-installed"
fi

# Only proceed if already on main. Never hijack a developer's feature branch
# (previous behavior: `git stash + git checkout main` mid-session wiped WIP and
# caused merge conflicts with the dev's commits — see 2026-04-18 audit incident).
# Dev work stays intact; cron simply skips this cycle and alerts owner.
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    log "Not on main (on $CURRENT_BRANCH) — skipping this cron cycle (dev session active)"
    send_alert "WARN" "refresh_static cron skipped: repo on branch '$CURRENT_BRANCH' (dev session). Will retry in 20min. If persistent, check Mac Mini git state."
    exit 0
fi

# Pull latest on main (no --autostash needed — we just confirmed clean branch state).
# Any uncommitted tracked-file changes here would indicate a cron misfire anyway.
git pull -q --ff-only origin main 2>/dev/null || {
    log "git pull failed — continuing with current HEAD"
}

# Activate venv if exists
if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
fi

# --- Pre-check: detect stale data files and alert ---
MARKET_JSON="$REPO_DIR/public/data/market.json"
if [ -f "$MARKET_JSON" ]; then
    FILE_AGE_SEC=$(( $(date +%s) - $(stat -f %m "$MARKET_JSON") ))
    if [ "$FILE_AGE_SEC" -gt 3600 ]; then
        send_alert "WARN" "market.json is $(( FILE_AGE_SEC / 60 ))min old — possible cron gap"
    fi
fi

# --- Step 1: Fetch data ---
log "Running refresh_static.py..."
if ! python3 backend/scripts/refresh_static.py 2>&1; then
    send_alert "ERROR" "refresh_static.py failed"
    exit 1
fi

# Post-run staleness check: if market.json is STILL old after a successful run, alert
if [ -f "$MARKET_JSON" ]; then
    POST_AGE_SEC=$(( $(date +%s) - $(stat -f %m "$MARKET_JSON") ))
    if [ "$POST_AGE_SEC" -gt 3600 ]; then
        send_alert "ERROR" "market.json still stale after refresh (${POST_AGE_SEC}s old). Pipeline may be broken."
    fi
fi

# --- Step 1b: Fetch rankings data for strategy cards ---
RANKINGS_JSON="public/data/rankings-daily.json"
log "Fetching daily rankings..."
if curl -sf --max-time 15 "https://api.pruviq.com/rankings/daily" -o "$RANKINGS_JSON.tmp" 2>/dev/null; then
    mv "$RANKINGS_JSON.tmp" "$RANKINGS_JSON"
    log "Rankings updated"
else
    log "Rankings fetch failed (non-critical, keeping previous)"
    rm -f "$RANKINGS_JSON.tmp"
fi

# --- site-stats.json auto-update (coins, strategies, trading_days from API) ---
SITE_STATS="public/data/site-stats.json"
log "Updating site-stats.json..."
python3 -c "
import json, datetime, urllib.request
path = '$REPO_DIR/$SITE_STATS'
with open(path) as f:
    d = json.load(f)
try:
    health = json.loads(urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=5).read())
    d['coins_analyzed'] = health.get('coins_loaded', d.get('coins_analyzed', 572))
except: pass
try:
    strats = json.loads(urllib.request.urlopen('http://127.0.0.1:8080/strategies', timeout=5).read())
    d['strategies_tested'] = len(strats) if isinstance(strats, list) else d.get('strategies_tested', 17)
except: pass
start = datetime.date(2023, 12, 30)
d['trading_days'] = (datetime.date.today() - start).days
d['last_updated'] = datetime.date.today().isoformat()
with open(path, 'w') as f:
    json.dump(d, f)
" 2>/dev/null && log "site-stats.json updated" || log "site-stats.json update failed (non-critical)"

# All data files that refresh_static.py may update
DATA_FILES="public/data/market.json public/data/coins-stats.json public/data/macro.json public/data/news.json public/data/coin-metadata.json public/data/rankings-daily.json public/data/site-stats.json"

# Check if any data changed
HAS_CHANGES=false
for f in $DATA_FILES; do
    if ! git diff --quiet "$f" 2>/dev/null; then
        HAS_CHANGES=true
        break
    fi
done

# Check if origin/main has new code commits since last deploy
# Deploy marker file stores the last deployed commit SHA
DEPLOY_MARKER="$HOME/.pruviq-last-deploy-sha"
git fetch origin main -q 2>/dev/null
ORIGIN_SHA=$(git rev-parse origin/main 2>/dev/null)
LAST_DEPLOYED_SHA=""
if [[ -f "$DEPLOY_MARKER" ]]; then
    LAST_DEPLOYED_SHA=$(cat "$DEPLOY_MARKER")
fi

HAS_CODE_CHANGES=false
if [[ "$ORIGIN_SHA" != "$LAST_DEPLOYED_SHA" ]]; then
    HAS_CODE_CHANGES=true
    log "New code on origin/main: $LAST_DEPLOYED_SHA -> $ORIGIN_SHA"
fi

if [[ "$HAS_CHANGES" == "false" && "$HAS_CODE_CHANGES" == "false" ]]; then
    log "No data or code changes"
    exit 0
fi

# --- Step 2: Build + deploy from local repo ---
# Data refresh only needs fresh public/data/*.json in dist/ — no code changes.
# Local repo includes all public/ assets (fonts, images, icons) that a worktree
# created from git-tracked files alone would miss, causing wrangler to skip 800+
# assets. Build directly here: code on this branch tracks origin/main.
log "Building site (local)..."
if npm run build 2>&1 | tail -3; then
    log "Deploying to Cloudflare..."
    if npx wrangler deploy 2>&1 | tail -5; then
        log "Deployed to Cloudflare Workers (from local build)"
        echo "$ORIGIN_SHA" > "$DEPLOY_MARKER"
    else
        log "Wrangler deploy failed"
        send_alert "ERROR" "CF Workers deploy failed"
        exit 1
    fi
else
    log "Build failed"
    send_alert "ERROR" "npm build failed"
    exit 1
fi
cd "$REPO_DIR"

# --- Step 3: Post-deploy verification ---
# Root cause of 13h staleness (PR #1133): wrangler reported success but
# uploaded 0 assets when invoked from a worktree missing public/* files.
# A "deploy succeeded" log line is not proof CF is serving fresh data.
# Close the loop: re-fetch market.json from pruviq.com and compare its
# `generated` timestamp with the local file we just built.
# CF propagation ceiling observed ~60s; 90s gives margin.
log "Verifying CF propagation (90s)..."
sleep 90

LOCAL_GEN=$(python3 -c "import json; print(json.load(open('public/data/market.json')).get('generated',''))" 2>/dev/null || echo "")
CF_GEN=$(curl -sf -m 15 "https://pruviq.com/data/market.json?cachebust=$(date +%s)" 2>/dev/null | \
    python3 -c "import json,sys; print(json.load(sys.stdin).get('generated',''))" 2>/dev/null || echo "")

if [[ -z "$LOCAL_GEN" || -z "$CF_GEN" ]]; then
    log "Verify FAILED: could not parse timestamps (local='$LOCAL_GEN' cf='$CF_GEN')"
    send_alert "ERROR" "Deploy verify: cannot parse market.json timestamps"
    exit 1
fi

if [[ "$LOCAL_GEN" != "$CF_GEN" ]]; then
    log "Verify FAILED: CF stale — local=$LOCAL_GEN cf=$CF_GEN"
    send_alert "ERROR" "Deploy verify FAILED: CF serves stale data. local=$LOCAL_GEN cf=$CF_GEN — wrangler likely skipped assets"
    exit 1
fi

log "Verify OK: CF serving fresh $CF_GEN"
send_alert "OK" "Static data refreshed + deployed (verified: $CF_GEN)"
exit 0
