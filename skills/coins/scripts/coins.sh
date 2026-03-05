#!/bin/bash
# Skill: coins
# Description: PRUVIQ 코인 데이터 상태 확인 (총 수, 최근 업데이트, 상위 코인)

set -e

ACTION="${1:-summary}"

echo "🪙 **PRUVIQ Coins Data**"
echo ""

API_BASE="https://api.pruviq.com"

case $ACTION in
  summary)
    STATS=$(curl -s --max-time 10 "${API_BASE}/coins/stats" 2>/dev/null)

    if [[ -z "$STATS" ]]; then
        echo "❌ Cannot reach API"
        exit 1
    fi

    TOTAL=$(echo "$STATS" | jq '.coins | length' 2>/dev/null || echo "?")
    echo "📊 Total Coins: ${TOTAL}"
    echo ""

    # Top 5 by win rate
    echo "## Top 5 by Win Rate"
    echo "$STATS" | jq -r '.coins | sort_by(-.win_rate) | .[0:5] | .[] | "  \(.symbol): WR \(.win_rate)% | PF \(.profit_factor) | Trades \(.total_trades)"' 2>/dev/null || echo "  (parsing error)"
    echo ""

    # Bottom 5 by win rate
    echo "## Bottom 5 by Win Rate"
    echo "$STATS" | jq -r '.coins | sort_by(.win_rate) | .[0:5] | .[] | "  \(.symbol): WR \(.win_rate)% | PF \(.profit_factor) | Trades \(.total_trades)"' 2>/dev/null || echo "  (parsing error)"
    ;;

  search)
    SYMBOL="${2:-BTCUSDT}"
    SYMBOL_UPPER=$(echo "$SYMBOL" | tr '[:lower:]' '[:upper:]')

    STATS=$(curl -s --max-time 10 "${API_BASE}/coins/stats" 2>/dev/null)
    COIN=$(echo "$STATS" | jq ".coins[] | select(.symbol == \"${SYMBOL_UPPER}\")" 2>/dev/null)

    if [[ -n "$COIN" ]]; then
        echo "## ${SYMBOL_UPPER}"
        echo "$COIN" | jq -r '"  Win Rate: \(.win_rate)%\n  Profit Factor: \(.profit_factor)\n  Total Trades: \(.total_trades)\n  Avg PnL: \(.avg_pnl)%"' 2>/dev/null
    else
        echo "  ❌ ${SYMBOL_UPPER} not found"
    fi
    ;;

  *)
    echo "Usage: /coins [summary|search <SYMBOL>]"
    echo "  summary        - Overview + top/bottom coins"
    echo "  search BTCUSDT - Search specific coin stats"
    ;;
esac

echo ""
echo "⏰ $(date -u '+%Y-%m-%d %H:%M UTC')"
