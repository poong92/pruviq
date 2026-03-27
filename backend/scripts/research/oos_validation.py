#!/usr/bin/env python3
"""
OOS (Out-of-Sample) + Walk-Forward Validation
상위 전략의 실전 생존력을 검증한다.

1. Walk-Forward: 6개월 IS → 3개월 OOS, 슬라이딩
2. 기간별 일관성: 각 분기별 PF 분포
3. 연속 손실 분석: 최대 연속 손실, 드로다운 회복 시간
4. 실전 시뮬레이션: 1% 리스크 per trade, 복리 vs 단리
"""

import json
import sys
import time
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

PRUVIQ_DATA = Path(__file__).parent.parent / "data" / "futures"
AUTOTRADER_DATA = Path.home() / "Desktop" / "autotrader" / "data" / "futures"

FEE_PCT = 0.0008
SLIPPAGE_PCT = 0.0002
FUNDING_RATE_8H = 0.0001

# 검증 대상 (Phase 1-7 결론에서 도출)
CANDIDATES = [
    {"strategy": "atr-breakout", "direction": "short", "sl": 3, "tp": 8, "max_bars": 24},
    {"strategy": "bb-squeeze-short", "direction": "short", "sl": 3, "tp": 5, "max_bars": 48},
    {"strategy": "keltner-squeeze", "direction": "short", "sl": 15, "tp": 5, "max_bars": 48},
    {"strategy": "ichimoku", "direction": "short", "sl": 7, "tp": 7, "max_bars": 48},
    {"strategy": "atr-breakout", "direction": "short", "sl": 7, "tp": 7, "max_bars": 48},  # 기본
    {"strategy": "bb-squeeze-short", "direction": "short", "sl": 10, "tp": 8, "max_bars": 48},  # 원래 설정
]


def find_data_dir():
    if PRUVIQ_DATA.exists() and any(PRUVIQ_DATA.glob("*_1h.csv")):
        return PRUVIQ_DATA
    if AUTOTRADER_DATA.exists() and any(AUTOTRADER_DATA.glob("*_1h.csv")):
        return AUTOTRADER_DATA
    raise FileNotFoundError("No data")


def load_coins(data_dir, top_n=50):
    files = sorted(data_dir.glob("*_1h.csv"), key=lambda f: f.stat().st_size, reverse=True)
    coins = []
    for f in files[:top_n]:
        sym = f.stem.replace("_1h", "").upper()
        try:
            df = pd.read_csv(f)
            if "timestamp" in df.columns:
                df["timestamp"] = pd.to_datetime(df["timestamp"])
            if len(df) > 100:
                coins.append((sym, df))
        except Exception:
            continue
    return coins


def run_sim(strategy_id, coins, direction, sl, tp, max_bars, start_date=None, end_date=None):
    """Run simulation, return trade-level data."""
    strategy, _, _ = get_strategy(strategy_id)
    all_trades = []

    for sym, df_full in coins:
        df = df_full.copy()
        if start_date and "timestamp" in df.columns:
            df = df[df["timestamp"] >= pd.Timestamp(start_date)]
        if end_date and "timestamp" in df.columns:
            df = df[df["timestamp"] <= pd.Timestamp(end_date)]
        if len(df) < 50:
            continue

        df = strategy.calculate_indicators(df)
        result = run_fast(
            df, strategy, sym,
            sl_pct=sl / 100, tp_pct=tp / 100, max_bars=max_bars,
            fee_pct=FEE_PCT, slippage_pct=SLIPPAGE_PCT,
            direction=direction, market_type="futures",
            strategy_id=strategy_id, funding_rate_8h=FUNDING_RATE_8H,
        )
        for t in result.trades:
            all_trades.append({
                "pnl_pct": t.pnl_pct,
                "symbol": sym,
                "entry_time": str(t.entry_time),
                "exit_reason": t.exit_reason,
            })

    return all_trades


def calc_metrics(trades):
    """Calculate metrics from trade list."""
    if not trades:
        return {"pf": 0, "wr": 0, "trades": 0, "mdd": 0, "sharpe": 0}

    pnls = [t["pnl_pct"] for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]
    total_win = sum(wins) if wins else 0
    total_loss = abs(sum(losses)) if losses else 0.001

    equity = [100]
    for p in pnls:
        equity.append(equity[-1] * (1 + p / 100))
    eq = np.array(equity)
    peaks = np.maximum.accumulate(eq)
    dd = (peaks - eq) / peaks * 100
    mdd = float(np.max(dd))

    pnl_arr = np.array(pnls)
    sharpe = float(np.mean(pnl_arr) / np.std(pnl_arr) * np.sqrt(len(pnls))) if np.std(pnl_arr) > 0 else 0

    # Max consecutive losses
    max_consec = 0
    consec = 0
    for p in pnls:
        if p <= 0:
            consec += 1
            max_consec = max(max_consec, consec)
        else:
            consec = 0

    return {
        "pf": round(total_win / total_loss, 2),
        "wr": round(len(wins) / len(pnls) * 100, 1),
        "trades": len(pnls),
        "mdd": round(mdd, 1),
        "sharpe": round(sharpe, 2),
        "total_return": round(sum(pnls), 1),
        "max_consec_loss": max_consec,
        "avg_win": round(np.mean(wins), 2) if wins else 0,
        "avg_loss": round(np.mean(losses), 2) if losses else 0,
    }


