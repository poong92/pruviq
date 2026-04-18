#!/bin/bash
# PRUVIQ — Daily Strategy Ranking (DO-native, daily at 00:05 UTC = 09:05 KST)
# Runs all strategy × period × group simulations via localhost:8080/simulate
# Posts results to Telegram SNS channel.
set -uo pipefail

export PRUVIQ_API_BASE="${PRUVIQ_API_BASE:-http://127.0.0.1:8080}"
export SIGNAL_TELEGRAM_CHAT_ID="${SIGNAL_TELEGRAM_CHAT_ID:-@PRUVIQ}"

exec /opt/pruviq/app/.venv/bin/python \
    /opt/pruviq/current/backend/scripts/daily_strategy_ranking.py \
    --periods 7d,30d,365d \
    --groups 30,50,100,BTC \
    --telegram
