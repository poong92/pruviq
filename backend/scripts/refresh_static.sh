#!/bin/bash
# PRUVIQ — Static Data Refresh
# Fetches Binance+CoinGecko data → commit to current branch and push.
# Cron: */20 * * * * (every 20 minutes)
set -euo pipefail

# Detect running user and set HOME accordingly
RUNNING_USER=$(whoami)
export HOME="/Users/${RUNNING_USER}"
REPO_DIR="/Users/${RUNNING_USER}/pruviq"
export PATH="/opt/homebrew/bin:$HOME/.npm-global/bin:$PATH"

VENV_DIR="$REPO_DIR/backend/.venv"
LOCK_FILE="/tmp/pruviq-refresh.lock"
LOG_FILE="/tmp/pruviq-refresh.log"

# Telegram alerting
source "$HOME/.config/telegram.env" 2>/dev/null || \
source /Users/jepo/.config/telegram.env 2>/dev/null || true
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

# --- Concurrency lock (prevents concurrent refresh runs) ---
acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid
        lock_pid=$(cat "$LOCK_FILE" 2>/dev/null)
        if kill -0 "$lock_pid" 2>/dev/null; then
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

# Activate venv if exists
if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
fi

# --- Step 1: Fetch data ---
log "Running refresh_static.py..."
if ! python3 backend/scripts/refresh_static.py 2>&1; then
    send_alert "ERROR" "refresh_static.py failed (exit $?)"
    exit 1
fi

# All data files that refresh_static.py may update
DATA_FILES="public/data/market.json public/data/coins-stats.json public/data/macro.json public/data/news.json public/data/coin-metadata.json"

if git diff --quiet $DATA_FILES 2>/dev/null; then
    log "No data changes"
    exit 0
fi

# --- Step 2: Commit data on current branch and push ---
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
log "On branch: $CURRENT_BRANCH"

# Add only generated data files
git add -f $DATA_FILES

if git diff --cached --quiet; then
    log "No changes to public/data — nothing to commit"
    exit 0
fi

TS=$(date -u '+%Y-%m-%d %H:%M' 2>/dev/null || date '+%Y-%m-%d %H:%M')
git commit -m "chore: refresh static data [$TS UTC]" --no-verify

# Push to current branch
if git push origin "$CURRENT_BRANCH" 2>&1; then
    log "Pushed data to $CURRENT_BRANCH"
else
    log "Push failed (branch protection?) — data committed locally"
    send_alert "WARN" "Static data committed but push failed"
fi

# --- Step 3: Build + deploy to Cloudflare Workers ---
log "Building site..."
if npm run build 2>&1 | tail -3; then
    log "Deploying to Cloudflare..."
    if npx wrangler deploy 2>&1 | tail -5; then
        log "Deployed to Cloudflare Workers"
        send_alert "OK" "Static data refreshed + deployed"
    else
        log "Wrangler deploy failed"
        send_alert "WARN" "Data pushed but CF deploy failed"
    fi
else
    log "Build failed"
    send_alert "ERROR" "npm build failed after data push"
fi

exit 0
