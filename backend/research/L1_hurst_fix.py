#!/usr/bin/env python3
"""
LEVEL 1 재검증: Hurst Exponent 수정 + 레짐→전략 매핑

이전 문제: Hurst가 전부 0.500으로 고정
원인: pct_change() returns가 너무 작은 값 → std ≈ 0 → R/S 계산 오류
수정: log returns 사용 + 다양한 window 테스트
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from research.framework import ResearchEngine, calc_metrics, hurst_exponent


def run():
    engine = ResearchEngine(top_n=30)
    btc = engine.get_btc()

    print("\n" + "="*70)
    print("LEVEL 1: Hurst Exponent 수정 검증")
    print("="*70)

    # Test different input series
    close = btc["close"].values
    pct_returns = np.diff(close) / close[:-1]
    log_returns = np.diff(np.log(close))
    raw_prices = close[100:]  # skip initial

    print("\n  Input series comparison:")
    for name, series in [("pct_returns", pct_returns), ("log_returns", log_returns), ("raw_prices", raw_prices)]:
        h = hurst_exponent(series[-500:])
        print(f"    {name:15s}: H={h:.4f} (mean={np.mean(series[-500:]):.6f}, std={np.std(series[-500:]):.6f})")

    # Rolling Hurst with log returns (multiple windows)
    print("\n  Rolling Hurst (log returns):")
    for window in [168, 336, 504]:
        h_values = []
        for i in range(window, len(log_returns), 24):
            h = hurst_exponent(log_returns[i-window:i])
            h_values.append(h)

        h_arr = np.array(h_values)
        trending = sum(h > 0.55 for h in h_arr)
        mean_rev = sum(h < 0.45 for h in h_arr)
        random_w = sum(0.45 <= h <= 0.55 for h in h_arr)

        print(f"    window={window} ({window//24}d): mean={np.mean(h_arr):.3f} std={np.std(h_arr):.3f} "
              f"trending={trending}/{len(h_arr)} mean_rev={mean_rev}/{len(h_arr)} random={random_w}/{len(h_arr)}")

    # Use best window for regime classification
    best_window = 336  # 14 days
    print(f"\n  Using window={best_window} for regime classification")

    # Monthly regime → strategy mapping
    engine.precompute(["atr-breakout", "bb-squeeze-short", "supertrend",
                       "ichimoku", "mean-reversion", "keltner-squeeze"])

    results = []
    current = datetime.now() - timedelta(days=700)

    strategies_to_test = [
        ("atr-breakout", "short"), ("bb-squeeze-short", "short"),
        ("supertrend", "short"), ("ichimoku", "short"),
        ("mean-reversion", "long"), ("mean-reversion", "short"),
        ("keltner-squeeze", "short"),
    ]

    while current + timedelta(days=30) <= datetime.now():
        month_start = current
        month_end = current + timedelta(days=30)

        # Hurst for this period
        mask = (btc["timestamp"] >= pd.Timestamp(month_start - timedelta(days=14))) & \
               (btc["timestamp"] <= pd.Timestamp(month_start))
        period_close = btc[mask]["close"].values
        if len(period_close) > 100:
            lr = np.diff(np.log(period_close))
            h = hurst_exponent(lr)
        else:
            h = 0.5

        regime = "trending" if h > 0.55 else ("mean_rev" if h < 0.45 else "random")

        for sid, direction in strategies_to_test:
            pnls = engine.simulate(sid, direction, start_date=month_start, end_date=month_end)
            m = calc_metrics(pnls)
            results.append({
                "month": month_start.strftime("%Y-%m"),
                "hurst": round(h, 3),
                "regime": regime,
                "strategy": f"{sid}({direction})",
                "pf": m["pf"], "wr": m["wr"], "trades": m["trades"], "ret": m["ret"],
            })

        current += timedelta(days=30)

    engine.save("L1_hurst_regime", results, metadata={"window": best_window, "input": "log_returns"})

    # Analyze
    print(f"\n  Regime → Strategy mapping ({len(results)} rows):")
    for regime_name in ["trending", "mean_rev", "random"]:
        regime_data = [r for r in results if r["regime"] == regime_name]
        if not regime_data:
            continue
        months = len(set(r["month"] for r in regime_data))
        print(f"\n    {regime_name.upper()} ({months} months):")
        strat_perf = defaultdict(list)
        for r in regime_data:
            strat_perf[r["strategy"]].append(r["pf"])
        for strat, pfs in sorted(strat_perf.items(), key=lambda x: np.mean(x[1]), reverse=True):
            avg_pf = np.mean(pfs)
            mark = "★" if avg_pf > 1.1 else ("▸" if avg_pf > 1.0 else "")
            print(f"      {strat:35s}: avg PF={avg_pf:.2f} ({len(pfs)} months) {mark}")

    # 핵심 질문: Hurst 레짐으로 전략을 선택하면 실제로 수익이 나는가?
    print(f"\n  Walk-forward test: Hurst regime → best strategy selection")
    adaptive_pnls = []
    static_atr_pnls = []

    current = datetime.now() - timedelta(days=365)
    while current + timedelta(days=30) <= datetime.now():
        month_start = current
        month_end = current + timedelta(days=30)

        # Determine regime from prior 14 days
        mask = (btc["timestamp"] >= pd.Timestamp(month_start - timedelta(days=14))) & \
               (btc["timestamp"] <= pd.Timestamp(month_start))
        period_close = btc[mask]["close"].values
        if len(period_close) > 100:
            lr = np.diff(np.log(period_close))
            h = hurst_exponent(lr)
        else:
            h = 0.5

        # Select strategy based on regime
        if h > 0.55:
            selected = [("atr-breakout", "short"), ("supertrend", "short")]
        elif h < 0.45:
            selected = [("mean-reversion", "long"), ("keltner-squeeze", "short")]
        else:
            selected = [("bb-squeeze-short", "short"), ("ichimoku", "short")]

        # Run adaptive
        month_pnls = []
        for sid, direction in selected:
            pnls = engine.simulate(sid, direction, start_date=month_start, end_date=month_end)
            month_pnls.extend([p / len(selected) for p in pnls])
        adaptive_pnls.extend(month_pnls)

        # Run static ATR SHORT
        pnls_static = engine.simulate("atr-breakout", "short",
                                      start_date=month_start, end_date=month_end)
        static_atr_pnls.extend(pnls_static)

        current += timedelta(days=30)

    m_adaptive = calc_metrics(adaptive_pnls)
    m_static = calc_metrics(static_atr_pnls)

    print(f"\n    Adaptive (Hurst):  PF={m_adaptive['pf']:.2f} WR={m_adaptive['wr']:.1f}% Sharpe={m_adaptive['sharpe']:.2f} MDD={m_adaptive['mdd']:.1f}% T={m_adaptive['trades']}")
    print(f"    Static ATR SHORT:  PF={m_static['pf']:.2f} WR={m_static['wr']:.1f}% Sharpe={m_static['sharpe']:.2f} MDD={m_static['mdd']:.1f}% T={m_static['trades']}")
    diff = m_adaptive["pf"] - m_static["pf"]
    print(f"    Δ PF: {diff:+.2f} {'← Hurst 유효' if diff > 0.05 else '← 차이 미미' if abs(diff) <= 0.05 else '← Static이 나음'}")


if __name__ == "__main__":
    run()
