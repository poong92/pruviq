#!/usr/bin/env python3
"""
Deep Strategy Analysis v3 — 엔진 직접 호출 (API rate limit 없음)
16전략 × long/short/both × 기간 × SL/TP × 변수 조합 × 포트폴리오

결과: /tmp/strategy_analysis/ 에 CSV + JSON
"""

import json
import sys
import time
import csv
from datetime import datetime, timedelta
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from src.strategies.registry import STRATEGY_REGISTRY, get_strategy
from src.simulation.engine_fast import run_fast

OUT_DIR = Path("/tmp/strategy_analysis")
OUT_DIR.mkdir(exist_ok=True)

# Data
PRUVIQ_DATA = Path(__file__).parent.parent / "data" / "futures"
AUTOTRADER_DATA = Path.home() / "Desktop" / "autotrader" / "data" / "futures"

# Cost model
FEE_PCT = 0.0008
SLIPPAGE_PCT = 0.0002
FUNDING_RATE_8H = 0.0001

# Strategy list
STRATEGIES = list(STRATEGY_REGISTRY.keys())

# Period dates
TODAY = datetime.now()
PERIODS = {
    "3m": TODAY - timedelta(days=90),
    "6m": TODAY - timedelta(days=180),
    "1y": TODAY - timedelta(days=365),
    "2y": TODAY - timedelta(days=730),
}

SL_RANGE = [3, 5, 7, 10, 15]
TP_RANGE = [3, 5, 8, 10, 15]
MAX_BARS_RANGE = [12, 24, 48, 72, 96, 168]


def find_data_dir():
    if PRUVIQ_DATA.exists() and any(PRUVIQ_DATA.glob("*_1h.csv")):
        return PRUVIQ_DATA
    if AUTOTRADER_DATA.exists() and any(AUTOTRADER_DATA.glob("*_1h.csv")):
        return AUTOTRADER_DATA
    raise FileNotFoundError("No OHLCV data found")


def load_coins(data_dir, symbols=None, top_n=50):
    """Load coin data. If symbols given, load specific. Otherwise top_n by file size."""
    files = sorted(data_dir.glob("*_1h.csv"), key=lambda f: f.stat().st_size, reverse=True)

    coins = []
    for f in files:
        sym = f.stem.replace("_1h", "").upper()
        if symbols and sym not in [s.upper() for s in symbols]:
            continue
        if not symbols and len(coins) >= top_n:
            break
        try:
            df = pd.read_csv(f)
            if "timestamp" in df.columns:
                df["timestamp"] = pd.to_datetime(df["timestamp"])
            if len(df) > 100:
                coins.append((sym, df))
        except Exception:
            continue

    return coins


def filter_by_period(df, start_date):
    """Filter dataframe by start date."""
    if start_date and "timestamp" in df.columns:
        return df[df["timestamp"] >= pd.Timestamp(start_date)].copy()
    return df


