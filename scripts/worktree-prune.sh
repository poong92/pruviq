#!/bin/bash
# PRUVIQ — Worktree Prune (governance for .claude/worktrees/agent-*)
#
# Goal: clean up worktrees whose PR has merged, keep in-flight work safe.
# Schedule: weekly cron (`30 5 * * 0` Sunday 05:30 UTC), or manual.
#
# Behavior matrix:
#   merged + clean    → auto prune
#   merged + dirty    → keep + alert (uncommitted change loss risk)
#   not merged + idle 14d+  → alert only, no prune (in-flight work — owner decides)
#   not merged + active     → silent skip
#
# Env knobs:
#   WORKTREE_DRY_RUN=1   — no changes, log what would happen
#   WORKTREE_STALE_DAYS=N — adjust idle threshold (default 14)
#   WORKTREE_TG_NOTIFY=0  — suppress Telegram digest

set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/pruviq}"
DRY_RUN="${WORKTREE_DRY_RUN:-0}"
STALE_DAYS="${WORKTREE_STALE_DAYS:-14}"
TG_NOTIFY="${WORKTREE_TG_NOTIFY:-1}"
LOG_FILE="${LOG_FILE:-/tmp/pruviq-worktree-prune.log}"

# Telegram (optional, same env pattern as refresh_static.sh)
TELEGRAM_TOKEN=""
TELEGRAM_CHAT_ID=""
if [[ -f "$HOME/.secrets.env" ]]; then
    # shellcheck disable=SC1091
    source "$HOME/.secrets.env"
fi
TG_TOKEN="${TELEGRAM_TOKEN:-}"
TG_CHAT="${TELEGRAM_CHAT_ID:-}"

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') — $*" | tee -a "$LOG_FILE"; }

notify() {
    [[ "$TG_NOTIFY" != "1" ]] && return 0
    [[ -z "$TG_TOKEN" || -z "$TG_CHAT" ]] && return 0
    local msg="$1"
    curl -sf -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
        -d chat_id="${TG_CHAT}" \
        -d text="🌳 PRUVIQ Worktree: ${msg}" \
        -d parse_mode="HTML" >/dev/null 2>&1 || true
}

cd "$REPO_DIR" || { log "REPO_DIR=$REPO_DIR not accessible"; exit 1; }

log "=== Worktree prune start (dry_run=$DRY_RUN, stale_days=$STALE_DAYS) ==="

# Refresh remote state for accurate merged-branch detection
git fetch origin -q 2>&1 || log "fetch warning (continuing with cached state)"

# Branches reachable from origin/main (i.e. merged)
MERGED_BRANCHES=$(git branch -r --merged origin/main 2>/dev/null | sed 's|^[[:space:]]*origin/||' | tr -d ' ')

PRUNED_LIST=()
KEPT_DIRTY_LIST=()
KEPT_STALE_LIST=()

# Enumerate worktrees (excluding the main checkout itself)
while IFS= read -r path && IFS= read -r branch; do
    [ "$path" = "$REPO_DIR" ] && continue
    [ -z "$path" ] && continue

    branch_short=${branch#refs/heads/}
    [ -z "$branch_short" ] && continue   # detached HEAD — skip (manual)

    is_merged="false"
    if echo "$MERGED_BRANCHES" | grep -qx "$branch_short"; then
        is_merged="true"
    fi

    is_clean="false"
    if [ -z "$(git -C "$path" status --porcelain 2>/dev/null)" ]; then
        is_clean="true"
    fi

    last_commit_ts=$(git -C "$path" log -1 --format=%ct 2>/dev/null || echo 0)
    age_days=$(( ( $(date +%s) - last_commit_ts ) / 86400 ))

    if [ "$is_merged" = "true" ] && [ "$is_clean" = "true" ]; then
        log "PRUNE: $branch_short (merged + clean) — $path"
        if [ "$DRY_RUN" = "1" ]; then
            log "  (dry-run: would remove)"
        else
            git worktree remove "$path" 2>&1 | tee -a "$LOG_FILE" || \
                git worktree remove --force "$path" 2>&1 | tee -a "$LOG_FILE"
        fi
        PRUNED_LIST+=("$branch_short")
    elif [ "$is_merged" = "true" ] && [ "$is_clean" = "false" ]; then
        log "KEEP-DIRTY: $branch_short (merged but uncommitted changes) — $path"
        KEPT_DIRTY_LIST+=("$branch_short")
    elif [ "$age_days" -gt "$STALE_DAYS" ]; then
        log "KEEP-STALE: $branch_short (not merged, $age_days days idle) — $path"
        KEPT_STALE_LIST+=("$branch_short ($age_days days)")
    fi
done < <(git worktree list --porcelain 2>/dev/null | awk '
    /^worktree /{ if(path) print path "\t" branch; path=substr($0,10); branch="" }
    /^branch /{ branch=substr($0,8) }
    /^$/ { if(path) { print path "\t" branch; path=""; branch="" } }
    END { if(path) print path "\t" branch }
' | while IFS=$'\t' read -r wt_path wt_branch; do echo "$wt_path"; echo "$wt_branch"; done)

# Optional: prune phantom worktree refs (if dir was rm'd manually)
if [ "$DRY_RUN" != "1" ]; then
    git worktree prune -v 2>&1 | tee -a "$LOG_FILE" || true
fi

log "=== Done: pruned=${#PRUNED_LIST[@]} kept_dirty=${#KEPT_DIRTY_LIST[@]} kept_stale=${#KEPT_STALE_LIST[@]} ==="

# Single digest notification (never noisy)
if [ ${#PRUNED_LIST[@]} -gt 0 ] || [ ${#KEPT_DIRTY_LIST[@]} -gt 0 ] || [ ${#KEPT_STALE_LIST[@]} -gt 0 ]; then
    SUMMARY=""
    [ ${#PRUNED_LIST[@]} -gt 0 ] && SUMMARY="$SUMMARY pruned: $(IFS=,; echo "${PRUNED_LIST[*]}")"
    [ ${#KEPT_DIRTY_LIST[@]} -gt 0 ] && SUMMARY="$SUMMARY | DIRTY (kept): $(IFS=,; echo "${KEPT_DIRTY_LIST[*]}")"
    [ ${#KEPT_STALE_LIST[@]} -gt 0 ] && SUMMARY="$SUMMARY | STALE: $(IFS=,; echo "${KEPT_STALE_LIST[*]}")"
    notify "$SUMMARY"
fi

exit 0
