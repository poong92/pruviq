#!/bin/bash
# PRUVIQ — Full Data Pipeline
# Called by cron or n8n daily at 02:30 UTC
#
# Steps:
# 1. Update OHLCV data from Binance
# 2. Regenerate demo data
# 3. Signal API to reload data
# 4. Git commit + push (triggers Cloudflare auto-deploy)
# 5. Health check + optional Telegram notification

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
VENV_DIR="$REPO_DIR/backend/.venv"
DATA_DIR="${PRUVIQ_DATA_DIR:-$HOME/pruviq-data/futures}"
LOG_FILE="$HOME/pruviq-pipeline.log"
ENV_FILE="$REPO_DIR/backend/.env"

# Load .env if exists (for Telegram)
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') — $*" | tee -a "$LOG_FILE"; }

notify() {
    if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
        local msg="$1"
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="${TELEGRAM_CHAT_ID}" \
            -d text="${msg}" \
            -d parse_mode="Markdown" > /dev/null 2>&1 || true
    fi
}

log "=== Pipeline Start ==="

# Activate venv
if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
fi

cd "$REPO_DIR/backend"

ERRORS=0

# Step 1: Update OHLCV data
log "Step 1: Updating OHLCV data..."
if python3 scripts/update_ohlcv.py --data-dir "$DATA_DIR" 2>&1 | tail -3 | tee -a "$LOG_FILE"; then
    log "Step 1: OK"
else
    log "Step 1: FAILED"
    ERRORS=$((ERRORS + 1))
fi

# Step 2: Generate per-coin strategy stats (for coin table overlay)
log "Step 2: Generating per-coin strategy stats..."
if python3 scripts/generate_coin_strategy_stats.py 2>&1 | tail -5 | tee -a "$LOG_FILE"; then
    log "Step 2: OK"
else
    log "Step 2: FAILED"
    ERRORS=$((ERRORS + 1))
fi

# Step 2b: Regenerate demo data (for strategy comparison page)
log "Step 2b: Regenerating demo data..."
if python3 scripts/generate_demo_data.py 2>&1 | tail -3 | tee -a "$LOG_FILE"; then
    log "Step 2b: OK"
else
    log "Step 2b: FAILED"
    ERRORS=$((ERRORS + 1))
fi

# Step 3: Signal API to reload
log "Step 3: Reloading API data..."
RELOAD_RESULT=$(curl -s -X POST http://localhost:8080/admin/refresh 2>/dev/null || echo '{"error": "API not responding"}')
log "Reload result: $RELOAD_RESULT"

# Step 4: Git commit + push (auto-deploy)
log "Step 4: Git commit + push..."
cd "$REPO_DIR"

# Check if there are changes to commit
if git diff --quiet public/data/ 2>/dev/null; then
    log "Step 4: No data changes to commit"
else
    git add public/data/
    git commit -m "chore: daily data update [$(date -u '+%Y-%m-%d')] [skip ci]" 2>&1 | tee -a "$LOG_FILE"
    if git push origin main 2>&1 | tee -a "$LOG_FILE"; then
        log "Step 4: Pushed to GitHub -> Cloudflare auto-deploy"
    else
        log "Step 4: Push FAILED"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Step 5: Health check
log "Step 5: Health check..."
HEALTH=$(curl -s http://localhost:8080/health 2>/dev/null || echo '{"error": "API not responding"}')
log "Health: $HEALTH"

SITE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://pruviq.com 2>/dev/null || echo "000")
log "Site status: $SITE_STATUS"

# Summary + notification
if [ $ERRORS -gt 0 ]; then
    MSG="⚠️ *PRUVIQ Pipeline*: ${ERRORS} error(s)"
    log "$MSG"
    notify "$MSG"
else
    COINS=$(echo "$HEALTH" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("coins_loaded","?"))' 2>/dev/null || echo "?")
    MSG="✅ *PRUVIQ Pipeline* complete
• Data: ${COINS} coins updated
• API: reload OK
• Site: HTTP ${SITE_STATUS}"
    log "$MSG"
fi

log "=== Pipeline Complete (errors: $ERRORS) ==="
