#!/usr/bin/env bash
# scripts/measure-deploy-latency.sh
#
# Measure end-to-end "PR ready → pruviq.com live" latency for a given PR.
# Read-only: queries `gh` API and polls pruviq.com. Makes no changes anywhere.
#
# Usage:
#   ./scripts/measure-deploy-latency.sh <PR_NUMBER>
#   ./scripts/measure-deploy-latency.sh 1590
#
# Output: single CSV line on stdout (header on first run).
#   pr_num, created_at, ci_clean_at, merged_at, deploy_start, deploy_end, prod_live_at,
#   total_seconds, dominant_phase
#
# Phases (timestamps in UTC ISO-8601):
#   1. PR CLEAN → merged                     = merged_at - ci_clean_at
#   2. push → data-deploy.yml workflow start = deploy_start - merged_at
#   3. data-deploy.yml run                   = deploy_end - deploy_start
#   4. wrangler exit → prod_live             = prod_live_at - deploy_end
#
# Reasoning for each phase = "어디가 문제인지" diagnosis. Run on the next 5 merges
# to confirm dominant bottleneck (expected: phase 1 cron-fallback wait pre-PR-A).

set -euo pipefail

PR=${1:-}
if [[ -z "$PR" ]]; then
  echo "Usage: $0 <PR_NUMBER>" >&2
  exit 2
fi

REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "pruviq/pruviq")

# 1. PR metadata: createdAt, mergedAt, mergeCommit
read -r CREATED MERGED MERGE_SHA STATE < <(
  gh pr view "$PR" --repo "$REPO" \
    --json createdAt,mergedAt,mergeCommit,state \
    --jq '[.createdAt, (.mergedAt // "null"), (.mergeCommit.oid // "null"), .state] | @tsv'
)

if [[ "$STATE" != "MERGED" ]]; then
  echo "PR #$PR not merged (state=$STATE) — measurement requires merged PR" >&2
  exit 1
fi

# 2. CI CLEAN time: latest completedAt among required checks (excluding attempt-merge self)
CI_CLEAN=$(
  gh pr view "$PR" --repo "$REPO" --json statusCheckRollup \
    --jq '[.statusCheckRollup[]
            | select(.name != null and (.name|test("attempt-merge|Auto-merge")|not))
            | select(.completedAt != null)
            | .completedAt]
          | sort | last // "null"'
)

# 3. data-deploy.yml run for this merge SHA
RUNS_JSON=$(
  gh run list --repo "$REPO" --workflow=data-deploy.yml --limit=20 \
    --json headSha,event,conclusion,startedAt,updatedAt
)
DEPLOY_LINE=$(echo "$RUNS_JSON" \
  | jq --arg sha "$MERGE_SHA" \
       '[.[] | select(.headSha == $sha and .event == "push")] | first // null')

if [[ "$DEPLOY_LINE" == "null" || -z "$DEPLOY_LINE" ]]; then
  DEPLOY_START="null"
  DEPLOY_END="null"
else
  DEPLOY_START=$(echo "$DEPLOY_LINE" | jq -r '.startedAt')
  DEPLOY_END=$(echo "$DEPLOY_LINE" | jq -r '.updatedAt')
fi

# 4. prod_live_at: poll pruviq.com for the merge SHA marker.
# pruviq.com headers/HTML don't surface SHA today; best proxy is HTTP-Date
# of first 200 response after deploy_end. If deploy_end null, skip polling.
PROD_LIVE="null"
if [[ "$DEPLOY_END" != "null" ]]; then
  # Probe immediately after deploy_end (script may run later — just measure latest)
  HTTP_DATE=$(curl -sf -m 5 -o /dev/null -D - https://pruviq.com/ 2>/dev/null \
                | awk -F': ' 'tolower($1)=="date"{sub(/\r$/,"",$2); print $2}')
  if [[ -n "$HTTP_DATE" ]]; then
    PROD_LIVE=$(date -u -j -f "%a, %d %b %Y %H:%M:%S %Z" "$HTTP_DATE" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
                || date -u -d "$HTTP_DATE" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
                || echo "null")
  fi
fi

# Compute durations (epoch math, GNU date or BSD date both supported)
to_epoch() {
  local ts="$1"
  [[ "$ts" == "null" || -z "$ts" ]] && { echo ""; return; }
  if date -j -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s 2>/dev/null; then return; fi
  date -d "$ts" +%s 2>/dev/null || echo ""
}

E_CREATED=$(to_epoch "$CREATED")
E_CICLEAN=$(to_epoch "$CI_CLEAN")
E_MERGED=$(to_epoch "$MERGED")
E_DSTART=$(to_epoch "$DEPLOY_START")
E_DEND=$(to_epoch "$DEPLOY_END")
E_LIVE=$(to_epoch "$PROD_LIVE")

phase_secs() {
  local a="$1" b="$2"
  if [[ -z "$a" || -z "$b" ]]; then echo "null"; return; fi
  echo $(( b - a ))
}

P1=$(phase_secs "$E_CICLEAN" "$E_MERGED")    # CLEAN → merged
P2=$(phase_secs "$E_MERGED" "$E_DSTART")     # push → workflow
P3=$(phase_secs "$E_DSTART" "$E_DEND")       # workflow run
P4=$(phase_secs "$E_DEND" "$E_LIVE")         # workflow → live

# Dominant: largest non-null phase among p1/p2/p3.
# p4 (workflow→live) is excluded from dominant calc because it relies on
# HTTP-Date polling and is reliable only if the script runs immediately
# after deploy_end. For p4 use --poll mode in a future enhancement, or
# treat reported p4 as upper bound.
DOMINANT="unknown"
MAX=0
for entry in "phase1_clean_to_merge:$P1" "phase2_push_to_workflow:$P2" "phase3_workflow_run:$P3"; do
  name="${entry%%:*}"
  val="${entry##*:}"
  [[ "$val" == "null" || -z "$val" ]] && continue
  if (( val > MAX )); then
    MAX=$val
    DOMINANT="$name(${val}s)"
  fi
done

TOTAL="null"
if [[ -n "$E_CICLEAN" && -n "$E_LIVE" ]]; then
  TOTAL=$(( E_LIVE - E_CICLEAN ))
fi

# Print header on stdout if running under TTY first time
if [[ -t 1 && -z "${MEASURE_DEPLOY_NO_HEADER:-}" ]]; then
  echo "pr_num,created_at,ci_clean_at,merged_at,deploy_start,deploy_end,prod_live_at,p1_clean_to_merge_s,p2_push_to_run_s,p3_run_s,p4_run_to_live_s,total_s,dominant_phase"
fi

printf '%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n' \
  "$PR" "$CREATED" "$CI_CLEAN" "$MERGED" "$DEPLOY_START" "$DEPLOY_END" "$PROD_LIVE" \
  "$P1" "$P2" "$P3" "$P4" "$TOTAL" "$DOMINANT"
