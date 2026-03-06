#!/bin/bash
# Skill: pipeline
# Description: 데이터 파이프라인 상태 확인 및 수동 실행
# Note: Runs locally on Mac Mini as jepo user

set -e

ACTION="${1:-status}"
PRUVIQ_DIR="/Users/jepo/pruviq"
PIPELINE_LOG="${PRUVIQ_DIR}/backend/logs/pipeline.log"

echo "🔄 **PRUVIQ Data Pipeline**"
echo ""

case $ACTION in
  status)
    # Check last pipeline run (local)
    if [[ -f "$PIPELINE_LOG" ]]; then
        echo "📋 Last Pipeline Log:"
        tail -5 "$PIPELINE_LOG"
        echo ""

        LOG_MOD=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$PIPELINE_LOG" 2>/dev/null || echo "unknown")
        echo "📅 Log last modified: ${LOG_MOD}"
    else
        echo "⚠️ Pipeline log not found: ${PIPELINE_LOG}"
    fi
    echo ""

    # Check data freshness via API
    COIN_COUNT=$(curl -s --max-time 5 "https://api.pruviq.com/coins/stats" | jq '.coins | length' 2>/dev/null || echo "?")
    echo "📊 API Coins: ${COIN_COUNT}"

    # Check API health
    API_STATUS=$(curl -s --max-time 5 "https://api.pruviq.com/health" | jq -r '.status // "unknown"' 2>/dev/null || echo "down")
    echo "🔌 API Status: ${API_STATUS}"
    ;;

  run)
    echo "🚀 Starting manual pipeline run..."
    if [[ -f "${PRUVIQ_DIR}/backend/scripts/full_pipeline.sh" ]]; then
        cd "$PRUVIQ_DIR" && bash backend/scripts/full_pipeline.sh 2>&1
        echo ""
        echo "✅ Pipeline run completed"
    else
        echo "❌ Pipeline script not found: ${PRUVIQ_DIR}/backend/scripts/full_pipeline.sh"
        exit 1
    fi

    # Verify
    COIN_COUNT=$(curl -s --max-time 5 "https://api.pruviq.com/coins/stats" | jq '.coins | length' 2>/dev/null || echo "?")
    echo "📊 API Coins after refresh: ${COIN_COUNT}"
    ;;

  *)
    echo "Usage: /pipeline [status|run]"
    echo "  status - Check pipeline status and data freshness"
    echo "  run    - Manually execute the data pipeline"
    ;;
esac

echo ""
echo "⏰ $(date -u '+%Y-%m-%d %H:%M UTC')"