# ============================================================
# TEST 1: Walk-Forward (6m IS → 3m OOS, sliding)
# ============================================================
def test_walk_forward(coins):
    print("\n" + "="*70)
    print("TEST 1: Walk-Forward Validation (6m IS → 3m OOS)")
    print("="*70)

    results = []

    # Generate windows: 2y data, 6m IS + 3m OOS = 9m per window
    windows = []
    start = datetime(2024, 4, 1)
    while start + timedelta(days=270) <= datetime.now():
        is_start = start
        is_end = start + timedelta(days=180)
        oos_start = is_end
        oos_end = is_end + timedelta(days=90)
        windows.append((is_start, is_end, oos_start, oos_end))
        start += timedelta(days=90)  # slide by 3 months

    print(f"  Windows: {len(windows)}")

    for cand in CANDIDATES:
        strat = cand["strategy"]
        direction = cand["direction"]
        sl = cand["sl"]
        tp = cand["tp"]
        mb = cand["max_bars"]

        print(f"\n  {strat} {direction} SL={sl} TP={tp} max_bars={mb}:")
        is_pfs = []
        oos_pfs = []

        for i, (is_s, is_e, oos_s, oos_e) in enumerate(windows):
            is_trades = run_sim(strat, coins, direction, sl, tp, mb,
                              start_date=is_s, end_date=is_e)
            oos_trades = run_sim(strat, coins, direction, sl, tp, mb,
                               start_date=oos_s, end_date=oos_e)

            is_m = calc_metrics(is_trades)
            oos_m = calc_metrics(oos_trades)

            is_pfs.append(is_m["pf"])
            oos_pfs.append(oos_m["pf"])

            is_mark = "✓" if is_m["pf"] > 1.0 else "✗"
            oos_mark = "✓" if oos_m["pf"] > 1.0 else "✗"
            degradation = oos_m["pf"] - is_m["pf"]

            results.append({
                "strategy": strat,
                "direction": direction,
                "sl": sl, "tp": tp,
                "window": i + 1,
                "is_period": f"{is_s.strftime('%Y-%m')}→{is_e.strftime('%Y-%m')}",
                "oos_period": f"{oos_s.strftime('%Y-%m')}→{oos_e.strftime('%Y-%m')}",
                "is_pf": is_m["pf"],
                "is_wr": is_m["wr"],
                "is_trades": is_m["trades"],
                "oos_pf": oos_m["pf"],
                "oos_wr": oos_m["wr"],
                "oos_trades": oos_m["trades"],
                "degradation": round(degradation, 2),
            })

            print(f"    W{i+1} IS({is_s.strftime('%y%m')}→{is_e.strftime('%y%m')}): PF={is_m['pf']:.2f} {is_mark} | OOS({oos_s.strftime('%y%m')}→{oos_e.strftime('%y%m')}): PF={oos_m['pf']:.2f} {oos_mark} | Δ={degradation:+.2f}")

        if oos_pfs:
            avg_oos = np.mean(oos_pfs)
            oos_positive = sum(1 for p in oos_pfs if p > 1.0)
            print(f"    → OOS avg PF={avg_oos:.2f}, Profitable: {oos_positive}/{len(oos_pfs)} windows")

    csv_path = OUT_DIR / "oos_walk_forward.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)
    print(f"\n  ✓ {csv_path.name}: {len(results)} rows")
    return results


# ============================================================
# TEST 2: 분기별 일관성
# ============================================================
def test_quarterly(coins):
    print("\n" + "="*70)
    print("TEST 2: 분기별 일관성")
    print("="*70)

    results = []
    quarters = []
    start = datetime(2024, 4, 1)
    while start + timedelta(days=90) <= datetime.now():
        end = start + timedelta(days=90)
        quarters.append((start, end, f"{start.strftime('%Y')} Q{(start.month-1)//3+1}"))
        start = end

    for cand in CANDIDATES:
        strat = cand["strategy"]
        direction = cand["direction"]
        sl = cand["sl"]
        tp = cand["tp"]
        mb = cand["max_bars"]

        print(f"\n  {strat} {direction} SL={sl} TP={tp}:")
        q_pfs = []

        for q_start, q_end, q_name in quarters:
            trades = run_sim(strat, coins, direction, sl, tp, mb,
                           start_date=q_start, end_date=q_end)
            m = calc_metrics(trades)
            q_pfs.append(m["pf"])

            mark = "✓" if m["pf"] > 1.0 else "✗"
            print(f"    {q_name}: PF={m['pf']:.2f} WR={m['wr']:.1f}% T={m['trades']} MDD={m['mdd']:.1f}% {mark}")

            results.append({
                "strategy": strat, "direction": direction,
                "sl": sl, "tp": tp,
                "quarter": q_name,
                "pf": m["pf"], "wr": m["wr"], "trades": m["trades"],
                "mdd": m["mdd"], "sharpe": m["sharpe"],
                "total_return": m["total_return"],
                "max_consec_loss": m["max_consec_loss"],
            })

        profitable_q = sum(1 for p in q_pfs if p > 1.0)
        print(f"    → Profitable: {profitable_q}/{len(q_pfs)} quarters, Std: {np.std(q_pfs):.2f}")

    csv_path = OUT_DIR / "oos_quarterly.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)
    print(f"\n  ✓ {csv_path.name}: {len(results)} rows")
    return results


