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

# 2026-04-26 outage root-cause: when this script raced .github/workflows/
# data-deploy.yml on the same `npx wrangler deploy`, wrangler v4 [assets]
# manifest queries interleaved → second deploy activated a version with
# 51 dangling asset references → pruviq.com 51 pages 404. Three deploy
# paths existed (this script + GH Actions + a third LaunchAgent now
# disabled). Production deploy SSoT is now data-deploy.yml only; this
# script defers code deploys to CI and only handles data refreshes.
if [[ "$HAS_CODE_CHANGES" == "true" ]]; then
    log "Code changed on origin/main ($LAST_DEPLOYED_SHA -> $ORIGIN_SHA) — deferring to CI (data-deploy.yml). Marker updated; no Mac deploy."
    echo "$ORIGIN_SHA" > "$DEPLOY_MARKER"
    exit 0
fi

if [[ "$HAS_CHANGES" == "false" ]]; then
    log "No data changes (and code already CI-deployed)"
    exit 0
fi

# --- Step 2: Build + deploy data-only refresh from local repo ---
# Reached here only when origin/main is unchanged since last deploy AND a
# public/data/*.json file changed. CI deploys + Mac data refreshes cannot
# race because they trigger on disjoint conditions (push event vs. data file
# diff with same code SHA). Local repo includes public/ assets that a
# worktree created from git-tracked files alone would miss, causing
# wrangler to skip 800+ assets — build directly here.
log "Building site (local) for data-only refresh..."
if npm run build 2>&1 | tail -3; then
    log "Deploying to Cloudflare..."
    if npx wrangler deploy 2>&1 | tail -5; then
        log "Deployed to Cloudflare Workers (from local build)"
        echo "$ORIGIN_SHA" > "$DEPLOY_MARKER"
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
cd "$REPO_DIR"

# --- Step 3: Post-deploy verification ---
# Root cause of 13h staleness (PR #1133): wrangler reported success but
# uploaded 0 assets when invoked from a worktree missing public/* files.
# A "deploy succeeded" log line is not proof CF is serving fresh data.
# Close the loop: re-fetch market.json from pruviq.com and compare its
# `generated` timestamp with the local file we just built.
# CF propagation ceiling observed ~60s; 90s gives margin.
log "Verifying CF propagation (90s)..."
sleep 90

LOCAL_GEN=$(python3 -c "import json; print(json.load(open('public/data/market.json')).get('generated',''))" 2>/dev/null || echo "")
CF_GEN=$(curl -sf -m 15 "https://pruviq.com/data/market.json?cachebust=$(date +%s)" 2>/dev/null | \
    python3 -c "import json,sys; print(json.load(sys.stdin).get('generated',''))" 2>/dev/null || echo "")

if [[ -z "$LOCAL_GEN" || -z "$CF_GEN" ]]; then
    log "Verify FAILED: could not parse timestamps (local='$LOCAL_GEN' cf='$CF_GEN')"
    send_alert "ERROR" "Deploy verify: cannot parse market.json timestamps"
    exit 1
fi

if [[ "$LOCAL_GEN" != "$CF_GEN" ]]; then
    log "Verify FAILED: CF stale — local=$LOCAL_GEN cf=$CF_GEN"
    send_alert "ERROR" "Deploy verify FAILED: CF serves stale data. local=$LOCAL_GEN cf=$CF_GEN — wrangler likely skipped assets"
    exit 1
fi

log "Verify OK: CF serving fresh $CF_GEN"
send_alert "OK" "Static data refreshed + deployed (verified: $CF_GEN)"
exit 0
