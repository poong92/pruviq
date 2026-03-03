#!/bin/bash
# PRUVIQ — Static Data Refresh (Hardened v3.1)
# Fetches Binance+CoinGecko data → push snapshot branch (generated-data) → build → deploy → alert
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

# --- Data files that refresh_static.py may update ---
DATA_FILES="public/data/market.json public/data/coins-stats.json public/data/macro.json public/data/news.json public/data/coin-metadata.json"

if git diff --quiet $DATA_FILES 2>/dev/null; then
    log "No data changes"
    exit 0
fi

# --- Step 2: Push snapshot to dedicated branch (generated-data) ---
BRANCH="generated-data"

# Ensure public/data exists
if [ ! -d public/data ]; then
  echo "No public/data directory found — nothing to commit" >&2
  exit 0
fi

# Create or update generated-data branch (keep branch limited to public/data)
log "Preparing $BRANCH branch for snapshot"
if git show-ref --verify --quiet refs/heads/$BRANCH; then
  git checkout $BRANCH
else
  git checkout --orphan $BRANCH
  # Remove all files from index and working tree for a clean snapshot
  git rm -rf . >/dev/null 2>&1 || true
fi

# Add only the public/data directory
git add -f public/data

if git diff --cached --quiet; then
  log "No changes to public/data — nothing to commit"
  # Return to main branch and exit
  git checkout main 2>/dev/null || true
  exit 0
fi

git commit -m "chore: update generated static data snapshot [$(date -u '+%Y-%m-%d %H:%M UTC')]" --no-verify

# Push snapshot branch (force to keep it as a single snapshot branch)
if ! git push --set-upstream origin $BRANCH --force 2>&1; then
  send_alert "ERROR" "git push to $BRANCH failed. Data not published."
  # Attempt to return to main and abort
  git checkout main 2>/dev/null || true
  exit 1
fi

log "Pushed snapshot to branch $BRANCH"

# Return to main branch for build/deploy steps
git checkout main 2>/dev/null || true

# --- Step 3: Build (optional local build to validate) ---
log "Building site locally to validate snapshot integration..."
if ! npm run build 2>&1 | tail -5; then
    send_alert "ERROR" "npm run build failed. Snapshot committed but build failed locally."
    exit 1
fi
log "Build complete"

# --- Step 4: Deploy (unchanged) ---
log "Deploying to Cloudflare..."
if npx wrangler deploy 2>&1 | tail -5; then
    log "Deployed to Cloudflare Workers"
    send_alert "OK" "Data snapshot updated & deployed ✓ ($(date -u '+%H:%M UTC'))"
else
    send_alert "ERROR" "wrangler deploy failed. Snapshot pushed but site may be stale."
fi
