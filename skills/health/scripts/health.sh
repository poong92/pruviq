#!/bin/bash
# Skill: health
# Description: PRUVIQ 전체 시스템 헬스체크 (API + Frontend + Data)

set -e

echo "🔮 **PRUVIQ Health Check**"
echo ""

# 1. API Health
API_START=$(date +%s%N)
API_RESP=$(curl -s -w "\n%{http_code}" --max-time 10 https://api.pruviq.com/health 2>/dev/null || echo "FAILED")
API_END=$(date +%s%N)

if [[ "$API_RESP" == "FAILED" ]]; then
    echo "❌ API: DOWN (no response)"
    API_STATUS="DOWN"
else
    API_CODE=$(echo "$API_RESP" | tail -1)
    API_BODY=$(echo "$API_RESP" | sed '$d')
    API_MS=$(( (API_END - API_START) / 1000000 ))

    if [[ "$API_CODE" == "200" ]]; then
        COINS=$(echo "$API_BODY" | jq -r '.coins_loaded // "?"' 2>/dev/null || echo "?")
        UPTIME=$(echo "$API_BODY" | jq -r '.uptime // "?"' 2>/dev/null || echo "?")
        echo "✅ API: ${API_CODE} OK (${API_MS}ms)"
        echo "   Coins: ${COINS} | Uptime: ${UPTIME}"
        API_STATUS="OK"
    else
        echo "⚠️ API: HTTP ${API_CODE} (${API_MS}ms)"
        API_STATUS="DEGRADED"
    fi
fi

# 2. Frontend
FE_START=$(date +%s%N)
FE_CODE=$(curl -sI --max-time 10 https://pruviq.com 2>/dev/null | head -1 | awk '{print $2}' || echo "000")
FE_END=$(date +%s%N)
FE_MS=$(( (FE_END - FE_START) / 1000000 ))

if [[ "$FE_CODE" == "200" ]]; then
    echo "✅ Frontend: ${FE_CODE} OK (${FE_MS}ms)"
elif [[ "$FE_CODE" == "000" ]]; then
    echo "❌ Frontend: DOWN (no response)"
else
    echo "⚠️ Frontend: HTTP ${FE_CODE} (${FE_MS}ms)"
fi

# 3. Key Pages
for PAGE in "/coins/" "/simulate/" "/strategies/"; do
    PAGE_CODE=$(curl -sI --max-time 5 "https://pruviq.com${PAGE}" 2>/dev/null | head -1 | awk '{print $2}' || echo "000")
    if [[ "$PAGE_CODE" == "200" ]]; then
        echo "   ✅ ${PAGE}: OK"
    else
        echo "   ⚠️ ${PAGE}: HTTP ${PAGE_CODE}"
    fi
done

# 4. Data Freshness
COINS_STATS=$(curl -s --max-time 10 "https://api.pruviq.com/coins/stats" 2>/dev/null)
if [[ -n "$COINS_STATS" ]]; then
    COIN_COUNT=$(echo "$COINS_STATS" | jq '.coins | length' 2>/dev/null || echo "0")
    echo ""
    echo "📊 Data: ${COIN_COUNT} coins available"
fi

echo ""
echo "⏰ Checked: $(date -u '+%Y-%m-%d %H:%M UTC')"
