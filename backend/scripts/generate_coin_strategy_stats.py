#!/usr/bin/env python3
"""
PRUVIQ — Per-Coin Strategy Stats Generator

Runs BB Squeeze SHORT (v1.7.0 parity) on ALL coins and generates
per-coin win_rate / profit_factor / total_return / trades data.

Called by full_pipeline.sh daily after OHLCV update.
Output: backend/data/coin-strategy-stats.json (read by refresh_static.py)

Uses the fast vectorized engine for performance (~535 coins in ~2 min).
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# Add backend src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.strategies.registry import get_strategy
from src.simulation.engine_fast import run_fast

# Data directories
REPO_ROOT = Path(__file__).parent.parent.parent  # pruviq/
PRUVIQ_DATA = REPO_ROOT / "data" / "futures"
AUTOTRADER_DATA = Path.home() / "Desktop" / "autotrader" / "data" / "futures"
OUTPUT = Path(__file__).parent.parent / "data" / "coin-strategy-stats.json"

# Strategy params (AT v1.7.0 parity)
STRATEGY_ID = "bb-squeeze-short"
SL_PCT = 0.10
TP_PCT = 0.08
MAX_BARS = 48
FEE_PCT = 0.0008
SLIPPAGE_PCT = 0.0
DIRECTION = "short"

MIN_ROWS = 500
SKIP = {"intcusdt", "tslausdt", "hoodusdt", "paxgusdt", "gunusdt"}


def find_data_dir() -> Path:
    """Find available OHLCV data directory."""
    import os
    env_dir = os.getenv("PRUVIQ_DATA_DIR")
    if env_dir:
        p = Path(env_dir)
        if p.exists() and any(p.glob("*_1h.csv")):
            return p
    if PRUVIQ_DATA.exists() and any(PRUVIQ_DATA.glob("*_1h.csv")):
        return PRUVIQ_DATA
    if AUTOTRADER_DATA.exists() and any(AUTOTRADER_DATA.glob("*_1h.csv")):
        return AUTOTRADER_DATA
    raise FileNotFoundError("No OHLCV data found.")


def main():
    start_time = time.time()
    print(f"=== Per-Coin Strategy Stats — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ===")

    data_dir = find_data_dir()
    print(f"  Data source: {data_dir}")

    strategy, direction, defaults = get_strategy(STRATEGY_ID)
    print(f"  Strategy: {STRATEGY_ID}, SL={SL_PCT*100}%, TP={TP_PCT*100}%")

    # Load all coins
    files = sorted(data_dir.glob("*_1h.csv"))
    coin_stats = {}
    processed = 0
    skipped = 0

    for f in files:
        stem = f.stem.replace("_1h", "")
        sym = stem.upper()

        if stem.lower() in SKIP:
            skipped += 1
            continue

        try:
            df = pd.read_csv(f)
        except Exception:
            skipped += 1
            continue
        if len(df) < MIN_ROWS:
            skipped += 1
            continue

        try:
            df["timestamp"] = pd.to_datetime(df["timestamp"])
        except (ValueError, TypeError):
            skipped += 1
            continue

        try:
            # Calculate indicators once
            df_with_ind = strategy.calculate_indicators(df.copy())

            # Run fast simulation
            result = run_fast(
                df_with_ind, strategy, sym,
                sl_pct=SL_PCT, tp_pct=TP_PCT, max_bars=MAX_BARS,
                fee_pct=FEE_PCT, slippage_pct=SLIPPAGE_PCT,
                direction=DIRECTION, market_type="futures",
                strategy_id=STRATEGY_ID,
            )

            if result.total_trades > 0:
                coin_stats[sym] = {
                    "trades": result.total_trades,
                    "win_rate": result.win_rate,
                    "profit_factor": result.profit_factor,
                    "total_return_pct": result.total_return_pct,
                    "tp_count": result.tp_count,
                    "sl_count": result.sl_count,
                    "timeout_count": result.timeout_count,
                }
        except Exception as e:
            print(f"  WARN: {sym} failed: {e}")

        processed += 1
        if processed % 100 == 0:
            print(f"  Processed {processed} coins...")

    # Write output
    output = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "strategy": STRATEGY_ID,
        "params": {"sl_pct": SL_PCT * 100, "tp_pct": TP_PCT * 100, "max_bars": MAX_BARS},
        "total_coins": processed,
        "coins_with_trades": len(coin_stats),
        "coins": coin_stats,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    elapsed = time.time() - start_time
    print(f"  Processed: {processed} coins, Skipped: {skipped}")
    print(f"  Coins with trades: {len(coin_stats)}")
    print(f"  Output: {OUTPUT} ({OUTPUT.stat().st_size / 1024:.1f} KB)")
    print(f"  Elapsed: {elapsed:.1f}s")
    print("=== Done ===")


if __name__ == "__main__":
    main()
