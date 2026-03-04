#!/bin/bash
# PRUVIQ — Static Data Refresh (Hardened v3.1)
# Fetches Binance+CoinGecko data → push generated snapshots to dedicated branch (generated-data)
# This avoids noisy commits on main and prevents recurring merge conflicts.
# Cron: 0 */4 * * * (every 4 hours)
set -euo pipefail

export HOME="/Users/openclaw"
export PATH="/opt/homebrew/bin:/Users/openclaw/.npm-global/bin:$PATH"

REPO_DIR="/Users/openclaw/pruviq"
VENV_DIR="$REPO_DIR/backend/.venv"
LOCK_FILE="/tmp/pruviq-refresh.lock"
LOG_FILE="/tmp/pruviq-refresh.log"

# Telegram alerting (loaded from jepo's env)
source /Users/openclaw/.config/telegram.env 2>/dev/null || true
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

# --- Step 2: Commit to dedicated branch (generated-data) ---
PREV_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
BRANCH="generated-data"

# Ensure we have latest refs
git fetch origin --prune || true

if git show-ref --verify --quiet refs/heads/$BRANCH; then
    git checkout $BRANCH
else
    # Create orphan branch if missing
    git checkout --orphan $BRANCH
    git rm -rf . || true
fi

# Add only generated data files
git add -f $DATA_FILES

if git diff --cached --quiet; then
    log "No changes to public/data — nothing to commit"
    # restore previous branch and exit
    git checkout $PREV_BRANCH 2>/dev/null || true
    exit 0
fi

git commit -m "chore: update generated static data snapshot [$(date -u '+%Y-%m-%d %H:%M UTC')]" --no-verify

# Push branch (force is acceptable for a dedicated snapshot branch)
git push --set-upstream origin $BRANCH --force
log "Pushed generated-data branch"

# Restore previous branch for safety
git checkout $PREV_BRANCH 2>/dev/null || true

send_alert "OK" "Generated data snapshot pushed to branch '${BRANCH}'"

# Done — do not push generated snapshots to main to avoid merge conflicts
exit 0
