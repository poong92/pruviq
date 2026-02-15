#!/usr/bin/env python3
"""
PRUVIQ Demo Data Generator

Runs BB Squeeze SHORT simulation on top 50 coins × 25 SL/TP combinations.
Outputs a pre-computed JSON file for the interactive frontend demo.

Usage:
    python3 backend/scripts/generate_demo_data.py

Data source:
    Uses existing 1H OHLCV CSV files from autotrader or pruviq data dir.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# Add backend src to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.strategies.bb_squeeze import BBSqueezeStrategy
from src.simulation.engine import SimulationEngine, CostModel

# Data directories (try pruviq first, then autotrader)
PRUVIQ_DATA = Path(__file__).parent.parent / "data" / "futures"
AUTOTRADER_DATA = Path.home() / "Desktop" / "autotrader" / "data" / "futures"
OUTPUT_FILE = Path(__file__).parent.parent.parent / "public" / "data" / "demo-results.json"

# Grid parameters
SL_VALUES = [5, 7, 8, 10, 12]
TP_VALUES = [4, 6, 8, 10, 12]
TOP_N_COINS = 50
AVOID_HOURS = [2, 3, 10, 20, 21, 22, 23]
MAX_BARS = 48
DIRECTION = "short"


def find_data_dir() -> Path:
    """Find available OHLCV data directory."""
    if PRUVIQ_DATA.exists() and any(PRUVIQ_DATA.glob("*_1h.csv")):
        return PRUVIQ_DATA
    if AUTOTRADER_DATA.exists() and any(AUTOTRADER_DATA.glob("*_1h.csv")):
        return AUTOTRADER_DATA
    raise FileNotFoundError("No OHLCV data found. Run download_data.py first.")


def load_top_coins(data_dir: Path, n: int) -> list[tuple[str, pd.DataFrame]]:
    """Load top N coins by file size (proxy for data quality/volume)."""
    files = sorted(data_dir.glob("*_1h.csv"), key=lambda f: f.stat().st_size, reverse=True)

    # Filter out non-crypto and known problematic symbols
    skip = {"intcusdt", "tslausdt", "hoodusdt", "paxgusdt", "gunusdt"}
    coins = []

    for f in files:
        sym = f.stem.replace("_1h", "").upper()
        if f.stem.replace("_1h", "") in skip:
            continue

        df = pd.read_csv(f)
        if len(df) < 500:  # Need enough data for meaningful backtest
            continue

        df["timestamp"] = pd.to_datetime(df["timestamp"])
        coins.append((sym, df))

        if len(coins) >= n:
            break

    return coins


def downsample_equity_curve(times: list, values: list, n_points: int = 100) -> list[dict]:
    """Downsample equity curve to n_points with unique dates for Lightweight Charts."""
    if not values:
        return []

    # First, aggregate to unique dates (take last value per date)
    date_values: dict[str, float] = {}
    for t, v in zip(times, values):
        date_values[t] = v  # last value per date wins

    unique_dates = sorted(date_values.keys())
    unique_vals = [date_values[d] for d in unique_dates]

    if len(unique_vals) <= n_points:
        return [{"time": d, "value": round(v, 2)} for d, v in zip(unique_dates, unique_vals)]

    indices = np.linspace(0, len(unique_vals) - 1, n_points, dtype=int)
    # Ensure unique indices
    indices = sorted(set(indices))
    return [{"time": unique_dates[i], "value": round(unique_vals[i], 2)} for i in indices]


def run_grid(coins: list[tuple[str, pd.DataFrame]]) -> dict:
    """Run all SL×TP combinations across all coins."""
    results = {}
    total_combos = len(SL_VALUES) * len(TP_VALUES)

    for ci, (sl, tp) in enumerate([(s, t) for s in SL_VALUES for t in TP_VALUES], 1):
        key = f"sl{sl}_tp{tp}"
        print(f"  [{ci:2d}/{total_combos}] SL={sl}% TP={tp}% ...", end=" ", flush=True)

        strategy = BBSqueezeStrategy(avoid_hours=AVOID_HOURS)
        engine = SimulationEngine(
            sl_pct=sl / 100,
            tp_pct=tp / 100,
            max_bars=MAX_BARS,
            cost_model=CostModel.futures(),
            direction=DIRECTION,
        )

        # Collect all trades from all coins
        all_trades = []
        for sym, df in coins:
            result = engine.run(df, strategy, sym, market_type="futures")
            for trade in result.trades:
                all_trades.append({
                    "time": trade.entry_time,
                    "pnl_pct": trade.pnl_pct,
                    "exit_reason": trade.exit_reason,
                })

        if not all_trades:
            results[key] = {
                "win_rate": 0, "profit_factor": 0, "total_return_pct": 0,
                "max_drawdown_pct": 0, "total_trades": 0,
                "tp_count": 0, "sl_count": 0, "timeout_count": 0,
                "equity_curve": [],
            }
            print("0 trades")
            continue

        # Sort all trades by time for realistic equity curve
        all_trades.sort(key=lambda t: t["time"])

        # Calculate aggregate metrics
        wins = [t for t in all_trades if t["pnl_pct"] > 0]
        losses = [t for t in all_trades if t["pnl_pct"] <= 0]
        gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0
        gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.001
        total_return = sum(t["pnl_pct"] for t in all_trades)

        # Equity curve with MDD
        equity = 0.0
        peak = 0.0
        max_dd = 0.0
        eq_times = []
        eq_values = []

        for t in all_trades:
            equity += t["pnl_pct"]
            peak = max(peak, equity)
            dd = peak - equity
            max_dd = max(max_dd, dd)
            eq_times.append(t["time"][:10])  # date only
            eq_values.append(equity)

        # Exit reason counts
        tp_count = sum(1 for t in all_trades if t["exit_reason"] == "tp")
        sl_count = sum(1 for t in all_trades if t["exit_reason"] == "sl")
        timeout_count = sum(1 for t in all_trades if t["exit_reason"] == "timeout")

        results[key] = {
            "win_rate": round(len(wins) / len(all_trades) * 100, 1),
            "profit_factor": round(gross_profit / gross_loss, 2),
            "total_return_pct": round(total_return, 1),
            "max_drawdown_pct": round(max_dd, 1),
            "total_trades": len(all_trades),
            "tp_count": tp_count,
            "sl_count": sl_count,
            "timeout_count": timeout_count,
            "equity_curve": downsample_equity_curve(eq_times, eq_values),
        }

        print(f"{len(all_trades)} trades, WR={results[key]['win_rate']}%, PF={results[key]['profit_factor']}")

    return results


def main():
    print("=" * 60)
    print("PRUVIQ Demo Data Generator")
    print("=" * 60)

    # Find data
    data_dir = find_data_dir()
    print(f"Data source: {data_dir}")

    # Load coins
    print(f"\nLoading top {TOP_N_COINS} coins...")
    coins = load_top_coins(data_dir, TOP_N_COINS)
    print(f"  Loaded {len(coins)} coins")

    if not coins:
        print("ERROR: No coins loaded.")
        sys.exit(1)

    # Date range
    first_date = coins[0][1]["timestamp"].min().strftime("%Y-%m")
    last_date = coins[0][1]["timestamp"].max().strftime("%Y-%m")

    # Run grid
    print(f"\nRunning {len(SL_VALUES)}×{len(TP_VALUES)} = {len(SL_VALUES)*len(TP_VALUES)} parameter combinations...")
    results = run_grid(coins)

    # Build output
    output = {
        "generated": datetime.now().isoformat(),
        "coins": len(coins),
        "data_range": f"{first_date} ~ {last_date}",
        "strategy": "BB Squeeze SHORT",
        "fixed_params": {
            "max_bars": MAX_BARS,
            "direction": DIRECTION,
            "avoid_hours": AVOID_HOURS,
            "bb_period": 20,
            "bb_std": 2.0,
            "volume_ratio": 2.0,
            "expansion_rate": 0.10,
        },
        "grid": {
            "sl_values": SL_VALUES,
            "tp_values": TP_VALUES,
        },
        "results": results,
    }

    # Write
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=None, separators=(",", ":"))

    size_kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"\nOutput: {OUTPUT_FILE}")
    print(f"Size: {size_kb:.1f} KB")
    print("Done!")


if __name__ == "__main__":
    main()
