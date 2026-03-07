#!/bin/bash
# PRUVIQ Simulator E2E Test
# 실제 사용자 시나리오를 그대로 재현하는 검증 스크립트
# Usage: bash scripts/e2e_simulator_test.sh

set -euo pipefail

API="https://api.pruviq.com"
SITE="https://pruviq.com"
PASS=0
FAIL=0
TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  local name="$1"
  local result="$2"
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1))
    echo "  ✓ $name"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ $name — $result"
  fi
}

echo "═══════════════════════════════════════════"
echo " PRUVIQ Simulator E2E Test"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════"

# ── 1. API Health ──
echo ""
echo "1. API Health"
HEALTH=$(curl -sf --max-time 10 "$API/health" 2>&1) || HEALTH=""
if echo "$HEALTH" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['status']=='ok'" 2>/dev/null; then
  COINS=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin)['coins_loaded'])")
  check "API health OK ($COINS coins)" "PASS"
else
  check "API health" "FAIL: $HEALTH"
fi

# ── 2. Builder metadata ──
echo ""
echo "2. Builder Metadata"
IND=$(curl -sf --max-time 10 "$API/builder/indicators" 2>&1) || IND=""
IND_COUNT=$(echo "$IND" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
if [ "$IND_COUNT" -gt "0" ]; then
  check "Indicators loaded ($IND_COUNT)" "PASS"
else
  check "Indicators endpoint" "FAIL"
fi

PRESETS=$(curl -sf --max-time 10 "$API/builder/presets" 2>&1) || PRESETS=""
P_COUNT=$(echo "$PRESETS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
if [ "$P_COUNT" -gt "0" ]; then
  check "Presets loaded ($P_COUNT)" "PASS"
else
  check "Presets endpoint" "FAIL"
fi

# ── 3. Preset load (bb-squeeze-short) ──
echo ""
echo "3. Preset Load"
PRESET=$(curl -sf --max-time 10 "$API/builder/presets/bb-squeeze-short" 2>&1) || PRESET=""
HAS_ENTRY=$(echo "$PRESET" | python3 -c "import json,sys; d=json.load(sys.stdin); print('yes' if d.get('entry',{}).get('conditions') else 'no')" 2>/dev/null || echo "no")
if [ "$HAS_ENTRY" = "yes" ]; then
  check "BB Squeeze preset has entry conditions" "PASS"
else
  check "BB Squeeze preset entry" "FAIL"
fi

# ── 4. Backtest: preset format (50 coins) ──
echo ""
echo "4. Backtest — Preset (50 coins)"
PRESET_REQ=$(echo "$PRESET" | python3 -c "
import json,sys
p=json.load(sys.stdin)
req={'name':'BB Squeeze SHORT','direction':p['direction'],'timeframe':'1H','indicators':p['indicators'],'entry':p['entry'],'avoid_hours':p.get('avoid_hours',[2,3,10,20,21,22,23]),'sl_pct':p.get('sl_pct',10),'tp_pct':p.get('tp_pct',8),'max_bars':p.get('max_bars',48),'top_n':50}
print(json.dumps(req))
" 2>/dev/null)
BT50=$(curl -sf --max-time 60 -X POST "$API/backtest" -H "Content-Type: application/json" -d "$PRESET_REQ" 2>&1) || BT50=""
BT50_TRADES=$(echo "$BT50" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('total_trades',0))" 2>/dev/null || echo "0")
BT50_VALID=$(echo "$BT50" | python3 -c "import json,sys; d=json.load(sys.stdin); print('yes' if d.get('is_valid') else 'no')" 2>/dev/null || echo "no")
if [ "$BT50_TRADES" -gt "0" ] && [ "$BT50_VALID" = "yes" ]; then
  WR=$(echo "$BT50" | python3 -c "import json,sys; print(json.load(sys.stdin)['win_rate'])" 2>/dev/null)
  PF=$(echo "$BT50" | python3 -c "import json,sys; print(json.load(sys.stdin)['profit_factor'])" 2>/dev/null)
  check "50-coin backtest: $BT50_TRADES trades, WR $WR%, PF $PF" "PASS"
else
  ERR=$(echo "$BT50" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('detail','unknown'))" 2>/dev/null || echo "parse error")
  check "50-coin backtest" "FAIL: trades=$BT50_TRADES, err=$ERR"
fi

# ── 5. Backtest: ALL coins ──
echo ""
echo "5. Backtest — All Coins ($COINS)"
ALL_REQ=$(echo "$PRESET_REQ" | python3 -c "import json,sys; d=json.load(sys.stdin); d['top_n']=$COINS; print(json.dumps(d))" 2>/dev/null)
BT_ALL=$(curl -sf --max-time 120 -X POST "$API/backtest" -H "Content-Type: application/json" -d "$ALL_REQ" 2>&1) || BT_ALL=""
ALL_TRADES=$(echo "$BT_ALL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('total_trades',0))" 2>/dev/null || echo "0")
ALL_COINS=$(echo "$BT_ALL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('coins_used',0))" 2>/dev/null || echo "0")
if [ "$ALL_TRADES" -gt "0" ]; then
  WR=$(echo "$BT_ALL" | python3 -c "import json,sys; print(json.load(sys.stdin)['win_rate'])" 2>/dev/null)
  PF=$(echo "$BT_ALL" | python3 -c "import json,sys; print(json.load(sys.stdin)['profit_factor'])" 2>/dev/null)
  check "All-coin backtest: $ALL_TRADES trades on $ALL_COINS coins, WR $WR%, PF $PF" "PASS"
else
  ERR=$(echo "$BT_ALL" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('detail','unknown'))" 2>/dev/null || echo "parse error")
  check "All-coin backtest" "FAIL: $ERR"
fi

# ── 6. Error handling: invalid request ──
echo ""
echo "6. Error Handling"
ERR_RESP=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" -X POST "$API/backtest" -H "Content-Type: application/json" -d '{"name":"test"}')
if [ "$ERR_RESP" = "422" ]; then
  check "Missing 'entry' returns 422 (not 500)" "PASS"
else
  check "Missing 'entry' error code" "FAIL: got $ERR_RESP"
fi

# Check error message is human-readable (not [object Object])
ERR_BODY=$(curl -s --max-time 10 -X POST "$API/backtest" -H "Content-Type: application/json" -d '{"name":"test"}' 2>&1) || ERR_BODY=""
ERR_MSG=$(echo "$ERR_BODY" | python3 -c "
import json,sys
d=json.load(sys.stdin)
detail=d.get('detail','')
if isinstance(detail, list):
    msgs=[x.get('msg','') for x in detail]
    print('; '.join(msgs))
else:
    print(detail)
" 2>/dev/null || echo "")
if echo "$ERR_MSG" | grep -qi "required\|field\|missing"; then
  check "Error message is human-readable: '$ERR_MSG'" "PASS"
else
  check "Error message readability" "FAIL: '$ERR_MSG'"
fi

# ── 7. Website pages ──
echo ""
echo "7. Website Pages"
for page in "/" "/simulate/" "/ko/simulate/" "/strategies/" "/coins/" "/market/"; do
  CODE=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "$SITE$page")
  if [ "$CODE" = "200" ]; then
    check "$page → $CODE" "PASS"
  else
    check "$page" "FAIL: HTTP $CODE"
  fi
done

# ── 8. JS bundle integrity ──
echo ""
echo "8. JS Bundle Integrity (simulate page)"
EN_HTML=$(curl -sf --max-time 10 "$SITE/simulate/" 2>&1) || EN_HTML=""
EN_BUNDLE=$(echo "$EN_HTML" | python3 -c "
import sys,re
html=sys.stdin.read()
m=re.findall(r'/_astro/[^\"\s]+\.js',html)
print('\n'.join(m))
" 2>/dev/null)
if [ -n "$EN_BUNDLE" ]; then
  ALL_OK=true
  while IFS= read -r bundle; do
    CODE=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 "$SITE$bundle")
    if [ "$CODE" = "200" ]; then
      check "Bundle $bundle → 200" "PASS"
    else
      check "Bundle $bundle" "FAIL: HTTP $CODE"
      ALL_OK=false
    fi
  done <<< "$EN_BUNDLE"
else
  check "JS bundles on simulate page" "FAIL: none found"
fi

# ── 9. Error fix verification ──
echo ""
echo "9. Error Fix Verification (Array.isArray)"
# Find SimulatorPage chunk from entry bundle
ENTRY_BUNDLE=$(echo "$EN_BUNDLE" | head -1)
if [ -n "$ENTRY_BUNDLE" ]; then
  ENTRY_JS=$(curl -sf --max-time 10 "$SITE$ENTRY_BUNDLE" 2>&1) || ENTRY_JS=""
  SIM_CHUNK=$(echo "$ENTRY_JS" | python3 -c "
import sys,re
js=sys.stdin.read()
m=re.findall(r'SimulatorPage\.([A-Za-z0-9_-]+\.js)',js)
if m: print('/_astro/SimulatorPage.'+m[0])
" 2>/dev/null)
  if [ -n "$SIM_CHUNK" ]; then
    SIM_JS=$(curl -sf --max-time 10 "$SITE$SIM_CHUNK" 2>&1) || SIM_JS=""
    if echo "$SIM_JS" | grep -q "Array.isArray"; then
      check "Array.isArray in $SIM_CHUNK" "PASS"
    else
      check "Array.isArray in SimulatorPage chunk" "FAIL: not found"
    fi
  else
    check "SimulatorPage chunk detection" "FAIL: could not parse from entry bundle"
  fi
else
  check "Entry bundle" "FAIL: not found"
fi

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════"
echo " Results: $PASS/$TOTAL passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo " Status: ALL PASS ✓"
else
  echo " Status: $FAIL FAILURES — check above"
fi
echo "═══════════════════════════════════════════"

exit $FAIL
