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

# --- Alert dedup (prevents flood when same condition persists across cron ticks) ---
# Key: level + origin/main SHA + reason hash. SHA changes on actual progress;
# reason hash separates "diverged" from "stale" alerts. Stamp invalidates on either.
ALERT_DEDUP_DIR="/tmp/pruviq-alert-dedup"
ALERT_DEDUP_TTL_SEC=3600   # 1h: same (sha, reason) sends at most once per hour
mkdir -p "$ALERT_DEDUP_DIR" 2>/dev/null

send_alert() {
    local level="$1" msg="$2"
    log "$level: $msg"
    [[ -z "${TG_TOKEN}" || -z "${TG_CHAT}" ]] && return 0

    # Dedup: skip if same key seen within TTL
    local origin_sha reason_hash key stamp age
    origin_sha=$(git rev-parse origin/main 2>/dev/null | head -c 8 || echo "no-sha")
    reason_hash=$(echo "$msg" | shasum 2>/dev/null | head -c 8)
    key="${level}-${origin_sha}-${reason_hash}"
    stamp="$ALERT_DEDUP_DIR/$key"

    if [ -f "$stamp" ]; then
        age=$(( $(date +%s) - $(stat -f %m "$stamp" 2>/dev/null || echo 0) ))
        if [ "$age" -lt "$ALERT_DEDUP_TTL_SEC" ]; then
            log "  (alert deduped — same key seen ${age}s ago, TTL ${ALERT_DEDUP_TTL_SEC}s)"
            return 0
        fi
    fi
    date +%s > "$stamp"

    # Cleanup: remove stamps older than 24h to prevent /tmp bloat
    find "$ALERT_DEDUP_DIR" -type f -mmin +1440 -delete 2>/dev/null

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

# Auto-recovery from feature branch when safely idle.
#
# History:
#   2026-04-18: blunt `git stash + git checkout main` mid-session wiped WIP
#               and caused merge conflicts with the dev's commits → reverted
#               to skip-only behavior with an alert.
#   2026-04-25→26: skip-only behavior caused 18 alerts + 6h data staleness
#               after a session ended on feature branch with all work pushed.
#               Owner directive: alerts can flood (owner reads them) but
#               recovery MUST be automatic when safe.
#
# This implementation re-enables auto main-checkout, but only when ALL three
# conditions hold (any one missing = skip + WARN as before):
#   1. uncommitted changes == 0 (working tree clean → no WIP to lose)
#   2. local HEAD == origin/<branch> (every commit pushed → no commit to lose)
#   3. last commit > 1h ago (active dev session would commit more often)
# A push'd, clean, idle branch is exactly the post-PR-merge state where the
# 2026-04-25 incident occurred.
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    LAST_COMMIT_TS=$(git log -1 --format=%ct 2>/dev/null || echo 0)
    NOW_TS=$(date +%s)
    IDLE_SEC=$(( NOW_TS - LAST_COMMIT_TS ))
    LOCAL_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")
    REMOTE_HEAD=$(git rev-parse "origin/$CURRENT_BRANCH" 2>/dev/null || echo "no-remote")
    PUSHED=false
    if [[ -n "$LOCAL_HEAD" && "$LOCAL_HEAD" == "$REMOTE_HEAD" ]]; then
        PUSHED=true
    fi

    if [[ "$UNCOMMITTED" == "0" && "$PUSHED" == "true" && "$IDLE_SEC" -gt 3600 ]]; then
        log "Feature branch '$CURRENT_BRANCH' safe-to-recover (clean=true, pushed=true, idle=${IDLE_SEC}s) — auto checkout main"
        if git checkout main 2>&1 | while read l; do log "  $l"; done; then
            send_alert "INFO" "refresh_static auto-recovered to main from '$CURRENT_BRANCH' (idle $((IDLE_SEC/60))min, all commits pushed). Your branch is preserved — \`git checkout $CURRENT_BRANCH\` to resume."
        else
            log "git checkout main failed during auto-recovery — skipping"
            send_alert "ERROR" "refresh_static auto-recovery FAILED: git checkout main errored on '$CURRENT_BRANCH'. Manual intervention needed."
            exit 1
        fi
    else
        REASON="uncommitted=$UNCOMMITTED, pushed=$PUSHED, idle_min=$((IDLE_SEC/60))"
        log "Not on main (on $CURRENT_BRANCH) — skip cycle (recovery blocked: $REASON)"
        send_alert "WARN" "refresh_static cron skipped: branch '$CURRENT_BRANCH' ($REASON). Auto-recovery requires uncommitted=0 + pushed + idle>60min. Will retry in 20min."
        exit 0
    fi
fi

# Pull latest on main (no --autostash needed — we just confirmed clean branch state).
# Any uncommitted tracked-file changes here would indicate a cron misfire anyway.
git pull -q --ff-only origin main 2>/dev/null || {
    log "git pull failed — continuing with current HEAD"
}

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

# --- Step 1b: Fetch rankings data for strategy cards ---
RANKINGS_JSON="public/data/rankings-daily.json"
log "Fetching daily rankings..."
if curl -sf --max-time 15 "https://api.pruviq.com/rankings/daily" -o "$RANKINGS_JSON.tmp" 2>/dev/null; then
    mv "$RANKINGS_JSON.tmp" "$RANKINGS_JSON"
    log "Rankings updated"
else
    log "Rankings fetch failed (non-critical, keeping previous)"
    rm -f "$RANKINGS_JSON.tmp"
fi

# --- site-stats.json auto-update (coins, strategies, trading_days from API) ---
SITE_STATS="public/data/site-stats.json"
log "Updating site-stats.json..."
python3 -c "
import json, datetime, urllib.request
path = '$REPO_DIR/$SITE_STATS'
with open(path) as f:
    d = json.load(f)
# 2026-04-19: silent `except: pass` 제거. health/strategies 응답 실패 시 명시적 경고
# (stderr 로 올라가 refresh_static.sh 의 `2>/dev/null` 너머 log 에서 감지 가능).
# fallback 기본값은 그대로 유지 (refresh 전체가 실패하지 않도록 non-blocking).
import sys
try:
    health = json.loads(urllib.request.urlopen('https://api.pruviq.com/health', timeout=5).read())
    d['coins_analyzed'] = health.get('coins_loaded', d.get('coins_analyzed', 240))
except Exception as e:
    print(f'WARN: /health fetch failed — coins_analyzed unchanged ({e.__class__.__name__})', file=sys.stderr)
try:
    strats = json.loads(urllib.request.urlopen('https://api.pruviq.com/strategies', timeout=5).read())
    d['strategies_tested'] = len(strats) if isinstance(strats, list) else d.get('strategies_tested', 17)
except Exception as e:
    print(f'WARN: /strategies fetch failed — strategies_tested unchanged ({e.__class__.__name__})', file=sys.stderr)
start = datetime.date(2023, 12, 30)
d['trading_days'] = (datetime.date.today() - start).days
d['last_updated'] = datetime.date.today().isoformat()
with open(path, 'w') as f:
    json.dump(d, f)
" 2>/dev/null && log "site-stats.json updated" || log "site-stats.json update failed (non-critical)"

# All data files that refresh_static.py may update
DATA_FILES="public/data/market.json public/data/coins-stats.json public/data/macro.json public/data/news.json public/data/coin-metadata.json public/data/rankings-daily.json public/data/site-stats.json"

# Check if any data changed
HAS_CHANGES=false
for f in $DATA_FILES; do
    if ! git diff --quiet "$f" 2>/dev/null; then
        HAS_CHANGES=true
        break
    fi
done

# 2026-04-26 outage root cause: this script raced .github/workflows/
# data-deploy.yml on `npx wrangler deploy` against the same Worker.
# Wrangler v4 [assets] manifest queries interleaved → second deploy
# activated a version with 51 dangling asset references → pruviq.com
# 51 pages 404. Three deploy paths existed; production deploy SSoT
# is now data-deploy.yml only. This script's job ends at git push;
# CI owns the build+deploy. See ~/.claude/projects/-Users-jepo-pruviq/
# memory/project_deploy_incident_20260426.md for full timeline.

if [[ "$HAS_CHANGES" == "false" ]]; then
    log "No data changes — nothing to commit"
    exit 0
fi

# --- Step 2: Commit data-only changes and push to main ---
# Mac no longer calls wrangler. Pushing public/data/** to main triggers
# .github/workflows/data-deploy.yml on the GH Actions side which holds the
# only `npx wrangler deploy` call in the system. This eliminates concurrent
# wrangler invocations as a possibility, not just by convention.
DATA_FILES_LIST="public/data/market.json public/data/coins-stats.json public/data/macro.json public/data/news.json public/data/coin-metadata.json public/data/rankings-daily.json public/data/site-stats.json"

# Re-fetch origin/main right before push to minimize race with CI. If
# origin/main has new commits since we started, fast-forward our local
# main first so the push is a true fast-forward (no merge commits).
git fetch origin main -q 2>/dev/null
if ! git merge --ff-only origin/main 2>/dev/null; then
    log "Local main diverged from origin/main — manual fix required, skipping push"
    send_alert "ERROR" "refresh_static: local main diverged from origin/main"
    exit 1
fi

# Stage only the data files we just refreshed — don't sweep up anything
# else that may be dirty in the working tree.
git add $DATA_FILES_LIST 2>/dev/null

# Re-check after git add whether there's actually anything staged. The
# HAS_CHANGES check above used `git diff` which compares to HEAD; if a
# previous failed run already staged these files, the diff might be empty
# now. Use `git diff --cached --quiet` for the staged state.
if git diff --cached --quiet 2>/dev/null; then
    log "Data refresh wrote files but nothing staged — likely already committed in a prior cycle"
    exit 0
fi

# The push triggers data-deploy.yml (paths: public/data/** matches), which
# is the only `npx wrangler deploy` call in the system. data-deploy.yml has
# `concurrency: data-deploy / cancel-in-progress: false` so concurrent runs
# serialize — no manifest race possible even if multiple pushes land back
# to back. Don't use [skip ci]: we want the push trigger to fire
# immediately for fast propagation (otherwise data is stale up to 30 min
# until the cron drift-detector picks it up).
TS=$(date -u '+%Y-%m-%d %H:%M UTC')
if ! git -c user.email='pruviq-bot@pruviq.com' -c user.name='pruviq-bot' \
        commit -m "chore(data): refresh [$TS]" >/dev/null 2>&1; then
    log "git commit failed"
    send_alert "ERROR" "refresh_static: git commit failed"
    exit 1
fi

PUSH_OUT=$(git push origin main 2>&1)
PUSH_RC=$?
if [[ $PUSH_RC -ne 0 ]]; then
    # Roll back the local commit so the next cycle can retry cleanly without
    # the fast-forward check tripping on the unpushed commit.
    git reset --soft HEAD~1 2>/dev/null
    log "git push failed: $PUSH_OUT"
    send_alert "ERROR" "refresh_static: git push failed (deploy key? network?) — local commit rolled back"
    exit 1
fi

log "Pushed data refresh to origin/main — data-deploy.yml will deploy via push trigger"
send_alert "OK" "Static data refresh pushed to main ($TS); CI deploy in flight"
exit 0