def run_simulation(strategy_id, coins, direction, sl_pct, tp_pct,
                   max_bars=48, start_date=None, avoid_hours=None,
                   min_vol_regime=None):
    """Run simulation across coins. Returns aggregated metrics."""
    strategy, default_dir, defaults = get_strategy(strategy_id)

    if avoid_hours is not None:
        strategy.avoid_hours = avoid_hours
    if min_vol_regime is not None:
        strategy.min_vol_regime = min_vol_regime

    actual_dir = direction if direction else default_dir
    if actual_dir == "both":
        dirs_to_run = ["long", "short"]
    else:
        dirs_to_run = [actual_dir]

    all_trades = []
    for run_dir in dirs_to_run:
        for sym, df_full in coins:
            df = filter_by_period(df_full, start_date)
            if len(df) < 100:
                continue
            df = strategy.calculate_indicators(df.copy())

            result = run_fast(
                df, strategy, sym,
                sl_pct=sl_pct / 100,
                tp_pct=tp_pct / 100,
                max_bars=max_bars,
                fee_pct=FEE_PCT,
                slippage_pct=SLIPPAGE_PCT,
                direction=run_dir,
                market_type="futures",
                strategy_id=strategy_id,
                funding_rate_8h=FUNDING_RATE_8H,
            )

            for trade in result.trades:
                all_trades.append({
                    "pnl_pct": trade.pnl_pct,
                    "exit_reason": trade.exit_reason,
                    "symbol": sym,
                    "direction": run_dir,
                })

    if not all_trades:
        return None

    pnls = [t["pnl_pct"] for t in all_trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]

    total_win = sum(wins) if wins else 0
    total_loss = abs(sum(losses)) if losses else 0.001

    # Equity curve for MDD
    equity = [100]
    for p in pnls:
        equity.append(equity[-1] * (1 + p / 100))
    equity_arr = np.array(equity)
    peaks = np.maximum.accumulate(equity_arr)
    dd = (peaks - equity_arr) / peaks * 100
    mdd = float(np.max(dd))

    # Sharpe (annualized)
    pnl_arr = np.array(pnls)
    sharpe = float(np.mean(pnl_arr) / np.std(pnl_arr) * np.sqrt(365 * 24 / max(len(pnls), 1))) if np.std(pnl_arr) > 0 else 0

    return {
        "strategy": strategy_id,
        "direction": actual_dir,
        "sl_pct": sl_pct,
        "tp_pct": tp_pct,
        "max_bars": max_bars,
        "total_trades": len(all_trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(all_trades) * 100, 1),
        "profit_factor": round(total_win / total_loss, 2) if total_loss > 0 else 999.99,
        "total_return_pct": round(sum(pnls), 2),
        "max_drawdown_pct": round(mdd, 1),
        "sharpe": round(sharpe, 2),
        "avg_win_pct": round(np.mean(wins), 2) if wins else 0,
        "avg_loss_pct": round(np.mean(losses), 2) if losses else 0,
        "coins_used": len(set(t["symbol"] for t in all_trades)),
    }


def save_results(results, filename):
    if not results:
        print(f"  [skip] {filename}: no data")
        return
    csv_path = OUT_DIR / f"{filename}.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)
    json_path = OUT_DIR / f"{filename}.json"
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"  ✓ {csv_path.name}: {len(results)} rows")


# ============================================================
# PHASE 1: 16전략 × 3방향 × 4기간 — BTC only
# ============================================================
def phase1(btc_data):
    print("\n" + "="*70)
    print("PHASE 1: 16전략 × 3방향 × 4기간 — BTC only")
    print("="*70)

    results = []
    directions = [None, "long", "short", "both"]
    total = len(STRATEGIES) * len(directions) * len(PERIODS)
    done = 0

    for strat in STRATEGIES:
        for direction in directions:
            for period_name, start_dt in PERIODS.items():
                done += 1
                dir_label = direction or "default"

                r = run_simulation(
                    strat, btc_data, direction,
                    sl_pct=7, tp_pct=7,
                    start_date=start_dt,
                )
                if r and r["total_trades"] > 0:
                    r["period"] = period_name
                    results.append(r)
                    pf = r["profit_factor"]
                    wr = r["win_rate"]
                    mark = "★" if pf > 1.1 and wr > 50 else ("▸" if pf > 1.0 else "")
                    if done % 10 == 0 or mark:
                        print(f"  [{done}/{total}] {strat:20s} {dir_label:7s} {period_name}: PF={pf:.2f} WR={wr:.1f}% T={r['total_trades']} {mark}")
                else:
                    if done % 20 == 0:
                        print(f"  [{done}/{total}] {strat:20s} {dir_label:7s} {period_name}: 0 trades")

    save_results(results, "phase1_full_matrix")

    # 요약
    profitable = [r for r in results if r["profit_factor"] > 1.0 and r["total_trades"] >= 10]
    strong = [r for r in results if r["profit_factor"] > 1.1 and r["win_rate"] > 50 and r["total_trades"] >= 10]

    print(f"\n  Total: {len(results)} | Profitable (PF>1.0, T≥10): {len(profitable)} | Strong (PF>1.1, WR>50%): {len(strong)}")

    if strong:
        print("\n  ★ TOP STRATEGIES:")
        strong.sort(key=lambda x: x["profit_factor"], reverse=True)
        for s in strong[:20]:
            print(f"    {s['strategy']:20s} {s['direction']:7s} {s.get('period','?'):3s}: PF={s['profit_factor']:.2f} WR={s['win_rate']:.1f}% MDD={s['max_drawdown_pct']:.1f}% Sharpe={s['sharpe']:.2f} T={s['total_trades']}")

    return results


