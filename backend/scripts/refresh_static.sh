#!/bin/bash
# PRUVIQ — Static Data Refresh
# Fetches Binance+CoinGecko data → build → deploy to CF Workers.
# Git: commits to generated-data branch (avoids main branch protection).
# Cron: */20 * * * * (every 20 minutes)
set -euo pipefail

# Detect running user and set HOME accordingly
RUNNING_USER=$(whoami)
export HOME="/Users/${RUNNING_USER}"
REPO_DIR="/Users/${RUNNING_USER}/pruviq"
export PATH="/opt/homebrew/bin:$HOME/.npm-global/bin:$PATH"

VENV_DIR="$REPO_DIR/backend/.venv"
LOCK_FILE="/tmp/pruviq-refresh.lock"
DATA_BRANCH="generated-data"

# Telegram alerting (safe: check file exists before source to avoid set -e exit)
TELEGRAM_TOKEN=""
TELEGRAM_CHAT_ID=""
if [[ -f "$HOME/.config/telegram.env" ]]; then
    source "$HOME/.config/telegram.env"
elif [[ -f /Users/jepo/.config/telegram.env ]]; then
    source /Users/jepo/.config/telegram.env
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

# --- Concurrency lock ---
acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid
        lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "0")
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

# Ensure we're on main and clean
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    log "Not on main (on $CURRENT_BRANCH), switching..."
    git stash -q 2>/dev/null || true
    git checkout main -q 2>/dev/null || true
    git pull origin main -q 2>/dev/null || true
fi

# Activate venv if exists
if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
fi

# --- Step 1: Fetch data ---
log "Running refresh_static.py..."
if ! python3 backend/scripts/refresh_static.py 2>&1; then
    send_alert "ERROR" "refresh_static.py failed"
    exit 1
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

if [[ "$HAS_CHANGES" == "false" ]]; then
    log "No data changes"
    exit 0
fi

# --- Step 2: Build + deploy to Cloudflare Workers (ALWAYS from local files) ---
log "Building site..."
if npm run build 2>&1 | tail -3; then
    log "Deploying to Cloudflare..."
    if npx wrangler deploy 2>&1 | tail -5; then
        log "Deployed to Cloudflare Workers"
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

# --- Step 3: Git commit to generated-data branch (non-blocking) ---
# SAFETY: Always ensure we return to main branch, even on failure
{
    git stash -q 2>/dev/null || true
    if ! git show-ref --verify --quiet "refs/heads/$DATA_BRANCH" 2>/dev/null; then
        git branch "$DATA_BRANCH" main 2>/dev/null || true
    fi
    git checkout "$DATA_BRANCH" -q 2>/dev/null || {
        log "Failed to checkout $DATA_BRANCH, staying on main"
        git checkout main -f -q 2>/dev/null || true
        git stash pop -q 2>/dev/null || true
    }
    # Merge main — if conflict, abort and reset
    if ! git merge main -q --no-edit 2>/dev/null; then
        log "Merge conflict on $DATA_BRANCH, aborting merge"
        git merge --abort 2>/dev/null || true
        git checkout main -f -q 2>/dev/null || true
        git stash pop -q 2>/dev/null || true
        log "Returned to main after merge conflict"
    else
        git stash pop -q 2>/dev/null || true
        git add -f $DATA_FILES 2>/dev/null || true
        TS=$(date -u '+%Y-%m-%d %H:%M')
        git commit -m "chore: refresh static data [$TS UTC]" --no-verify 2>/dev/null || true
        git push origin "$DATA_BRANCH" 2>/dev/null || true
        git checkout main -f -q 2>/dev/null || true
        log "Data committed to $DATA_BRANCH"
    fi
} || {
    log "Git data commit skipped (non-critical)"
}
# CRITICAL: Always ensure we are on main branch at exit
current_branch=$(git branch --show-current 2>/dev/null)
if [[ "$current_branch" != "main" ]]; then
    log "WARNING: Still on $current_branch, force switching to main"
    git merge --abort 2>/dev/null || true
    git checkout main -f -q 2>/dev/null || true
    git reset --hard origin/main 2>/dev/null || true
fi

send_alert "OK" "Static data refreshed + deployed"
exit 0
