#!/bin/bash
# PRUVIQ — OHLCV Update (DO-native, every 4h at :15)
# Fetches latest OHLCV from OKX USDT-SWAP directly. The older Binance path
# is retained (backend/scripts/update_ohlcv.py) for audit / rollback, but
# Binance blocks DO's Singapore IP + CF edge, so only OKX runs in production.
#
# Env:
#   PRUVIQ_DATA_DIR  — target futures/ dir (default /opt/pruviq/data/futures)
#   PRUVIQ_OKX_NEW_SYMBOLS — space-separated OKX-only symbols to seed if missing
#                            (default: 5 meme coins chosen 2026-04-17)
set -uo pipefail

DATA_DIR="${PRUVIQ_DATA_DIR:-/opt/pruviq/data/futures}"
NEW_SYMBOLS="${PRUVIQ_OKX_NEW_SYMBOLS:-SHIBUSDT PEPEUSDT BONKUSDT FLOKIUSDT SATSUSDT}"

mkdir -p "$DATA_DIR"
exec /opt/pruviq/app/.venv/bin/python \
    /opt/pruviq/current/backend/scripts/update_ohlcv_okx.py \
    --data-dir "$DATA_DIR" \
    --new-symbols $NEW_SYMBOLS