# ============================================================
# PHASE 2: SL/TP 최적화 (상위 전략, 25 combos each)
# ============================================================
def phase2(phase1_results, btc_data):
    print("\n" + "="*70)
    print("PHASE 2: SL/TP 최적화 (5×5 grid)")
    print("="*70)

    candidates = get_top_unique(phase1_results, min_pf=1.0, min_trades=10, period="2y", top_k=8)
    print(f"  Optimizing {len(candidates)} candidates")

    all_results = []
    for cand in candidates:
        strat = cand["strategy"]
        direction = cand["direction"]
        base_pf = cand["profit_factor"]
        print(f"\n  --- {strat} {direction} (base PF={base_pf:.2f}) ---")

        best_pf = 0
        best = None

        for sl in SL_RANGE:
            for tp in TP_RANGE:
                r = run_simulation(
                    strat, btc_data, direction,
                    sl_pct=sl, tp_pct=tp,
                    start_date=PERIODS["2y"],
                )
                if r and r["total_trades"] >= 10:
                    r["period"] = "2y"
                    all_results.append(r)
                    if r["profit_factor"] > best_pf:
                        best_pf = r["profit_factor"]
                        best = r

        if best:
            print(f"  ★ Best: SL={best['sl_pct']}% TP={best['tp_pct']}% → PF={best_pf:.2f} WR={best['win_rate']:.1f}% MDD={best['max_drawdown_pct']:.1f}%")

    save_results(all_results, "phase2_sltp_optimization")
    return all_results


# ============================================================
# PHASE 3: 멀티코인 (BTC, ETH, SOL, BNB, XRP)
# ============================================================
def phase3(phase1_results, data_dir):
    print("\n" + "="*70)
    print("PHASE 3: 멀티코인 검증 (5 coins)")
    print("="*70)

    candidates = get_top_unique(phase1_results, min_pf=1.0, min_trades=10, period="2y", top_k=6)
    test_coins = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"]
    coin_data = load_coins(data_dir, symbols=test_coins)
    print(f"  Loaded {len(coin_data)} coins: {[c[0] for c in coin_data]}")

    all_results = []
    for cand in candidates:
        strat = cand["strategy"]
        direction = cand["direction"]
        print(f"\n  --- {strat} {direction} ---")

        for sym, df in coin_data:
            single = [(sym, df)]
            r = run_simulation(
                strat, single, direction,
                sl_pct=7, tp_pct=7,
                start_date=PERIODS["2y"],
            )
            if r and r["total_trades"] >= 5:
                r["period"] = "2y"
                r["coin"] = sym
                all_results.append(r)
                mark = "✓" if r["profit_factor"] > 1.0 else "✗"
                print(f"    {sym:10s}: PF={r['profit_factor']:.2f} WR={r['win_rate']:.1f}% T={r['total_trades']} {mark}")
            else:
                print(f"    {sym:10s}: insufficient trades")

    save_results(all_results, "phase3_multicoin")
    return all_results


