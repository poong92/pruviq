#\!/bin/bash
# Hourly OHLCV update — lightweight (only fetches new bars since last update)
# Safe: uses Public Binance API (no auth), different IP from autotrader
set -euo pipefail
DATA_DIR=/Users/openclaw/pruviq/data/futures
VENV=/Users/openclaw/pruviq/backend/.venv/bin/python
cd /Users/openclaw/pruviq/backend

# Update OHLCV data (appends new 1H bars to CSV)
$VENV scripts/update_ohlcv.py --data-dir "$DATA_DIR" 2>&1 | tail -5

# Signal API to reload (fetches from Binance again + reloads DataManager)
curl -s -X POST http://localhost:8080/admin/refresh 2>/dev/null | head -1 || true

# Force uvicorn to fully reload data from CSV
kill -HUP $(pgrep -u openclaw -f uvicorn) 2>/dev/null || true
echo "[OK] $(date -u +%H:%M) UTC — OHLCV + API reload done"
