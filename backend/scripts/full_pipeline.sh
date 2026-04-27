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
    if [ -n "${TELEGRAM_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
        local msg="$1"
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
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
RELOAD_RESULT=$(curl -s -X POST http://localhost:8080/admin/refresh -H "X-Admin-Key: ${ADMIN_API_KEY}" 2>/dev/null || echo '{"error": "API not responding"}')
log "Reload result: $RELOAD_RESULT"

# Step 4: Git commit + push (auto-deploy via data-deploy.yml on push)
# Pattern: refresh_static.sh:236-285 (fetch → diverge check → commit → push with rollback)
# Fixes 2026-04-26 incident where push rejection left local main divergent.
log "Step 4: Git commit + push..."
cd "$REPO_DIR"

PUSH_FAIL_REASON=""
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)

if [ "$CURRENT_BRANCH" != "main" ]; then
    log "Step 4: WARN — on branch '$CURRENT_BRANCH', skipping git commit/push"
elif git diff --quiet public/data/ 2>/dev/null && git diff --cached --quiet public/data/ 2>/dev/null; then
    log "Step 4: No data changes to commit"
else
    # 4a. Sync with origin BEFORE staging — prevents diverge accumulation.
    if ! git fetch origin main -q 2>&1 | tee -a "$LOG_FILE"; then
        log "Step 4: fetch failed — aborting commit/push"
        ERRORS=$((ERRORS + 1))
        PUSH_FAIL_REASON="fetch failed (network?)"
    else
        BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
        AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)

        # 4b. Refuse to compound diverge — if local main already has unrelated
        # commits AND origin moved, abort before adding another commit.
        if [ "$BEHIND" -gt 0 ] && [ "$AHEAD" -gt 0 ]; then
            log "Step 4: ABORT — local main diverged (ahead=$AHEAD, behind=$BEHIND). Refusing to commit on top of unsynced state."
            ERRORS=$((ERRORS + 1))
            PUSH_FAIL_REASON="local main diverged (ahead=$AHEAD, behind=$BEHIND) — manual reconciliation required"
        elif [ "$BEHIND" -gt 0 ]; then
            if ! git merge --ff-only origin/main 2>&1 | tee -a "$LOG_FILE"; then
                log "Step 4: ff-merge failed despite ahead=0,behind=$BEHIND"
                ERRORS=$((ERRORS + 1))
                PUSH_FAIL_REASON="fast-forward to origin/main failed"
            fi
        fi

        if [ -z "$PUSH_FAIL_REASON" ]; then
            # 4c. Stage + commit only if there's actually something to commit.
            git add public/data/
            if git diff --cached --quiet 2>/dev/null; then
                log "Step 4: refresh produced files but nothing staged (already up to date)"
            else
                git -c user.email='pruviq-bot@pruviq.com' -c user.name='pruviq-bot' \
                    commit -m "chore: daily data update [$(date -u '+%Y-%m-%d')] [skip ci]" \
                    2>&1 | tee -a "$LOG_FILE"

                # 4d. Push with rollback on failure (refresh_static.sh:273-281 pattern)
                PUSH_OUT=$(git push origin main 2>&1)
                PUSH_RC=$?
                echo "$PUSH_OUT" | tee -a "$LOG_FILE"
                if [ $PUSH_RC -ne 0 ]; then
                    # Capture reason BEFORE rollback (head sha changes)
                    if echo "$PUSH_OUT" | grep -qi "non-fast-forward\|rejected"; then
                        BEHIND_NOW=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
                        PUSH_FAIL_REASON="non-fast-forward ($BEHIND_NOW commits behind origin/main)"
                    elif echo "$PUSH_OUT" | grep -qi "permission\|denied\|deploy key"; then
                        PUSH_FAIL_REASON="auth/permission denied"
                    elif echo "$PUSH_OUT" | grep -qi "could not resolve\|connection\|timeout"; then
                        PUSH_FAIL_REASON="network failure"
                    else
                        PUSH_FAIL_REASON="push failed: $(echo "$PUSH_OUT" | tail -1 | head -c 120)"
                    fi
                    # Rollback to prevent diverge accumulation
                    git reset --soft HEAD~1 2>/dev/null
                    log "Step 4: Push FAILED — local commit rolled back. Reason: $PUSH_FAIL_REASON"
                    ERRORS=$((ERRORS + 1))
                else
                    log "Step 4: Pushed to GitHub -> data-deploy.yml will auto-deploy"
                fi
            fi
        fi
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
    [ -n "$PUSH_FAIL_REASON" ] && MSG="$MSG
• git: ${PUSH_FAIL_REASON}"
    [ "${SITE_STATUS}" != "200" ] && MSG="$MSG
• site: HTTP ${SITE_STATUS}"
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