# ============================================================
# PHASE 4: 변수 조합 (max_bars, avoid_hours, min_vol_regime)
# ============================================================
def phase4(phase1_results, btc_data):
    print("\n" + "="*70)
    print("PHASE 4: 변수 튜닝 (max_bars, hours, vol regime)")
    print("="*70)

    candidates = get_top_unique(phase1_results, min_pf=1.0, min_trades=10, period="2y", top_k=4)
    all_results = []

    for cand in candidates:
        strat = cand["strategy"]
        direction = cand["direction"]
        base_pf = cand["profit_factor"]
        print(f"\n  === {strat} {direction} (base PF={base_pf:.2f}) ===")

        # max_bars
        print(f"    max_bars:")
        for mb in MAX_BARS_RANGE:
            r = run_simulation(strat, btc_data, direction, 7, 7,
                             max_bars=mb, start_date=PERIODS["2y"])
            if r and r["total_trades"] >= 5:
                r["period"] = "2y"
                r["variable"] = f"max_bars={mb}"
                all_results.append(r)
                diff = r["profit_factor"] - base_pf
                mark = "↑" if diff > 0.02 else ("↓" if diff < -0.02 else "=")
                print(f"      {mb:3d}: PF={r['profit_factor']:.2f} ({diff:+.2f}) T={r['total_trades']} {mark}")

        # avoid_hours
        print(f"    avoid_hours:")
        hour_sets = {
            "avoid_asia(0-8)": list(range(0, 9)),
            "avoid_eu(8-16)": list(range(8, 17)),
            "avoid_us(14-22)": list(range(14, 23)),
            "avoid_lowvol(2-6)": [2, 3, 4, 5, 6],
            "only_peak(12-20)": list(range(0, 12)) + list(range(21, 24)),
        }
        for name, hours in hour_sets.items():
            r = run_simulation(strat, btc_data, direction, 7, 7,
                             start_date=PERIODS["2y"], avoid_hours=hours)
            if r and r["total_trades"] >= 5:
                r["period"] = "2y"
                r["variable"] = name
                all_results.append(r)
                diff = r["profit_factor"] - base_pf
                mark = "↑" if diff > 0.02 else ("↓" if diff < -0.02 else "=")
                print(f"      {name:25s}: PF={r['profit_factor']:.2f} ({diff:+.2f}) T={r['total_trades']} {mark}")

        # min_vol_regime
        print(f"    min_vol_regime:")
        for mvr in [0.5, 0.7, 0.8, 1.0, 1.2, 1.5]:
            r = run_simulation(strat, btc_data, direction, 7, 7,
                             start_date=PERIODS["2y"], min_vol_regime=mvr)
            if r and r["total_trades"] >= 3:
                r["period"] = "2y"
                r["variable"] = f"min_vol={mvr}"
                all_results.append(r)
                diff = r["profit_factor"] - base_pf
                mark = "↑" if diff > 0.02 else ("↓" if diff < -0.02 else "=")
                print(f"      {mvr:.1f}: PF={r['profit_factor']:.2f} ({diff:+.2f}) T={r['total_trades']} {mark}")

    save_results(all_results, "phase4_variable_tuning")
    return all_results


# ============================================================
# PHASE 5: 포트폴리오 (상충 제외)
# ============================================================
SQUEEZE_GROUP = {"bb-squeeze-short", "bb-squeeze-long", "hv-squeeze", "keltner-squeeze"}
TREND_GROUP = {"macd-cross", "supertrend", "ma-cross", "adx-trend", "ichimoku"}


def conflicts(a, b):
    """상충 전략 감지."""
    base_a = a["strategy"].replace("-short", "").replace("-long", "")
    base_b = b["strategy"].replace("-short", "").replace("-long", "")
    # 같은 전략 반대 방향 = 상쇄
    if base_a == base_b and a["direction"] != b["direction"]:
        return True
    # 같은 그룹 같은 방향 = 중복 신호
    a_sq = a["strategy"] in SQUEEZE_GROUP
    b_sq = b["strategy"] in SQUEEZE_GROUP
    if a_sq and b_sq and a["direction"] == b["direction"]:
        return True
    a_tr = a["strategy"] in TREND_GROUP
    b_tr = b["strategy"] in TREND_GROUP
    if a_tr and b_tr and a["direction"] == b["direction"]:
        return True
    return False


