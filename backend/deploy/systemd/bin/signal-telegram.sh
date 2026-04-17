#!/bin/bash
# PRUVIQ — Signal Telegram (DO-native, every hour :05)
# Posts new signals to @PRUVIQ channel. Dedup via state file.
set -uo pipefail

# Use local loopback; signal_telegram.py respects PRUVIQ_API_URL env
export PRUVIQ_API_URL="${PRUVIQ_API_URL:-http://127.0.0.1:8080}"
export SIGNAL_TELEGRAM_CHAT_ID="${SIGNAL_TELEGRAM_CHAT_ID:-@PRUVIQ}"

exec /opt/pruviq/app/.venv/bin/python /opt/pruviq/current/backend/scripts/signal_telegram.py
