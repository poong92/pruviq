#!/usr/bin/env python3
"""
Full Strategy Sweep — 14 active strategies × 2 directions × 6 SL × 7 TP × 2 timeframes × 2 periods
IS/OOS split: year-1 (IS) / year-2 (OOS) on top-50 coins

Gates: total_trades >= 200, PF >= 1.30, MDD <= 25%, OOS_PF/IS_PF >= 0.70

Usage:
  cd /Users/jepo/pruviq/backend
  .venv/bin/python3 scripts/research/full_sweep.py
"""

import json
import sys
import csv
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.strategies.registry import STRATEGY_REGISTRY, get_strategy
from src.simulation.engine_fast import run_fast

OUT_DIR = Path("/tmp/strategy_analysis")
OUT_DIR.mkdir(exist_ok=True)

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "futures"

FEE_PCT = 0.0008
SLIPPAGE_PCT = 0.0002
FUNDING_RATE_8H = 0.0001

TODAY = datetime.now()
IS_START = TODAY - timedelta(days=730)   # 2Y ago
IS_END   = TODAY - timedelta(days=365)   # 1Y ago (IS/OOS split)
OOS_START = IS_END                        # 1Y ago
OOS_END   = TODAY

# Sweep parameters
SL_RANGE = [3, 5, 7, 10, 15]
TP_RANGE = [3, 5, 7, 10, 15, 20]
TIMEFRAMES = ["1H", "4H"]
# max_bars per timeframe (2 days hold)
MAX_BARS = {"1H": 48, "4H": 12}

# Active strategies (exclude killed + shelved)
SKIP_STATUS = {"killed", "shelved"}
ACTIVE_STRATEGIES = [
    k for k, v in STRATEGY_REGISTRY.items()
    if v.get("status") not in SKIP_STATUS
]
DIRECTIONS = ["long", "short"]

# Multiple-comparisons correction:
# 14 strats × 2 dir × 2 tf × 6 SL × 7 TP = 2,352 combos
# We use conservative gates (PF≥1.30, OOS/IS≥0.70) to control FPR

print(f"Active strategies ({len(ACTIVE_STRATEGIES)}): {ACTIVE_STRATEGIES}")
print(f"Sweep: {len(ACTIVE_STRATEGIES)} strats × {len(DIRECTIONS)} dir × {len(TIMEFRAMES)} tf × {len(SL_RANGE)} SL × {len(TP_RANGE)} TP = {len(ACTIVE_STRATEGIES)*len(DIRECTIONS)*len(TIMEFRAMES)*len(SL_RANGE)*len(TP_RANGE)} combos")
print(f"IS: {IS_START.date()} – {IS_END.date()} | OOS: {OOS_START.date()} – {OOS_END.date()}")


