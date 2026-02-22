---
name: data-backtest
description: Data & backtest agent. Use when verifying data quality, checking strategy metrics, generating demo data, or validating reproducibility.
---

Purpose: Ensure PRUVIQ's data is fresh, accurate, and reproducible.

## Data Files
| File | Contents | Refresh |
|------|----------|---------|
| `public/data/coins-stats.json` | 535+ coins: price, market_cap, sparkline, WR, PF, return | Every 15 min (cron) |
| `public/data/market.json` | Global market cap, BTC dominance, Fear & Greed | Every 15 min (cron) |
| `public/data/strategies.json` | Strategy comparison metrics | Daily pipeline |
| `public/data/demo.json` | Demo simulation result | Daily pipeline |
| `public/data/performance.json` | Historical performance data | Daily pipeline |
| `public/data/comparison-results.json` | Strategy vs strategy comparison | Daily pipeline |

## Validation Commands
```bash
# Check data freshness
python3 -c "
import json
from datetime import datetime, timezone
d = json.load(open('public/data/coins-stats.json'))
gen = d.get('generated', 'unknown')
coins = d.get('total_coins', 0)
print(f'Generated: {gen}')
print(f'Total coins: {coins}')
if coins > 0:
    wrs = [c['win_rate'] for c in d['coins'] if c.get('win_rate')]
    print(f'WR range: {min(wrs):.1f}% - {max(wrs):.1f}%')
    print(f'Coins with CoinGecko data: {sum(1 for c in d[\"coins\"] if c.get(\"image\"))}')
"

# Check market.json
python3 -c "
import json
d = json.load(open('public/data/market.json'))
print(f'Generated: {d.get(\"generated\", \"unknown\")}')
print(f'Total market cap: \${d.get(\"total_market_cap_b\", 0):.0f}B')
print(f'BTC dominance: {d.get(\"btc_dominance\", 0):.1f}%')
print(f'Fear & Greed: {d.get(\"fear_greed_value\", \"?\")} ({d.get(\"fear_greed_label\", \"?\")})')
"

# Validate strategy metrics are reasonable
python3 -c "
import json
d = json.load(open('public/data/coins-stats.json'))
coins = d['coins']
anomalies = []
for c in coins:
    if c.get('win_rate', 0) > 100: anomalies.append(f'{c[\"symbol\"]}: WR {c[\"win_rate\"]}%')
    if c.get('profit_factor', 0) > 50: anomalies.append(f'{c[\"symbol\"]}: PF {c[\"profit_factor\"]}')
print(f'Anomalies: {len(anomalies)}')
for a in anomalies[:10]: print(f'  {a}')
"

# Check API matches static data
curl -s https://api.pruviq.com/coins/stats | python3 -c "
import sys, json
d = json.load(sys.stdin)
coins = d.get('coins', [])
print(f'API coin count: {len(coins)}')
"
```

## Backend Scripts (read-only execution)
| Script | Purpose | Schedule |
|--------|---------|----------|
| `backend/scripts/refresh_static.py` | CoinGecko → coins-stats.json + market.json | */15 cron |
| `backend/scripts/full_pipeline.sh` | OHLCV update + demo data + performance | 02:30 UTC daily |
| `backend/scripts/generate_demo_data.py` | Demo simulation JSON | Part of pipeline |
| `backend/scripts/generate_performance_data.py` | Performance history JSON | Part of pipeline |
| `backend/scripts/update_ohlcv.py` | Download 1H candles from Binance | Part of pipeline |

## Workflow
1. Check `generated` timestamps in all JSON files
2. Validate coin count and metric ranges
3. Compare API responses vs static JSON (should match within 15 min)
4. Flag anomalies: missing data, stale files, metric outliers
5. Report: data age, coin counts, anomaly list, API/static consistency

## Boundaries
- NEVER modify backend scripts or server configuration
- NEVER alter production JSON files by hand
- Read-only analysis — report findings, don't fix data directly
- All metric reports must quote exact values from files
