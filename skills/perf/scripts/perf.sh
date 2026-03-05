#!/bin/bash
# Skill: perf
# Description: PRUVIQ API 성능 벤치마크 (응답시간, 에러율)

set -e

echo "⚡ **PRUVIQ Performance Benchmark**"
echo ""

API_BASE="https://api.pruviq.com"

benchmark_endpoint() {
    local NAME=$1
    local URL=$2
    local METHOD=${3:-GET}
    local DATA=${4:-}

    local START=$(date +%s%N)

    if [[ "$METHOD" == "POST" ]]; then
        local RESP=$(curl -s -w "\n%{http_code}" --max-time 30 -X POST -H "Content-Type: application/json" -d "$DATA" "$URL" 2>/dev/null)
    else
        local RESP=$(curl -s -w "\n%{http_code}" --max-time 30 "$URL" 2>/dev/null)
    fi

    local END=$(date +%s%N)
    local MS=$(( (END - START) / 1000000 ))
    local CODE=$(echo "$RESP" | tail -1)

    local STATUS="✅"
    if [[ "$CODE" != "200" ]]; then
        STATUS="❌"
    elif [[ $MS -gt 5000 ]]; then
        STATUS="⚠️"
    fi

    printf "  %s %-20s %4dms  HTTP %s\n" "$STATUS" "$NAME" "$MS" "$CODE"
}

echo "## API Endpoints"
benchmark_endpoint "/health" "${API_BASE}/health"
benchmark_endpoint "/coins/stats" "${API_BASE}/coins/stats"
benchmark_endpoint "/strategies" "${API_BASE}/strategies"
benchmark_endpoint "/market" "${API_BASE}/market"
benchmark_endpoint "/builder/presets" "${API_BASE}/builder/presets"
benchmark_endpoint "/builder/indicators" "${API_BASE}/builder/indicators"
benchmark_endpoint "/ohlcv/BTCUSDT" "${API_BASE}/ohlcv/BTCUSDT"

echo ""
echo "## Backtest (POST /simulate)"
benchmark_endpoint "/simulate" "${API_BASE}/simulate" "POST" '{"strategy":"bb_squeeze_short","top_n":10}'

echo ""
echo "## Frontend Pages"
for PAGE in "/" "/coins/" "/simulate/" "/strategies/" "/market/"; do
    START=$(date +%s%N)
    CODE=$(curl -sI --max-time 10 "https://pruviq.com${PAGE}" 2>/dev/null | head -1 | awk '{print $2}')
    END=$(date +%s%N)
    MS=$(( (END - START) / 1000000 ))

    STATUS="✅"
    if [[ "$CODE" != "200" ]]; then STATUS="❌"; fi

    printf "  %s %-20s %4dms  HTTP %s\n" "$STATUS" "pruviq.com${PAGE}" "$MS" "${CODE:-000}"
done

echo ""
echo "## Thresholds"
echo "  API: < 2s (OK), 2-5s (Slow), > 5s (Critical)"
echo "  Backtest: < 10s (OK), 10-30s (Slow)"
echo "  Frontend: < 3s TTFB (OK)"

echo ""
echo "⏰ $(date -u '+%Y-%m-%d %H:%M UTC')"