def phase5(phase1_results):
    print("\n" + "="*70)
    print("PHASE 5: 포트폴리오 조합 (상충 제외)")
    print("="*70)

    unique = get_top_unique(phase1_results, min_pf=1.0, min_trades=10, period="2y", top_k=10)
    print(f"  {len(unique)} profitable strategies")

    # 상충 표시
    for i, a in enumerate(unique):
        for j, b in enumerate(unique):
            if i < j and conflicts(a, b):
                print(f"    ⚠ {a['strategy']}({a['direction']}) ↔ {b['strategy']}({b['direction']})")

    portfolio_results = []

    # 2-way
    for a, b in combinations(unique[:8], 2):
        if conflicts(a, b):
            continue
        avg_pf = (a["profit_factor"] + b["profit_factor"]) / 2
        avg_wr = (a["win_rate"] + b["win_rate"]) / 2
        diversified = a["direction"] != b["direction"]
        mdd_est = min(a["max_drawdown_pct"], b["max_drawdown_pct"]) * (0.7 if diversified else 0.9)
        portfolio_results.append({
            "combo": f"{a['strategy']}({a['direction']}) + {b['strategy']}({b['direction']})",
            "size": 2,
            "avg_pf": round(avg_pf, 3),
            "avg_wr": round(avg_wr, 1),
            "mdd_est": round(mdd_est, 1),
            "diversified": diversified,
            "total_trades": a["total_trades"] + b["total_trades"],
            "sharpe_avg": round((a.get("sharpe", 0) + b.get("sharpe", 0)) / 2, 2),
            "risk_adjusted": round(avg_pf / max(mdd_est, 0.1) * 100, 2),
        })

    # 3-way
    for a, b, c in combinations(unique[:7], 3):
        if conflicts(a, b) or conflicts(a, c) or conflicts(b, c):
            continue
        avg_pf = (a["profit_factor"] + b["profit_factor"] + c["profit_factor"]) / 3
        avg_wr = (a["win_rate"] + b["win_rate"] + c["win_rate"]) / 3
        dirs = {a["direction"], b["direction"], c["direction"]}
        diversified = len(dirs) > 1
        mdd_est = min(a["max_drawdown_pct"], b["max_drawdown_pct"], c["max_drawdown_pct"]) * (0.6 if diversified else 0.85)
        portfolio_results.append({
            "combo": f"{a['strategy']}({a['direction']}) + {b['strategy']}({b['direction']}) + {c['strategy']}({c['direction']})",
            "size": 3,
            "avg_pf": round(avg_pf, 3),
            "avg_wr": round(avg_wr, 1),
            "mdd_est": round(mdd_est, 1),
            "diversified": diversified,
            "total_trades": a["total_trades"] + b["total_trades"] + c["total_trades"],
            "sharpe_avg": round((a.get("sharpe", 0) + b.get("sharpe", 0) + c.get("sharpe", 0)) / 3, 2),
            "risk_adjusted": round(avg_pf / max(mdd_est, 0.1) * 100, 2),
        })

    save_results(portfolio_results, "phase5_portfolio")

    portfolio_results.sort(key=lambda x: x["risk_adjusted"], reverse=True)
    print(f"\n  TOP 10 (risk-adjusted, 상충 제외):")
    for i, p in enumerate(portfolio_results[:10]):
        print(f"    {i+1}. {p['combo']}")
        print(f"       PF={p['avg_pf']:.2f} WR={p['avg_wr']:.1f}% MDD≈{p['mdd_est']:.1f}% Sharpe≈{p['sharpe_avg']:.2f} div={p['diversified']}")

    return portfolio_results


# ============================================================
# PHASE 6: 전체 코인 (top 10, 30, 50)
# ============================================================
def phase6(phase1_results, data_dir):
    print("\n" + "="*70)
    print("PHASE 6: 전체 코인 포트폴리오 (top 10/30/50)")
    print("="*70)

    candidates = get_top_unique(phase1_results, min_pf=1.0, min_trades=10, period="2y", top_k=5)
    results = []

    for top_n in [10, 30, 50]:
        coins = load_coins(data_dir, top_n=top_n)
        print(f"\n  --- top {top_n} coins ({len(coins)} loaded) ---")

        for cand in candidates:
            strat = cand["strategy"]
            direction = cand["direction"]

            r = run_simulation(
                strat, coins, direction,
                sl_pct=7, tp_pct=7,
                start_date=PERIODS["2y"],
            )
            if r and r["total_trades"] >= 10:
                r["period"] = "2y"
                r["top_n"] = top_n
                results.append(r)
                print(f"    {strat:20s} {direction:7s}: PF={r['profit_factor']:.2f} WR={r['win_rate']:.1f}% T={r['total_trades']} coins={r['coins_used']} MDD={r['max_drawdown_pct']:.1f}%")

    save_results(results, "phase6_full_portfolio")
    return results


