#!/bin/bash
# PRUVIQ — Commit fetched data and push to main (DO-native, chained after refresh-data)
#
# Responsibility: if public/data/ differs from HEAD, make a single atomic
# commit and push. Nothing else. The push triggers .github/workflows/data-deploy.yml
# which then builds and deploys.
#
# Requires:
#   - pruviq user has /opt/pruviq/.ssh/id_ed25519
#   - That key is registered as a GitHub Deploy Key with write access
#   - git remote is ssh (git@github.com:pruviq/pruviq.git), not https
#
# Why separate from refresh-data: allows retrying commits independently if
# GitHub is temporarily unreachable, and makes the failure Telegram message
# specific ("push failed" vs "fetch failed").
set -uo pipefail

REPO_DIR="/opt/pruviq/current"

notify_fail() {
    [ -z "${TELEGRAM_TOKEN:-}" ] && return 0
    [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0
    curl -sf -m 10 -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
        -d chat_id="${TELEGRAM_CHAT_ID}" \
        -d text="🚨 PRUVIQ commit-data failed (DO): $1" >/dev/null 2>&1 || true
}

cd "$REPO_DIR"

# 0. Stay on main — we should never branch from within a timer
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$BRANCH" != "main" ]; then
    notify_fail "not on main (on $BRANCH)"
    exit 1
fi

# 1. Pull first so we never produce a non-FF push
if ! git fetch origin main -q 2>/dev/null; then
    notify_fail "git fetch failed"
    exit 1
fi
# Fast-forward only — any local divergence is a bug we want to surface, not merge
if ! git merge --ff-only origin/main 2>&1 | tail -1; then
    notify_fail "local branch diverged from origin/main — manual fix required"
    exit 1
fi

# 2. Detect data-only changes (nothing else should be dirty on DO)
if git diff --quiet -- public/data/ 2>/dev/null; then
    echo "no data changes — skip commit"
    exit 0
fi

# 3. Commit + push
git add public/data/
git -c user.email='pruviq-bot@pruviq.com' -c user.name='pruviq-bot' \
    commit -m "chore(data): refresh [$(date -u '+%Y-%m-%d %H:%M UTC')] [skip ci]" >/dev/null
if git push origin main 2>&1 | tail -2; then
    echo "pushed"
else
    notify_fail "git push failed (deploy key? ssh?)"
    exit 1
fi
