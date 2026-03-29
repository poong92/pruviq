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

# Ensure we're on main and clean
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    log "Not on main (on $CURRENT_BRANCH), switching..."
    git stash -q 2>/dev/null || true
    git checkout main -q 2>/dev/null || true
fi

# Always pull latest code so pipeline fixes propagate automatically
git pull --autostash -q origin main 2>/dev/null || true

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

# All data files that refresh_static.py may update
DATA_FILES="public/data/market.json public/data/coins-stats.json public/data/macro.json public/data/news.json public/data/coin-metadata.json"

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

# --- Step 2: Build + deploy in isolated worktree (prevent stale code deploy) ---
# 2026-03-22 fix: ~/pruviq/ has local-only commits that caused repeated rollbacks.
# Build from origin/main in a clean worktree to ensure deployed code matches GitHub.
DEPLOY_WORKTREE="/tmp/pruviq-refresh-deploy-$$"
cleanup_worktree() {
    cd "$HOME" 2>/dev/null
    if [[ -d "$DEPLOY_WORKTREE" ]]; then
        git -C "$REPO_DIR" worktree remove "$DEPLOY_WORKTREE" --force 2>/dev/null || rm -rf "$DEPLOY_WORKTREE"
    fi
}
trap 'cleanup_worktree' EXIT

git fetch origin main -q 2>/dev/null
git worktree add "$DEPLOY_WORKTREE" origin/main --detach -q 2>/dev/null || {
    log "Failed to create deploy worktree, falling back to local build"
    # Fallback: build locally if worktree fails
    npm run build 2>&1 | tail -3
    npx wrangler deploy 2>&1 | tail -5
    exit $?
}

# Copy refreshed data files to worktree
cp -f "$REPO_DIR/public/data/"*.json "$DEPLOY_WORKTREE/public/data/" 2>/dev/null

cd "$DEPLOY_WORKTREE"
npm ci --prefer-offline 2>/dev/null || npm ci 2>/dev/null || ln -s "$REPO_DIR/node_modules" "$DEPLOY_WORKTREE/node_modules"

log "Building site (worktree)..."
if npm run build 2>&1 | tail -3; then
    log "Deploying to Cloudflare..."
    if npx wrangler deploy 2>&1 | tail -5; then
        log "Deployed to Cloudflare Workers (from origin/main worktree)"
        echo "$ORIGIN_SHA" > "$DEPLOY_MARKER"
    else
        log "Wrangler deploy failed"
        send_alert "ERROR" "CF Workers deploy failed"
        cd "$REPO_DIR"
        exit 1
    fi
else
    log "Build failed"
    send_alert "ERROR" "npm build failed"
    cd "$REPO_DIR"
    exit 1
fi
cd "$REPO_DIR"

send_alert "OK" "Static data refreshed + deployed"
exit 0
