#!/bin/bash
# PRUVIQ — Static Data Refresh (every hour via cron)
# Fetches Binance+CoinGecko data → updates JSON → git push → build → deploy
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
python3 backend/scripts/refresh_static.py
REFRESH_EXIT=$?
if [ $REFRESH_EXIT -ne 0 ]; then
    log "ERROR: refresh_static.py exited with code $REFRESH_EXIT"
    exit 1
fi

# Safety: only commit on main branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
if [ "$CURRENT_BRANCH" != "main" ]; then
    log "WARN: On branch '$CURRENT_BRANCH', not main. Skipping git commit/push."
    exit 0
fi

# All data files that refresh_static.py may update
DATA_FILES="public/data/market.json public/data/coins-stats.json public/data/macro.json public/data/news.json public/data/coin-metadata.json"

if ! git diff --quiet $DATA_FILES 2>/dev/null; then
    # 1. Stage & commit locally first
    git add -f $DATA_FILES
    git commit -m "chore: static data refresh [$(date -u '+%H:%M')]" --no-verify

    # 2. Pull --rebase to handle concurrent remote commits (OpenClaw, agents)
    if ! git pull --rebase origin main 2>&1; then
        log "WARN: rebase conflict on auto-generated data files, using ours..."
        git checkout --ours $DATA_FILES 2>/dev/null || true
        git add -f $DATA_FILES
        GIT_EDITOR=true git rebase --continue 2>/dev/null || {
            git rebase --abort 2>/dev/null || true
            log "WARN: rebase failed, retrying with merge..."
            git pull -X ours origin main 2>&1 || true
        }
    fi

    # 3. Push to GitHub
    if git push origin main 2>&1; then
        log "Pushed to GitHub"
    else
        log "ERROR: git push failed"
        git reset --hard origin/main 2>/dev/null || true
        log "Reset to origin/main. Data will be re-fetched next run."
        exit 1
    fi

    # 4. Build Astro site
    log "Building site..."
    if npm run build 2>&1 | tail -3; then
        log "Build complete"
    else
        log "ERROR: Build failed"
        exit 1
    fi

    # 5. Deploy to Cloudflare Workers
    log "Deploying to Cloudflare..."
    if npx wrangler deploy 2>&1 | tail -5; then
        log "Deployed to Cloudflare Workers"
    else
        log "WARN: wrangler deploy failed (site will update on next successful deploy)"
    fi
else
    log "No data changes"
fi
