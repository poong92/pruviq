#!/usr/bin/env python3
"""
PRUVIQ Demo Data Generator — Multi-Strategy (engine_fast)

Runs all registered strategies on top 50 coins × 25 SL/TP combinations.
Uses the same vectorized engine (run_fast) as the API for result parity.

Output files (public/data/):
    demo-{strategy_id}.json   — per-strategy SL×TP grid results
    demo-results.json         — copy of bb-squeeze-short (backwards compat)
    comparison-results.json   — all strategies' default results for comparison page
"""

import json
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# Add backend src to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.strategies.registry import STRATEGY_REGISTRY, get_strategy
from src.simulation.engine_fast import run_fast

# Data directories
PRUVIQ_DATA = Path(__file__).parent.parent / "data" / "futures"
AUTOTRADER_DATA = Path.home() / "Desktop" / "autotrader" / "data" / "futures"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "public" / "data"

# Grid parameters
SL_VALUES = [5, 7, 8, 10, 12]
TP_VALUES = [4, 5, 6, 8, 10, 12]
TOP_N_COINS = 50
MAX_BARS = 48

# Cost model — matches CostModel.futures() and run_fast defaults
FEE_PCT = 0.0008       # 0.08% per side (futures taker)
SLIPPAGE_PCT = 0.0002  # 0.02%
FUNDING_RATE_8H = 0.0001  # 0.01% per 8h


def find_data_dir() -> Path:
    """Find available OHLCV data directory."""
    if PRUVIQ_DATA.exists() and any(PRUVIQ_DATA.glob("*_1h.csv")):
        return PRUVIQ_DATA
    if AUTOTRADER_DATA.exists() and any(AUTOTRADER_DATA.glob("*_1h.csv")):
        return AUTOTRADER_DATA
    raise FileNotFoundError("No OHLCV data found. Run download_data.py first.")


def load_top_coins(data_dir: Path, n: int) -> list[tuple[str, pd.DataFrame]]:
    """Load top N coins matching API's market-cap order.

    1. Query the running PRUVIQ API for its coin list (sorted by CoinGecko market cap).
    2. Load only those symbols from local CSV files.
    3. Fallback: file-size order if API is unreachable.
    """
    import urllib.request

    skip = {"intcusdt", "tslausdt", "hoodusdt", "paxgusdt", "gunusdt"}

    # Try to get market-cap-ordered symbols from the running API
    api_order = []
    try:
        with urllib.request.urlopen("http://127.0.0.1:8080/coins", timeout=5) as resp:
            api_coins = json.loads(resp.read())
            api_order = [c["symbol"] for c in api_coins if c["symbol"].lower() not in skip]
            print(f"  Using API market-cap order ({len(api_coins)} coins available)")
    except Exception:
        print("  API unavailable — falling back to file-size order")

    # Build lookup: symbol -> CSV file
    csv_lookup = {}
    for f in data_dir.glob("*_1h.csv"):
        sym = f.stem.replace("_1h", "").upper()
        csv_lookup[sym] = f

    # Load coins in API order (market cap), fallback to file-size order
    if api_order:
        ordered_syms = [s for s in api_order if s in csv_lookup]
    else:
        ordered_syms = [
            f.stem.replace("_1h", "").upper()
            for f in sorted(data_dir.glob("*_1h.csv"), key=lambda f: f.stat().st_size, reverse=True)
            if f.stem.replace("_1h", "").lower() not in skip
        ]

    coins = []
    for sym in ordered_syms:
        if sym.lower() in skip:
            continue
        f = csv_lookup.get(sym)
        if not f:
            continue
        df = pd.read_csv(f)
        if len(df) < 500:
            continue
        df["timestamp"] = pd.to_datetime(df["timestamp"], format="ISO8601")
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


def simulate_grid(
    coins: list[tuple[str, pd.DataFrame]],
    strategy,
    direction: str,
    strategy_id: str,
) -> dict:
    """Run SL × TP grid for a single strategy using engine_fast.

    Indicators are computed once per coin (outside SL/TP loop) since
    SL/TP only affect exit conditions, not entry signals.
    """
    results = {}
    total_combos = len(SL_VALUES) * len(TP_VALUES)

    # Pre-compute indicators for all coins — once per strategy
    print(f"  Pre-computing indicators for {len(coins)} coins...", flush=True)
    t0 = time.time()
    prepared_coins = []
    for sym, raw_df in coins:
        df = strategy.calculate_indicators(raw_df.copy())
        prepared_coins.append((sym, df))
    print(f"  Indicators ready ({time.time() - t0:.1f}s)")

    for ci, (sl, tp) in enumerate([(s, t) for s in SL_VALUES for t in TP_VALUES], 1):
        key = f"sl{sl}_tp{tp}"
        print(f"    [{ci:2d}/{total_combos}] SL={sl}% TP={tp}% ...", end=" ", flush=True)

        all_trades = []
        for sym, df in prepared_coins:
            result = run_fast(
                df, strategy, sym,
                sl_pct=sl / 100,
                tp_pct=tp / 100,
                max_bars=MAX_BARS,
                fee_pct=FEE_PCT,
                slippage_pct=SLIPPAGE_PCT,
                direction=direction,
                market_type="futures",
                strategy_id=strategy_id,
                funding_rate_8h=FUNDING_RATE_8H,
                timeframe="1H",
            )
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

        # Normalize by coin count — matches API /simulate logic (main.py:761)
        n_coins = len(prepared_coins) or 1
        total_return = round(sum(t["pnl_pct"] for t in all_trades) / n_coins, 4)

        # Equity curve + MDD: 100-based, capital-distributed (matches API main.py:769-790)
        equity = 100.0
        peak = equity
        max_dd = 0.0
        eq_times = []
        eq_values = []
        for t in all_trades:
            equity += t["pnl_pct"] / n_coins
            peak = max(peak, equity)
            dd_pct = (peak - equity) / peak * 100 if peak > 0 else 0.0
            dd_pct = min(dd_pct, 100.0)
            max_dd = max(max_dd, dd_pct)
            eq_times.append(t["time"][:10])
            eq_values.append(equity - 100.0)  # Return % for frontend

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
    t_start = time.time()
    print("=" * 60)
    print("PRUVIQ Demo Data Generator (engine_fast)")
    print(f"Strategies: {len(STRATEGY_REGISTRY)} | Grid: {len(SL_VALUES)}×{len(TP_VALUES)} = {len(SL_VALUES)*len(TP_VALUES)} combos")
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
        t_strat = time.time()
        print(f"\n{'='*40}")
        print(f"Strategy: {entry['name']} ({strategy_id})")
        print(f"Direction: {direction}, Default SL={defaults['sl']}% TP={defaults['tp']}%")
        print(f"{'='*40}")

        results = simulate_grid(coins, strategy, direction, strategy_id)

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
        elapsed = time.time() - t_strat
        print(f"  Output: {out_file} ({out_file.stat().st_size / 1024:.1f} KB) [{elapsed:.1f}s]")

        # Collect for comparison
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

    total_elapsed = time.time() - t_start
    print(f"\nDone! Total: {total_elapsed:.0f}s ({total_elapsed/60:.1f}min)")


if __name__ == "__main__":
    main()
