#!/bin/bash
# PRUVIQ — Static Data Refresh (every 15 min via cron)
# Fetches CoinGecko data → updates coins-stats.json + market.json → git push
#
# Runs as openclaw user (owner of /Users/openclaw/pruviq/)
set -euo pipefail

export HOME="/Users/openclaw"
export PATH="/opt/homebrew/bin:/Users/openclaw/.npm-global/bin:$PATH"

REPO_DIR="/Users/openclaw/pruviq"
VENV_DIR="$REPO_DIR/backend/.venv"

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') — $*"; }

cd "$REPO_DIR"

# Activate venv if exists
if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
fi

# Run the refresh script
log "Running refresh_static.py..."
if ! python3 backend/scripts/refresh_static.py; then
    log "ERROR: refresh_static.py failed"
    exit 1
fi

# Safety: only commit on main branch (agent workflows may switch branches)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
if [ "$CURRENT_BRANCH" != "main" ]; then
    log "WARN: On branch '$CURRENT_BRANCH', not main. Skipping git commit/push."
    log "Data files updated locally but not pushed."
    exit 0
fi

# Git push only if data changed
DATA_FILES="public/data/market.json public/data/coins-stats.json public/data/macro.json public/data/news.json"
if ! git diff --quiet $DATA_FILES 2>/dev/null; then
    git add -f $DATA_FILES
    git commit -m "chore: static data refresh [$(date -u '+%H:%M')]" --no-verify
    if git push origin main 2>&1; then
        log "Pushed updated data -> Cloudflare auto-deploy"
    else
        log "WARN: git push failed"
    fi
else
    log "No data changes"
fi
