#!/usr/bin/env python3
"""
PRUVIQ Demo Data Generator — Multi-Strategy

Runs all 5 strategies on top 50 coins x 25 SL/TP combinations.
Outputs per-strategy JSON files + a comparison JSON for the frontend.

Usage:
    python3 backend/scripts/generate_demo_data.py

Output files:
    public/data/demo-bb-squeeze-short.json
    public/data/demo-bb-squeeze-long.json
    public/data/demo-momentum-long.json
    public/data/demo-atr-breakout.json
    public/data/demo-hv-squeeze.json
    public/data/demo-results.json  (copy of bb-squeeze-short for backwards compat)
    public/data/comparison-results.json
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# Add backend src to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.strategies.registry import STRATEGY_REGISTRY, get_strategy
from src.simulation.engine import SimulationEngine, CostModel

# Data directories
PRUVIQ_DATA = Path(__file__).parent.parent / "data" / "futures"
AUTOTRADER_DATA = Path.home() / "Desktop" / "autotrader" / "data" / "futures"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "public" / "data"

# Grid parameters
SL_VALUES = [5, 7, 8, 10, 12]
TP_VALUES = [4, 6, 8, 10, 12]
TOP_N_COINS = 50
MAX_BARS = 48


def find_data_dir() -> Path:
    """Find available OHLCV data directory."""
    if PRUVIQ_DATA.exists() and any(PRUVIQ_DATA.glob("*_1h.csv")):
        return PRUVIQ_DATA
    if AUTOTRADER_DATA.exists() and any(AUTOTRADER_DATA.glob("*_1h.csv")):
        return AUTOTRADER_DATA
    raise FileNotFoundError("No OHLCV data found. Run download_data.py first.")


def load_top_coins(data_dir: Path, n: int) -> list[tuple[str, pd.DataFrame]]:
    """Load top N coins by file size."""
    files = sorted(data_dir.glob("*_1h.csv"), key=lambda f: f.stat().st_size, reverse=True)
    skip = {"intcusdt", "tslausdt", "hoodusdt", "paxgusdt", "gunusdt"}
    coins = []

    for f in files:
        sym = f.stem.replace("_1h", "").upper()
        if f.stem.replace("_1h", "") in skip:
            continue
        df = pd.read_csv(f)
        if len(df) < 500:
            continue
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        coins.append((sym, df))
        if len(coins) >= n:
            break

    return coins


def downsample_equity_curve(times: list, values: list, n_points: int = 100) -> list[dict]:
    """Downsample equity curve to n_points."""
    if not values:
        return []

    date_values: dict[str, float] = {}
    for t, v in zip(times, values):
        date_values[t] = v

    unique_dates = sorted(date_values.keys())
    unique_vals = [date_values[d] for d in unique_dates]

    if len(unique_vals) <= n_points:
        return [{"time": d, "value": round(v, 2)} for d, v in zip(unique_dates, unique_vals)]

    indices = sorted(set(np.linspace(0, len(unique_vals) - 1, n_points, dtype=int)))
    return [{"time": unique_dates[i], "value": round(unique_vals[i], 2)} for i in indices]


def simulate_grid(coins: list[tuple[str, pd.DataFrame]], strategy, direction: str, strategy_name: str) -> dict:
    """Run SL x TP grid for a single strategy."""
    results = {}
    total_combos = len(SL_VALUES) * len(TP_VALUES)

    for ci, (sl, tp) in enumerate([(s, t) for s in SL_VALUES for t in TP_VALUES], 1):
        key = f"sl{sl}_tp{tp}"
        print(f"    [{ci:2d}/{total_combos}] SL={sl}% TP={tp}% ...", end=" ", flush=True)

        engine = SimulationEngine(
            sl_pct=sl / 100,
            tp_pct=tp / 100,
            max_bars=MAX_BARS,
            cost_model=CostModel.futures(),
            direction=direction,
        )

        all_trades = []
        for sym, raw_df in coins:
            df = strategy.calculate_indicators(raw_df.copy())
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

        all_trades.sort(key=lambda t: t["time"])
        wins = [t for t in all_trades if t["pnl_pct"] > 0]
        losses = [t for t in all_trades if t["pnl_pct"] <= 0]
        gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0
        gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.001
        total_return = sum(t["pnl_pct"] for t in all_trades)

        equity = 0.0
        peak = 0.0
        max_dd = 0.0
        eq_times = []
        eq_values = []
        for t in all_trades:
            equity += t["pnl_pct"]
            peak = max(peak, equity)
            max_dd = max(max_dd, peak - equity)
            eq_times.append(t["time"][:10])
            eq_values.append(equity)

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
    print("PRUVIQ Multi-Strategy Demo Data Generator")
    print("=" * 60)

    data_dir = find_data_dir()
    print(f"Data source: {data_dir}")

    print(f"\nLoading top {TOP_N_COINS} coins...")
    coins = load_top_coins(data_dir, TOP_N_COINS)
    print(f"  Loaded {len(coins)} coins")

    if not coins:
        print("ERROR: No coins loaded.")
        sys.exit(1)

    first_date = coins[0][1]["timestamp"].min().strftime("%Y-%m-%d")
    last_date = coins[0][1]["timestamp"].max().strftime("%Y-%m-%d")
    data_range = f"{first_date} ~ {last_date}"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Generate per-strategy demo JSONs
    comparison_data = {}

    for strategy_id, entry in STRATEGY_REGISTRY.items():
        strategy, direction, defaults = get_strategy(strategy_id)
        print(f"\n{'='*40}")
        print(f"Strategy: {entry['name']} ({strategy_id})")
        print(f"Direction: {direction}, Default SL={defaults['sl']}% TP={defaults['tp']}%")
        print(f"{'='*40}")

        results = simulate_grid(coins, strategy, direction, entry["name"])

        # Per-strategy JSON
        output = {
            "generated": datetime.now().isoformat(),
            "coins": len(coins),
            "data_range": data_range,
            "strategy": entry["name"],
            "strategy_id": strategy_id,
            "direction": direction,
            "status": entry["status"],
            "fixed_params": {
                "max_bars": MAX_BARS,
                "direction": direction,
                **strategy.get_params(),
            },
            "grid": {
                "sl_values": SL_VALUES,
                "tp_values": TP_VALUES,
            },
            "results": results,
        }

        out_file = OUTPUT_DIR / f"demo-{strategy_id}.json"
        with open(out_file, "w") as f:
            json.dump(output, f, indent=None, separators=(",", ":"))
        print(f"  Output: {out_file} ({out_file.stat().st_size / 1024:.1f} KB)")

        # Collect default result for comparison
        default_key = f"sl{defaults['sl']}_tp{defaults['tp']}"
        comparison_data[strategy_id] = {
            "name": entry["name"],
            "direction": direction,
            "status": entry["status"],
            "defaults": defaults,
            "results": {k: v for k, v in results.items()},
        }

    # Backwards compat: copy bb-squeeze-short as demo-results.json
    bb_file = OUTPUT_DIR / "demo-bb-squeeze-short.json"
    compat_file = OUTPUT_DIR / "demo-results.json"
    if bb_file.exists():
        import shutil
        shutil.copy2(bb_file, compat_file)
        print(f"\nBackwards compat: {compat_file}")

    # Comparison JSON
    comparison_output = {
        "generated": datetime.now().isoformat(),
        "coins": len(coins),
        "data_range": data_range,
        "grid": {
            "sl_values": SL_VALUES,
            "tp_values": TP_VALUES,
        },
        "strategies": comparison_data,
    }

    comp_file = OUTPUT_DIR / "comparison-results.json"
    with open(comp_file, "w") as f:
        json.dump(comparison_output, f, indent=None, separators=(",", ":"))
    print(f"Comparison: {comp_file} ({comp_file.stat().st_size / 1024:.1f} KB)")

    print("\nDone!")


if __name__ == "__main__":
    main()