# ============================================================
# PHASE 7: 최적 조합 찾기 (best SL/TP + best variable + multi-coin)
# ============================================================
def phase7_best_combo(phase2_results, phase4_results, data_dir):
    print("\n" + "="*70)
    print("PHASE 7: 최적 조합 (best SL/TP + best variable)")
    print("="*70)

    # Phase 2에서 최고 SL/TP 조합 찾기
    if not phase2_results:
        print("  No phase2 results")
        return []

    # 전략별 best SL/TP
    best_by_strat = {}
    for r in phase2_results:
        key = (r["strategy"], r["direction"])
        if key not in best_by_strat or r["profit_factor"] > best_by_strat[key]["profit_factor"]:
            best_by_strat[key] = r

    # Phase 4에서 가장 효과적인 변수 찾기
    best_vars = {}
    if phase4_results:
        for r in phase4_results:
            key = (r["strategy"], r["direction"])
            if "variable" in r:
                if key not in best_vars or r["profit_factor"] > best_vars[key]["profit_factor"]:
                    best_vars[key] = r

    results = []
    coins_50 = load_coins(data_dir, top_n=50)

    for key, best_sltp in best_by_strat.items():
        strat, direction = key
        sl = best_sltp["sl_pct"]
        tp = best_sltp["tp_pct"]
        base_pf = best_sltp["profit_factor"]

        print(f"\n  {strat} {direction}: SL={sl}% TP={tp}% (PF={base_pf:.2f})")

        # Test best SL/TP on top 50 coins
        r = run_simulation(strat, coins_50, direction, sl, tp, start_date=PERIODS["2y"])
        if r and r["total_trades"] >= 10:
            r["period"] = "2y"
            r["config"] = f"SL={sl} TP={tp}"
            results.append(r)
            print(f"    top50: PF={r['profit_factor']:.2f} WR={r['win_rate']:.1f}% T={r['total_trades']} MDD={r['max_drawdown_pct']:.1f}%")

    save_results(results, "phase7_best_combo")
    return results


# ============================================================
# HELPERS
# ============================================================
def get_top_unique(results, min_pf=1.0, min_trades=10, period=None, top_k=8):
    """Get unique strategy+direction pairs sorted by PF."""
    filtered = [r for r in results
                if r["profit_factor"] > min_pf
                and r["total_trades"] >= min_trades
                and (period is None or r.get("period") == period)]
    seen = set()
    unique = []
    for c in sorted(filtered, key=lambda x: x["profit_factor"], reverse=True):
        key = (c["strategy"], c["direction"])
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique[:top_k]


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    start = time.time()
    print(f"Deep Strategy Analysis v3 — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Engine: direct (no API rate limit)")
    print(f"Strategies: {len(STRATEGIES)}")
    print(f"Output: {OUT_DIR}")

    data_dir = find_data_dir()
    print(f"Data: {data_dir} ({len(list(data_dir.glob('*_1h.csv')))} files)")

    # Load BTC only for Phase 1
    btc_data = load_coins(data_dir, symbols=["BTCUSDT"])
    print(f"BTC loaded: {len(btc_data[0][1])} candles")

    p1 = phase1(btc_data)
    p2 = phase2(p1, btc_data)
    p3 = phase3(p1, data_dir)
    p4 = phase4(p1, btc_data)
    p5 = phase5(p1)
    p6 = phase6(p1, data_dir)
    p7 = phase7_best_combo(p2, p4, data_dir)

    elapsed = time.time() - start
    print(f"\n{'='*70}")
    print(f"COMPLETE in {elapsed:.0f}s ({elapsed/60:.1f}m)")
    print(f"\nFiles:")
    for f in sorted(OUT_DIR.glob("*.csv")):
        print(f"  {f.name}")

    # 최종 요약
    print(f"\n{'='*70}")
    print("FINAL CONCLUSIONS")
    print(f"{'='*70}")

    # Phase 1 top strategies
    strong = [r for r in p1 if r["profit_factor"] > 1.1 and r["win_rate"] > 50 and r["total_trades"] >= 10 and r.get("period") == "2y"]
    if strong:
        print("\n  Strategies with EDGE (2y, PF>1.1, WR>50%):")
        for s in sorted(strong, key=lambda x: x["profit_factor"], reverse=True):
            print(f"    {s['strategy']} {s['direction']}: PF={s['profit_factor']:.2f} WR={s['win_rate']:.1f}%")
    else:
        profitable = [r for r in p1 if r["profit_factor"] > 1.0 and r["total_trades"] >= 10 and r.get("period") == "2y"]
        print(f"\n  No strong edge (PF>1.1, WR>50%) found in 2y BTC.")
        print(f"  Marginally profitable (PF>1.0): {len(profitable)}")
        if profitable:
            for s in sorted(profitable, key=lambda x: x["profit_factor"], reverse=True)[:10]:
                print(f"    {s['strategy']} {s['direction']}: PF={s['profit_factor']:.2f} WR={s['win_rate']:.1f}%")
