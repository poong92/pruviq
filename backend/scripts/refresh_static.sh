#!/bin/bash
# PRUVIQ — Static Data Refresh (Hardened v3.0)
# Fetches Binance+CoinGecko data → git push → build → deploy → alert
#
# Cron: 0 */4 * * * (every 4 hours — reduced from hourly)
# Runs as openclaw user (owner of /Users/openclaw/pruviq/)
set -euo pipefail

export HOME="/Users/openclaw"
export PATH="/opt/homebrew/bin:/Users/openclaw/.npm-global/bin:$PATH"

REPO_DIR="/Users/openclaw/pruviq"
VENV_DIR="$REPO_DIR/backend/.venv"
LOCK_FILE="/tmp/pruviq-refresh.lock"
LOG_FILE="/tmp/pruviq-refresh.log"

# Telegram alerting (loaded from jepo's env)
source /Users/jepo/.secrets.env 2>/dev/null || true
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

# --- Concurrency lock (prevents OpenClaw ↔ refresh conflict) ---
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

# --- Step 2: Safety check ---
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
if [ "$CURRENT_BRANCH" != "main" ]; then
    log "WARN: On branch '$CURRENT_BRANCH', not main. Skipping."
    exit 0
fi

# All data files that refresh_static.py may update
DATA_FILES="public/data/market.json public/data/coins-stats.json public/data/macro.json public/data/news.json public/data/coin-metadata.json"

if git diff --quiet $DATA_FILES 2>/dev/null; then
    log "No data changes"
    exit 0
fi

# --- Step 3: Commit ---
git add -f $DATA_FILES
git commit -m "chore: static data refresh [$(date -u '+%H:%M')]" --no-verify

# --- Step 4: Pull + Push ---
if ! git pull --rebase origin main 2>&1; then
    log "WARN: rebase conflict, resolving with local data..."
    git checkout --ours $DATA_FILES 2>/dev/null || true
    git add -f $DATA_FILES
    GIT_EDITOR=true git rebase --continue 2>/dev/null || {
        git rebase --abort 2>/dev/null || true
        git pull -X ours origin main 2>&1 || true
    }
fi

if ! git push origin main 2>&1; then
    send_alert "ERROR" "git push failed. Data not deployed."
    git reset --hard origin/main 2>/dev/null || true
    exit 1
fi
log "Pushed to GitHub"

# --- Step 5: Build ---
log "Building site..."
if ! npm run build 2>&1 | tail -5; then
    send_alert "ERROR" "npm run build failed. Data pushed but not deployed."
    exit 1
fi
log "Build complete"

# --- Step 6: Deploy ---
log "Deploying to Cloudflare..."
if npx wrangler deploy 2>&1 | tail -5; then
    log "Deployed to Cloudflare Workers"
    send_alert "OK" "Data refreshed & deployed ✓ ($(date -u '+%H:%M UTC'))"
else
    send_alert "ERROR" "wrangler deploy failed. Git is updated but site is stale."
fi
