#!/bin/bash
# PRUVIQ — OHLCV Update (DO-native, every 4h at :15)
# Fetches latest OHLCV from Binance (via DO proxy) into /opt/pruviq/data/futures/
set -uo pipefail

DATA_DIR="${PRUVIQ_DATA_DIR:-/opt/pruviq/data/futures}"

mkdir -p "$DATA_DIR"
exec /opt/pruviq/app/.venv/bin/python \
    /opt/pruviq/current/backend/scripts/update_ohlcv.py \
    --data-dir "$DATA_DIR"
