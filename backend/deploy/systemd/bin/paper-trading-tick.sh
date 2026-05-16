#!/bin/bash
# PRUVIQ — Paper Trading Daily Tick
# Runs one forward day of the active 30-day paper-trading cycle and
# writes the updated state to $PAPER_TRADING_DIR/cycle_NNN.json.
#
# Idempotent: rerunning the same day after a successful tick is a no-op
# (the tracker checks `last_tick_date`).
set -uo pipefail

export PAPER_TRADING_DIR="${PAPER_TRADING_DIR:-/opt/pruviq/data/paper_trading}"
export RANKING_DIR="${RANKING_DIR:-/opt/pruviq/data/rankings}"

# If no cycle exists yet, bootstrap one starting today with $1,000.
# After this first run, subsequent calls just tick forward.
if ! ls "$PAPER_TRADING_DIR"/cycle_*.json >/dev/null 2>&1; then
    /opt/pruviq/app/.venv/bin/python \
        /opt/pruviq/current/backend/scripts/paper_trading_tracker.py \
        --init --start "$(date -u +%Y-%m-%d)" --capital 1000
fi

exec /opt/pruviq/app/.venv/bin/python \
    /opt/pruviq/current/backend/scripts/paper_trading_tracker.py \
    --tick
