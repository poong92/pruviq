#!/usr/bin/env python3
"""
PRUVIQ — Per-Coin Multi-Strategy Stats Generator

Runs MULTIPLE strategies on ALL coins and generates per-coin per-strategy
win_rate / profit_factor / total_return / trades data.

Strategies:
  1. BB Squeeze SHORT  — Registry (AT v1.7.0 parity, verified)
  2. BB Squeeze LONG   — Registry
  3. RSI Reversal LONG — ConditionEngine preset
  4. MACD Momentum LONG — ConditionEngine preset
  5. Stochastic SHORT  — ConditionEngine preset

Called by full_pipeline.sh daily after OHLCV update.
Output: backend/data/coin-strategy-stats.json (read by refresh_static.py)
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd
import numpy as np

# Add backend src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.strategies.registry import get_strategy, STRATEGY_REGISTRY
from src.simulation.engine_fast import run_fast, simulate_vectorized
from src.engine.condition_engine import create_engine_from_preset, PRESET_STRATEGIES

# Data directories
REPO_ROOT = Path(__file__).parent.parent.parent  # pruviq/
PRUVIQ_DATA = REPO_ROOT / "data" / "futures"
AUTOTRADER_DATA = Path.home() / "Desktop" / "autotrader" / "data" / "futures"
OUTPUT = Path(__file__).parent.parent / "data" / "coin-strategy-stats.json"

# Common params
FEE_PCT = 0.0008
SLIPPAGE_PCT = 0.0
MAX_BARS = 48
MIN_ROWS = 500
SKIP = {"intcusdt", "tslausdt", "hoodusdt", "paxgusdt", "gunusdt"}

# Strategies to run — mix of registry + ConditionEngine presets
STRATEGY_CONFIGS = [
    # Registry strategies: use get_strategy() + run_fast()
    {
        "id": "bb-squeeze-short",
        "source": "registry",
        "sl_pct": 0.10,
        "tp_pct": 0.08,
    },
    {
        "id": "bb-squeeze-long",
        "source": "registry",
        "sl_pct": 0.07,
        "tp_pct": 0.06,
    },
    # ConditionEngine presets: use preset's own vectorized signals
    {
        "id": "rsi-reversal-long",
        "source": "preset",
    },
    {
        "id": "macd-momentum-long",
        "source": "preset",
    },
    {
        "id": "stochastic-oversold-short",
        "source": "preset",
    },
]


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


def run_registry_strategy(df: pd.DataFrame, sym: str, config: dict) -> Optional[dict]:
    """Run a registry-based strategy using run_fast()."""
    strategy_id = config["id"]
    strategy, direction, defaults = get_strategy(strategy_id)
    sl_pct = config.get("sl_pct", defaults["sl"] / 100)
    tp_pct = config.get("tp_pct", defaults["tp"] / 100)

    df_with_ind = strategy.calculate_indicators(df.copy())
    result = run_fast(
        df_with_ind, strategy, sym,
        sl_pct=sl_pct, tp_pct=tp_pct, max_bars=MAX_BARS,
        fee_pct=FEE_PCT, slippage_pct=SLIPPAGE_PCT,
        direction=direction, market_type="futures",
        strategy_id=strategy_id,
    )
    if result.total_trades > 0:
        return {
            "trades": result.total_trades,
            "win_rate": result.win_rate,
            "profit_factor": result.profit_factor,
            "total_return_pct": result.total_return_pct,
            "tp_count": result.tp_count,
            "sl_count": result.sl_count,
            "timeout_count": result.timeout_count,
        }
    return None


def run_preset_strategy(df: pd.DataFrame, sym: str, config: dict) -> Optional[dict]:
    """Run a ConditionEngine preset using its vectorized signals + simulate_vectorized."""
    preset_id = config["id"]
    engine = create_engine_from_preset(preset_id)

    # Compute indicators
    df_with_ind = engine.prepare_dataframe(df.copy())

    # Get vectorized signals (fast path)
    signal_indices = engine.find_signals_vectorized(df_with_ind)

    if len(signal_indices) == 0:
        return None

    # Simulate trades
    sl_pct = engine.sl_pct / 100.0
    tp_pct = engine.tp_pct / 100.0
    direction = engine.direction

    trades = simulate_vectorized(
        df_with_ind, signal_indices,
        sl_pct, tp_pct, engine.max_bars,
        FEE_PCT, SLIPPAGE_PCT,
        direction, sym,
    )

    if not trades:
        return None

    total = len(trades)
    wins = [t for t in trades if t.pnl_pct > 0]
    losses = [t for t in trades if t.pnl_pct <= 0]
    gross_profit = sum(t.pnl_pct for t in wins) if wins else 0
    gross_loss = abs(sum(t.pnl_pct for t in losses)) if losses else 0.001
    total_return = sum(t.pnl_pct for t in trades)
    tp_count = sum(1 for t in trades if t.exit_reason == "TP")
    sl_count = sum(1 for t in trades if t.exit_reason == "SL")
    timeout_count = sum(1 for t in trades if t.exit_reason == "TIMEOUT")

    return {
        "trades": total,
        "win_rate": round(len(wins) / total * 100, 1),
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else 0,
        "total_return_pct": round(total_return, 2),
        "tp_count": tp_count,
        "sl_count": sl_count,
        "timeout_count": timeout_count,
    }


def get_strategy_meta(config: dict) -> dict:
    """Get strategy metadata for output JSON."""
    sid = config["id"]
    if config["source"] == "registry":
        entry = STRATEGY_REGISTRY[sid]
        sl = round(config.get("sl_pct", entry["defaults"]["sl"] / 100) * 100, 1)
        tp = round(config.get("tp_pct", entry["defaults"]["tp"] / 100) * 100, 1)
        return {
            "name": entry["name"],
            "direction": entry["direction"],
            "params": {"sl_pct": sl, "tp_pct": tp, "max_bars": MAX_BARS},
            "status": entry.get("status", "experimental"),
        }
    else:
        preset = PRESET_STRATEGIES[sid]
        return {
            "name": preset["name"],
            "direction": preset["direction"],
            "params": {"sl_pct": preset["sl_pct"], "tp_pct": preset["tp_pct"], "max_bars": preset["max_bars"]},
            "status": "experimental",
        }


def main():
    start_time = time.time()
    print(f"=== Multi-Strategy Coin Stats — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ===")

    data_dir = find_data_dir()
    print(f"  Data source: {data_dir}")
    print(f"  Strategies: {len(STRATEGY_CONFIGS)}")
    for cfg in STRATEGY_CONFIGS:
        meta = get_strategy_meta(cfg)
        print(f"    - {meta['name']} ({cfg['id']}, {meta['direction']}, "
              f"SL {meta['params']['sl_pct']}%/TP {meta['params']['tp_pct']}%)")

    # Load all coin files
    files = sorted(data_dir.glob("*_1h.csv"))

    # Initialize per-strategy accumulators
    strategy_results = {}
    for cfg in STRATEGY_CONFIGS:
        strategy_results[cfg["id"]] = {}

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

        # Add hour column (needed by time filters)
        df["hour"] = df["timestamp"].dt.hour

        # Run each strategy on this coin
        for cfg in STRATEGY_CONFIGS:
            try:
                if cfg["source"] == "registry":
                    stats = run_registry_strategy(df, sym, cfg)
                else:
                    stats = run_preset_strategy(df, sym, cfg)

                if stats:
                    strategy_results[cfg["id"]][sym] = stats
            except Exception as e:
                # Silently skip individual strategy failures
                pass

        processed += 1
        if processed % 100 == 0:
            print(f"  Processed {processed} coins...")

    # Build output
    strategies_output = {}
    for cfg in STRATEGY_CONFIGS:
        sid = cfg["id"]
        meta = get_strategy_meta(cfg)
        coins_data = strategy_results[sid]
        strategies_output[sid] = {
            **meta,
            "coins_with_trades": len(coins_data),
            "coins": coins_data,
        }

    # Find best strategy per coin (for Level 0 display)
    best_per_coin = {}
    all_symbols = set()
    for sid, data in strategy_results.items():
        all_symbols.update(data.keys())

    for sym in all_symbols:
        best_sid = None
        best_pf = 0
        for cfg in STRATEGY_CONFIGS:
            sid = cfg["id"]
            if sym in strategy_results[sid]:
                stats = strategy_results[sid][sym]
                # Best = highest profit factor with minimum 5 trades
                if stats["trades"] >= 5 and stats["profit_factor"] > best_pf:
                    best_pf = stats["profit_factor"]
                    best_sid = sid
        if best_sid:
            best_per_coin[sym] = best_sid

    output = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_coins": processed,
        "total_strategies": len(STRATEGY_CONFIGS),
        "strategies": strategies_output,
        "best_strategy": best_per_coin,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    elapsed = time.time() - start_time
    print(f"\n  === Results ===")
    print(f"  Processed: {processed} coins, Skipped: {skipped}")
    for cfg in STRATEGY_CONFIGS:
        sid = cfg["id"]
        count = len(strategy_results[sid])
        print(f"  {sid}: {count} coins with trades")
    print(f"  Best strategy assigned: {len(best_per_coin)} coins")
    print(f"  Output: {OUTPUT} ({OUTPUT.stat().st_size / 1024:.1f} KB)")
    print(f"  Elapsed: {elapsed:.1f}s")
    print("=== Done ===")


if __name__ == "__main__":
    main()
