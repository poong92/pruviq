#!/bin/bash
# PRUVIQ — Daily OHLCV Data Update
# Crontab: 0 2 * * * /path/to/update_data.sh >> ~/pruviq-data-update.log 2>&1
#
# Updates existing OHLCV data files with latest candles.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
VENV_DIR="$REPO_DIR/backend/.venv"
DATA_DIR="${PRUVIQ_DATA_DIR:-$HOME/pruviq-data/futures}"

echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') — Starting data update"

# Activate venv
if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
fi

cd "$REPO_DIR/backend"

# Run incremental update (append new candles + dedup)
python3 scripts/update_ohlcv.py --data-dir "$DATA_DIR"

# Regenerate demo data (if needed)
if [ "$1" = "--demo" ]; then
    echo "Regenerating demo data..."
    python3 scripts/generate_demo_data.py
fi

echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') — Data update complete"
