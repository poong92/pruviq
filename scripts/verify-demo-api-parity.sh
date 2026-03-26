#!/bin/bash
# Verify demo JSON ↔ API /simulate parity
# Usage: bash scripts/verify-demo-api-parity.sh
# Exit 0 if match, exit 1 if mismatch

set -euo pipefail

API="${API_BASE_URL:-https://api.pruviq.com}"
DEMO_FILE="public/data/demo-bb-squeeze-short.json"

echo "=== Demo JSON ↔ API Parity Check ==="

# 1. Read static JSON trades
STATIC_TRADES=$(python3 -c "
import json
d = json.load(open('$DEMO_FILE'))
print(d['results']['sl10_tp8']['total_trades'])
")

# 2. Call API with same params
API_TRADES=$(curl -s -m 30 "$API/simulate" -X POST \
  -H "Content-Type: application/json" \
  -d '{"strategy":"bb-squeeze","direction":"short","sl_pct":10,"tp_pct":8,"top_n":50}' | \
  python3 -c "import json,sys; print(json.load(sys.stdin).get('total_trades',0))")

echo "Static: $STATIC_TRADES trades"
echo "API:    $API_TRADES trades"

# 3. Compare (allow ±5 difference for timing)
DIFF=$((STATIC_TRADES - API_TRADES))
ABS_DIFF=${DIFF#-}

if [ "$ABS_DIFF" -le 5 ]; then
  echo "PASS (diff=$DIFF)"
  exit 0
else
  echo "FAIL: static=$STATIC_TRADES api=$API_TRADES diff=$DIFF"
  exit 1
fi
