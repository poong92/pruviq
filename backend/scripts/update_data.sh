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

# Run update (only fetch new candles since last timestamp)
python3 -c "
import sys
sys.path.insert(0, '.')
from src.data.downloader import OHLCVDownloader
from pathlib import Path

data_dir = Path('$DATA_DIR')
dl = OHLCVDownloader(data_dir)
results = dl.download_all('binance_futures', '1h', days=730, update=True)
print(f'Updated: {results[\"downloaded\"]} coins')
"

# Regenerate demo data (if needed)
if [ "$1" = "--demo" ]; then
    echo "Regenerating demo data..."
    python3 scripts/generate_demo_data.py
fi

echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC') — Data update complete"