# ============================================================
# TEST 3: 실전 포지션 사이징 시뮬레이션
# ============================================================
def test_position_sizing(coins):
    print("\n" + "="*70)
    print("TEST 3: 실전 포지션 사이징 (1% risk per trade)")
    print("="*70)

    results = []

    for cand in CANDIDATES[:3]:  # top 3만
        strat = cand["strategy"]
        direction = cand["direction"]
        sl = cand["sl"]
        tp = cand["tp"]
        mb = cand["max_bars"]

        trades = run_sim(strat, coins, direction, sl, tp, mb,
                        start_date=datetime(2024, 3, 27))
        if not trades:
            continue

        # 시나리오 1: 고정 포지션 (1% risk)
        capital = 10000
        risk_pct = 0.01
        equity_fixed = [capital]

        for t in trades:
            position_size = equity_fixed[-1] * risk_pct / (sl / 100)
            pnl_dollar = position_size * (t["pnl_pct"] / 100)
            equity_fixed.append(equity_fixed[-1] + pnl_dollar)

        # 시나리오 2: 복리 (1% risk, compounding)
        equity_compound = [capital]
        for t in trades:
            position_size = equity_compound[-1] * risk_pct / (sl / 100)
            pnl_dollar = position_size * (t["pnl_pct"] / 100)
            equity_compound.append(equity_compound[-1] + pnl_dollar)

        # 시나리오 3: 보수적 (0.5% risk)
        equity_conservative = [capital]
        for t in trades:
            position_size = equity_conservative[-1] * 0.005 / (sl / 100)
            pnl_dollar = position_size * (t["pnl_pct"] / 100)
            equity_conservative.append(equity_conservative[-1] + pnl_dollar)

        # MDD 계산
        def calc_mdd(eq):
            arr = np.array(eq)
            peaks = np.maximum.accumulate(arr)
            dd = (peaks - arr) / peaks * 100
            return float(np.max(dd))

        fixed_final = equity_fixed[-1]
        compound_final = equity_compound[-1]
        conservative_final = equity_conservative[-1]

        row = {
            "strategy": strat, "direction": direction,
            "sl": sl, "tp": tp,
            "trades": len(trades),
            "initial": capital,
            "fixed_final": round(fixed_final),
            "fixed_return_pct": round((fixed_final / capital - 1) * 100, 1),
            "fixed_mdd_pct": round(calc_mdd(equity_fixed), 1),
            "compound_final": round(compound_final),
            "compound_return_pct": round((compound_final / capital - 1) * 100, 1),
            "compound_mdd_pct": round(calc_mdd(equity_compound), 1),
            "conservative_final": round(conservative_final),
            "conservative_return_pct": round((conservative_final / capital - 1) * 100, 1),
            "conservative_mdd_pct": round(calc_mdd(equity_conservative), 1),
        }
        results.append(row)

        print(f"\n  {strat} {direction} SL={sl}% TP={tp}% ({len(trades)} trades)")
        print(f"    Fixed 1%:        ${capital} → ${fixed_final:,.0f} ({row['fixed_return_pct']:+.1f}%) MDD={row['fixed_mdd_pct']:.1f}%")
        print(f"    Compound 1%:     ${capital} → ${compound_final:,.0f} ({row['compound_return_pct']:+.1f}%) MDD={row['compound_mdd_pct']:.1f}%")
        print(f"    Conservative 0.5%: ${capital} → ${conservative_final:,.0f} ({row['conservative_return_pct']:+.1f}%) MDD={row['conservative_mdd_pct']:.1f}%")

    csv_path = OUT_DIR / "oos_position_sizing.csv"
    if results:
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        print(f"\n  ✓ {csv_path.name}: {len(results)} rows")
    return results


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    start = time.time()
    print(f"OOS Validation — {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    data_dir = find_data_dir()
    coins = load_coins(data_dir, top_n=30)  # top 30 for speed
    print(f"Loaded {len(coins)} coins")

    t1 = test_walk_forward(coins)
    t2 = test_quarterly(coins)
    t3 = test_position_sizing(coins)

    elapsed = time.time() - start
    print(f"\n{'='*70}")
    print(f"COMPLETE in {elapsed:.0f}s ({elapsed/60:.1f}m)")
