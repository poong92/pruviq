#!/bin/bash
# Skill: deploy
# Description: PRUVIQ 프론트엔드/백엔드 배포 상태 확인 및 실행

set -e

TARGET="${1:-status}"
PRUVIQ_DIR="$HOME/Desktop/pruviq"
MACMINI="jepo@172.30.1.16"
SSH_OPTS="-o IdentitiesOnly=yes -i $HOME/.ssh/id_ed25519 -o ConnectTimeout=5"

echo "🚀 **PRUVIQ Deployment**"
echo ""

case $TARGET in
  status)
    # Frontend status
    echo "## Frontend (Cloudflare Pages)"
    FE_CODE=$(curl -sI --max-time 5 https://pruviq.com | head -1 | awk '{print $2}')
    echo "  Site: HTTP ${FE_CODE:-DOWN}"

    # Check latest commit on remote
    cd "$PRUVIQ_DIR" 2>/dev/null
    if [[ -d ".git" ]]; then
        LOCAL_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "N/A")
        BRANCH=$(git branch --show-current 2>/dev/null || echo "N/A")
        echo "  Local: ${BRANCH} @ ${LOCAL_HASH}"
    fi

    echo ""

    # Backend status
    echo "## Backend (Mac Mini)"
    API_CODE=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" https://api.pruviq.com/health)
    echo "  API: HTTP ${API_CODE:-DOWN}"

    # Check Mac Mini git status
    REMOTE_HASH=$(ssh $SSH_OPTS $MACMINI "cd ~/pruviq && git rev-parse --short HEAD 2>/dev/null" || echo "N/A")
    echo "  Server: @ ${REMOTE_HASH}"

    if [[ "$LOCAL_HASH" == "$REMOTE_HASH" ]]; then
        echo "  Sync: ✅ In sync"
    else
        echo "  Sync: ⚠️ Out of sync (local: ${LOCAL_HASH}, server: ${REMOTE_HASH})"
    fi
    ;;

  frontend)
    echo "## Pre-deploy Checks"
    cd "$PRUVIQ_DIR"

    # Build check
    echo "  Building..."
    npm run build 2>&1 | tail -3
    BUILD_EXIT=$?

    if [[ $BUILD_EXIT -ne 0 ]]; then
        echo "  ❌ Build FAILED - DO NOT DEPLOY"
        exit 1
    fi
    echo "  ✅ Build OK"

    # Redirects check
    if [[ -f "scripts/qa-redirects.sh" ]]; then
        CONFLICTS=$(bash scripts/qa-redirects.sh 2>/dev/null | grep -c "CONFLICT" || echo "0")
        if [[ "$CONFLICTS" -gt 0 ]]; then
            echo "  ❌ ${CONFLICTS} redirect conflicts found - FIX FIRST"
            exit 1
        fi
        echo "  ✅ Redirects OK (0 conflicts)"
    fi

    echo ""
    echo "  Ready to deploy: git push origin main"
    echo "  After push, Cloudflare auto-builds in ~2 min"
    ;;

  backend)
    echo "## Backend Deploy to Mac Mini"
    ssh $SSH_OPTS $MACMINI "cd ~/pruviq && git pull && echo '✅ Code updated'"

    # Restart API
    echo "  Restarting API..."
    ssh $SSH_OPTS $MACMINI "cd ~/pruviq/backend && pkill -f 'uvicorn api.main:app' 2>/dev/null; sleep 1; nohup uvicorn api.main:app --host 0.0.0.0 --port 8400 > logs/api.log 2>&1 &"
    sleep 2

    # Verify
    API_CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" https://api.pruviq.com/health)
    if [[ "$API_CODE" == "200" ]]; then
        echo "  ✅ API restarted and healthy"
    else
        echo "  ⚠️ API returned HTTP ${API_CODE} - check logs"
    fi
    ;;

  *)
    echo "Usage: /deploy [status|frontend|backend]"
    echo "  status   - Check deployment status"
    echo "  frontend - Pre-deploy checks for Cloudflare Pages"
    echo "  backend  - Deploy backend to Mac Mini"
    ;;
esac

echo ""
echo "⏰ $(date -u '+%Y-%m-%d %H:%M UTC')"
