#!/usr/bin/env python3
"""
LEVEL 3: 기존 최강 전략 + 볼륨 프로파일 조합

검증 질문:
1. VP(볼륨프로파일)와 기존 전략(ATR/BB/SuperTrend SHORT)의 상관관계는?
2. VP를 추가하면 포트폴리오 Sharpe가 올라가는가?
3. 최적 가중치는?
4. OOS에서도 유효한가?
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from research.framework import ResearchEngine, calc_metrics, volume_profile, COST_MODEL


def run_vp_weekly(coins, start, end, window=168, dev_thresh=3.0, rev_pct=0.7, sl_pct=2):
    """Run VP strategy for a specific period, return weekly PnL."""
    FEE = COST_MODEL["fee_pct"]
    pnls = []
    for sym, df_full in coins:
        df = df_full[(df_full["timestamp"] >= pd.Timestamp(start)) &
                     (df_full["timestamp"] <= pd.Timestamp(end))].copy()
        if len(df) < window + 48:
            continue
        close = df["close"].values
        vol = df["volume"].values
        n = len(close)

        i = window
        while i < n - 48:
            vp = volume_profile(close[i-window:i], vol[i-window:i])
            if vp is None:
                i += 12
                continue
            poc = vp["poc"]
            deviation = (close[i] - poc) / poc * 100
            if abs(deviation) < dev_thresh:
                i += 6
                continue

            direction = "short" if deviation > 0 else "long"
            entry = close[min(i+1, n-1)]
            target = entry * (1 - deviation/100*rev_pct) if direction == "short" else entry * (1 + abs(deviation)/100*rev_pct)

            trade_pnl = None
            for k in range(2, min(48, n-i)):
                future = close[i+k]
                if direction == "short":
                    pnl = (entry - future) / entry * 100
                else:
                    pnl = (future - entry) / entry * 100
                if pnl >= abs(deviation) * rev_pct:
                    trade_pnl = pnl - 0.2
                    break
                if pnl <= -sl_pct:
                    trade_pnl = -sl_pct - 0.2
                    break
            if trade_pnl is None:
                final = close[min(i+47, n-1)]
                trade_pnl = ((entry-final)/entry*100 if direction=="short" else (final-entry)/entry*100) - 0.2

            pnls.append(trade_pnl)
            i += 24
            i += 6

    return pnls


def run():
    engine = ResearchEngine(top_n=30)

    print("\n" + "="*70)
    print("LEVEL 3: 기존 전략 + 볼륨 프로파일 조합")
    print("="*70)

    engine.precompute(["atr-breakout", "bb-squeeze-short", "supertrend", "ichimoku", "keltner-squeeze"])

    # ============================================================
    # TEST 1: 주간 PnL 상관관계
    # ============================================================
    print("\n  TEST 1: 전략 간 주간 PnL 상관관계")

    strategies = [
        ("atr-breakout", "short"),
        ("bb-squeeze-short", "short"),
        ("supertrend", "short"),
        ("ichimoku", "short"),
        ("keltner-squeeze", "short"),
    ]

    weekly_pnls = {f"{s}({d})": [] for s, d in strategies}
    weekly_pnls["volume_profile"] = []

    current = datetime.now() - timedelta(days=365)
    weeks = 0

    while current + timedelta(days=7) <= datetime.now():
        week_start = current
        week_end = current + timedelta(days=7)

        for sid, direction in strategies:
            pnls = engine.simulate(sid, direction, start_date=week_start, end_date=week_end)
            weekly_pnls[f"{sid}({direction})"].append(sum(pnls))

        vp_pnls = run_vp_weekly(engine.coins, week_start, week_end)
        weekly_pnls["volume_profile"].append(sum(vp_pnls))

        current += timedelta(days=7)
        weeks += 1

    print(f"    {weeks} weeks analyzed")
    labels = list(weekly_pnls.keys())

    # Correlation matrix
    print(f"\n    {'':30s}", end="")
    for l in labels:
        print(f" {l[:8]:>8s}", end="")
    print()

    for i, li in enumerate(labels):
        print(f"    {li:30s}", end="")
        for j, lj in enumerate(labels):
            a = np.array(weekly_pnls[li])
            b = np.array(weekly_pnls[lj])
            c = np.corrcoef(a, b)[0, 1] if len(a) == len(b) and np.std(a) > 0 and np.std(b) > 0 else 0
            mark = "█" if c > 0.5 else ("▓" if c > 0.2 else ("░" if c > -0.2 else "○"))
            print(f" {c:>7.2f}{mark}", end="")
        print()

    # VP vs 각 전략 상관관계
    print(f"\n    VP 상관관계:")
    for label in labels[:-1]:
        a = np.array(weekly_pnls["volume_profile"])
        b = np.array(weekly_pnls[label])
        c = np.corrcoef(a, b)[0, 1] if np.std(a) > 0 and np.std(b) > 0 else 0
        mark = "★ 독립!" if abs(c) < 0.2 else ("✓ 약한 상관" if abs(c) < 0.5 else "⚠ 높은 상관")
        print(f"      VP ↔ {label:30s}: r={c:+.3f} {mark}")

    # ============================================================
    # TEST 2: 포트폴리오 조합 (EW vs VP 추가)
    # ============================================================
    print(f"\n  TEST 2: 포트폴리오 비교 (1년 Walk-Forward)")

    portfolios = {
        "EW 5xSHORT (baseline)": strategies,
        "EW 5xSHORT + VP": strategies + [("VP", "")],
        "ATR+BB+VP (3-way)": [("atr-breakout", "short"), ("bb-squeeze-short", "short"), ("VP", "")],
        "ATR+VP (2-way)": [("atr-breakout", "short"), ("VP", "")],
        "VP alone": [("VP", "")],
    }

    current = datetime.now() - timedelta(days=365)
    portfolio_equity = {name: [10000] for name in portfolios}

    while current + timedelta(days=7) <= datetime.now():
        week_start = current
        week_end = current + timedelta(days=7)

        for port_name, strats in portfolios.items():
            week_pnls = []
            n_strats = len(strats)

            for sid, direction in strats:
                if sid == "VP":
                    pnls = run_vp_weekly(engine.coins, week_start, week_end)
                else:
                    pnls = engine.simulate(sid, direction, start_date=week_start, end_date=week_end)
                week_pnls.extend([p / n_strats for p in pnls])

            total = sum(week_pnls)
            cap = portfolio_equity[port_name][-1] * (1 + total / 100 * 0.3)
            portfolio_equity[port_name].append(cap)

        current += timedelta(days=7)

    print(f"\n    {'Portfolio':<35s} {'Final $':>10s} {'Return':>8s} {'MDD':>6s} {'Sharpe':>7s}")
    print("    " + "-"*70)

    results = []
    for name, eq in portfolio_equity.items():
        ea = np.array(eq)
        peaks = np.maximum.accumulate(ea)
        dd = (peaks - ea) / peaks * 100
        mdd = float(np.max(dd))
        final = eq[-1]
        ret = (final / 10000 - 1) * 100

        weekly_rets = [(eq[i] / eq[i-1] - 1) * 100 for i in range(1, len(eq))]
        wa = np.array(weekly_rets)
        sharpe = float(np.mean(wa) / np.std(wa) * np.sqrt(52)) if np.std(wa) > 0 else 0

        mark = "★" if ret > 30 and mdd < 30 else ("✓" if ret > 0 else "✗")
        print(f"    {name:<35s} ${final:>9,.0f} {ret:>+7.1f}% {mdd:>5.1f}% {sharpe:>6.2f} {mark}")

        results.append({
            "portfolio": name,
            "final": round(final),
            "return_pct": round(ret, 1),
            "mdd_pct": round(mdd, 1),
            "sharpe": round(sharpe, 2),
        })

    engine.save("L3_combined_portfolio", results)

    # ============================================================
    # TEST 3: VP 추가의 한계 효용
    # ============================================================
    print(f"\n  TEST 3: VP 추가의 한계 효용")
    baseline = next(r for r in results if "baseline" in r["portfolio"])
    with_vp = next(r for r in results if "5xSHORT + VP" in r["portfolio"])

    print(f"    Baseline:  Return={baseline['return_pct']:+.1f}% MDD={baseline['mdd_pct']:.1f}% Sharpe={baseline['sharpe']:.2f}")
    print(f"    +VP:       Return={with_vp['return_pct']:+.1f}% MDD={with_vp['mdd_pct']:.1f}% Sharpe={with_vp['sharpe']:.2f}")
    print(f"    Δ Return: {with_vp['return_pct'] - baseline['return_pct']:+.1f}%")
    print(f"    Δ MDD:    {with_vp['mdd_pct'] - baseline['mdd_pct']:+.1f}%")
    print(f"    Δ Sharpe: {with_vp['sharpe'] - baseline['sharpe']:+.2f}")

    vp_helps = with_vp["sharpe"] > baseline["sharpe"]
    print(f"\n    VP 추가 {'유효 ★' if vp_helps else '효과 없음'}")


if __name__ == "__main__":
    run()