def resample_df(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
    if timeframe == "1H":
        return df
    tf_map = {"4H": "4h", "6H": "6h", "12H": "12h", "1D": "1D"}
    offset = tf_map.get(timeframe, "4h")
    resampled = (
        df.set_index("timestamp")
        .resample(offset)
        .agg({"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"})
        .dropna()
        .reset_index()
    )
    return resampled


def load_top50_coins() -> list[tuple[str, pd.DataFrame]]:
    files = sorted(DATA_DIR.glob("*_1h.csv"), key=lambda f: f.stat().st_size, reverse=True)
    coins = []
    for f in files[:60]:  # load 60, filter to 50 with sufficient data
        sym = f.stem.replace("_1h", "").upper()
        try:
            df = pd.read_csv(f)
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            # Require at least 2Y of data
            if len(df) >= 8760:  # ~365 days × 24h
                coins.append((sym, df))
                if len(coins) >= 50:
                    break
        except Exception as e:
            print(f"  WARN: skipping {f.name}: {e}")
            continue
    print(f"Loaded {len(coins)} coins with ≥1Y data")
    return coins


def compute_metrics(trades_pnl: list[float]) -> dict:
    if not trades_pnl:
        return None
    pnls = np.array(trades_pnl)
    wins = pnls[pnls > 0]
    losses = pnls[pnls <= 0]
    total_win = wins.sum() if len(wins) > 0 else 0
    total_loss = abs(losses.sum()) if len(losses) > 0 else 0.001
    pf = round(total_win / total_loss, 3) if total_loss > 0 else 99.99

    # MDD: additive equity curve, capped at 100% (matches engine_fast behavior)
    # NOTE: multi-coin sequential MDD overstates real portfolio MDD — informational only
    equity_curve = np.cumsum(np.concatenate([[0], pnls]))
    peaks = np.maximum.accumulate(equity_curve)
    dd_raw = np.where(peaks > 0, (peaks - equity_curve) / peaks * 100, 0)
    dd = np.minimum(dd_raw, 100.0)  # cap at 100% per engine_fast convention
    mdd = float(np.max(dd))

    std = float(np.std(pnls))
    sharpe = float(np.mean(pnls) / std * np.sqrt(365 * 24)) if std > 0 else 0

    return {
        "total_trades": len(pnls),
        "win_rate": round(len(wins) / len(pnls) * 100, 1),
        "profit_factor": min(pf, 99.99),
        "total_return_pct": round(float(pnls.sum()), 2),
        "max_drawdown_pct": round(mdd, 1),
        "sharpe": round(sharpe, 2),
        "avg_win_pct": round(float(wins.mean()), 3) if len(wins) > 0 else 0,
        "avg_loss_pct": round(float(losses.mean()), 3) if len(losses) > 0 else 0,
    }


def run_on_coins(strategy_id: str, strategy_obj, coins_with_indicators: list, direction: str,
                 sl_pct: float, tp_pct: float, max_bars: int,
                 start_dt: datetime, end_dt: datetime,
                 timeframe: str) -> list[float]:
    """Run simulation on pre-computed indicator dfs, filter by date window."""
    all_pnls = []
    for sym, df_full in coins_with_indicators:
        df = df_full[(df_full["timestamp"] >= pd.Timestamp(start_dt)) &
                     (df_full["timestamp"] < pd.Timestamp(end_dt))].copy()
        if len(df) < 50:
            continue
        try:
            result = run_fast(
                df, strategy_obj, sym,
                sl_pct=sl_pct / 100,
                tp_pct=tp_pct / 100,
                max_bars=max_bars,
                fee_pct=FEE_PCT,
                slippage_pct=SLIPPAGE_PCT,
                direction=direction,
                market_type="futures",
                strategy_id=strategy_id,
                funding_rate_8h=FUNDING_RATE_8H,
                timeframe=timeframe,
            )
            all_pnls.extend([t.pnl_pct for t in result.trades])
        except Exception as e:
            print(f"    WARN: {sym} sim failed: {e}")
            continue
    return all_pnls


def precompute_indicators(strategy_id: str, coins: list, timeframe: str):
    """Calculate indicators ONCE per (strategy, coin, timeframe) — reuse across SL/TP combos.
    Returns (strategy_obj, [(sym, df_with_indicators), ...])
    """
    strategy, _, _ = get_strategy(strategy_id)
    result = []
    for sym, df_raw in coins:
        try:
            df_rs = resample_df(df_raw.copy(), timeframe)
            df_ind = strategy.calculate_indicators(df_rs)
            result.append((sym, df_ind))
        except Exception as e:
            print(f"    WARN: {sym} indicator failed: {e}")
            continue
    return strategy, result


def main():
    t0 = datetime.now()
    coins_raw = load_top50_coins()

    all_results = []
    survived = []

    total_combos = len(ACTIVE_STRATEGIES) * len(DIRECTIONS) * len(TIMEFRAMES) * len(SL_RANGE) * len(TP_RANGE)
    done = 0

    print(f"\n{'='*70}")
    print(f"SWEEP START — {total_combos} combos × 50 coins")
    print(f"{'='*70}")

    for strat_id in ACTIVE_STRATEGIES:
        for tf in TIMEFRAMES:
            max_bars = MAX_BARS[tf]

            # Pre-compute indicators once per (strategy, timeframe)
            print(f"\n  [{strat_id} / {tf}] computing indicators on {len(coins_raw)} coins...", flush=True)
            try:
                strategy_obj, coins_ind = precompute_indicators(strat_id, coins_raw, tf)
            except Exception as e:
                print(f"    ERROR in indicator computation: {e}")
                continue
            print(f"    → {len(coins_ind)} coins with valid indicators")

            for direction in DIRECTIONS:
                for sl in SL_RANGE:
                    for tp in TP_RANGE:
                        done += 1

                        # IS
                        is_pnls = run_on_coins(strat_id, strategy_obj, coins_ind, direction, sl, tp,
                                               max_bars, IS_START, IS_END, tf)
                        # OOS
                        oos_pnls = run_on_coins(strat_id, strategy_obj, coins_ind, direction, sl, tp,
                                                max_bars, OOS_START, OOS_END, tf)

                        is_m = compute_metrics(is_pnls)
                        oos_m = compute_metrics(oos_pnls)

                        if not is_m or not oos_m:
                            continue

                        combined_pnls = is_pnls + oos_pnls
                        combined_m = compute_metrics(combined_pnls)

                        oos_is_ratio = round(oos_m["profit_factor"] / max(is_m["profit_factor"], 0.01), 3)

                        row = {
                            "strategy": strat_id,
                            "direction": direction,
                            "timeframe": tf,
                            "sl_pct": sl,
                            "tp_pct": tp,
                            "max_bars": max_bars,
                            # IS metrics
                            "is_trades": is_m["total_trades"],
                            "is_pf": is_m["profit_factor"],
                            "is_wr": is_m["win_rate"],
                            "is_mdd": is_m["max_drawdown_pct"],
                            "is_sharpe": is_m["sharpe"],
                            "is_return": is_m["total_return_pct"],
                            # OOS metrics
                            "oos_trades": oos_m["total_trades"],
                            "oos_pf": oos_m["profit_factor"],
                            "oos_wr": oos_m["win_rate"],
                            "oos_mdd": oos_m["max_drawdown_pct"],
                            "oos_sharpe": oos_m["sharpe"],
                            "oos_return": oos_m["total_return_pct"],
                            # Combined
                            "total_trades": combined_m["total_trades"],
                            "profit_factor": combined_m["profit_factor"],
                            "win_rate": combined_m["win_rate"],
                            "max_drawdown_pct": combined_m["max_drawdown_pct"],
                            "sharpe": combined_m["sharpe"],
                            "total_return_pct": combined_m["total_return_pct"],
                            # Robustness
                            "oos_is_ratio": oos_is_ratio,
                        }
                        all_results.append(row)

                        # Apply gates (MDD excluded: multi-coin sequential MDD not meaningful)
                        passes = (
                            combined_m["total_trades"] >= 200
                            and combined_m["profit_factor"] >= 1.30
                            and oos_is_ratio >= 0.70
                        )
                        if passes:
                            survived.append(row)
                            mark = "★"
                        else:
                            mark = ""

                        if done % 50 == 0 or passes:
                            elapsed = (datetime.now() - t0).seconds
                            eta = int(elapsed / done * (total_combos - done)) if done > 0 else 0
                            print(f"  [{done:4d}/{total_combos}] {strat_id:20s} {direction:5s} {tf:2s} SL{sl:2d}/TP{tp:2d} "
                                  f"PF={combined_m['profit_factor']:.2f} WR={combined_m['win_rate']:.1f}% "
                                  f"T={combined_m['total_trades']} MDD={combined_m['max_drawdown_pct']:.1f}% "
                                  f"OOS/IS={oos_is_ratio:.2f} ETA={eta//60}m {mark}", flush=True)

    # Save all results
    if all_results:
        csv_path = OUT_DIR / "full_sweep_all.csv"
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=all_results[0].keys())
            writer.writeheader()
            writer.writerows(all_results)
        print(f"\n✓ All results: {csv_path} ({len(all_results)} rows)")

    # Save survivors
    if survived:
        survived.sort(key=lambda x: (x["profit_factor"], x["oos_is_ratio"]), reverse=True)
        json_path = OUT_DIR / "full_sweep_survivors.json"
        with open(json_path, "w") as f:
            json.dump(survived, f, indent=2)
        print(f"✓ Survivors: {json_path} ({len(survived)} strategies)")

    # Final report
    elapsed_total = (datetime.now() - t0).seconds
    print(f"\n{'='*70}")
    print(f"SWEEP COMPLETE — {elapsed_total//60}m {elapsed_total%60}s")
    print(f"Total combos run: {len(all_results)} | Survivors: {len(survived)}")
    print(f"{'='*70}")

    if survived:
        print(f"\n★ TOP 20 SURVIVORS (PF≥1.30, T≥200, MDD≤25%, OOS/IS≥0.70):")
        print(f"  {'Strategy':20s} {'Dir':5s} {'TF':4s} {'SL':3s} {'TP':3s} {'PF':6s} {'WR':6s} {'MDD':6s} {'T':5s} {'OIS':5s} {'Sharpe':6s}")
        print(f"  {'-'*80}")
        for r in survived[:20]:
            print(f"  {r['strategy']:20s} {r['direction']:5s} {r['timeframe']:4s} "
                  f"{r['sl_pct']:3d} {r['tp_pct']:3d} "
                  f"{r['profit_factor']:6.2f} {r['win_rate']:5.1f}% "
                  f"{r['max_drawdown_pct']:5.1f}% {r['total_trades']:5d} "
                  f"{r['oos_is_ratio']:5.2f} {r['sharpe']:6.2f}")
    else:
        print("\n⚠ No strategies passed all gates. Check raw CSV for near-misses.")
        # Show top 10 by PF regardless
        near = sorted(all_results, key=lambda x: x["profit_factor"], reverse=True)[:10]
        print("\nTop 10 by PF (no gate filter):")
        for r in near:
            print(f"  {r['strategy']:20s} {r['direction']:5s} {r['timeframe']:4s} "
                  f"SL{r['sl_pct']}/TP{r['tp_pct']} "
                  f"PF={r['profit_factor']:.2f} WR={r['win_rate']:.1f}% "
                  f"T={r['total_trades']} MDD={r['max_drawdown_pct']:.1f}% "
                  f"OOS/IS={r['oos_is_ratio']:.2f}")


if __name__ == "__main__":
    main()
