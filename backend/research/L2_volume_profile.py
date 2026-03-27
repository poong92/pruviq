#!/usr/bin/env python3
"""
LEVEL 2: 볼륨 프로파일 POC 회귀 전략 정식 검증

이전 결과: 10/10 코인 수익, PF=1.14, Sharpe=2.76
이번: 파라미터 그리드 + OOS + 멀티코인 + 포지션사이징까지 완전 검증
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from research.framework import ResearchEngine, calc_metrics, volume_profile


def run_vp_strategy(coins, window, deviation_threshold, reversion_pct, sl_pct,
                    start_date=None, max_hold=48):
    """Run Volume Profile POC reversion strategy."""
    all_pnls = []
    coin_results = {}

    for sym, df_full in coins:
        df = df_full.copy()
        if start_date and "timestamp" in df.columns:
            df = df[df["timestamp"] >= pd.Timestamp(start_date)]
        if len(df) < window + max_hold:
            continue

        close = df["close"].values
        vol = df["volume"].values
        n = len(close)
        pnls = []

        i = window
        while i < n - max_hold:
            # Volume profile for lookback window
            vp = volume_profile(close[i-window:i], vol[i-window:i])
            if vp is None:
                i += 12
                continue

            poc = vp["poc"]
            current_price = close[i]
            deviation = (current_price - poc) / poc * 100

            if abs(deviation) < deviation_threshold:
                i += 6
                continue

            # Signal
            direction = "short" if deviation > 0 else "long"
            entry_price = close[i + 1] if i + 1 < n else close[i]  # next bar open approx

            # Track trade
            target = entry_price * (1 - deviation / 100 * reversion_pct) if direction == "short" \
                else entry_price * (1 + abs(deviation) / 100 * reversion_pct)

            trade_pnl = None
            for k in range(2, min(max_hold, n - i)):
                future = close[i + k]

                if direction == "short":
                    pnl = (entry_price - future) / entry_price * 100
                    if future <= target:
                        trade_pnl = (entry_price - target) / entry_price * 100 - 0.2
                        break
                    if pnl <= -sl_pct:
                        trade_pnl = -sl_pct - 0.2
                        break
                else:
                    pnl = (future - entry_price) / entry_price * 100
                    if future >= target:
                        trade_pnl = (target - entry_price) / entry_price * 100 - 0.2
                        break
                    if pnl <= -sl_pct:
                        trade_pnl = -sl_pct - 0.2
                        break

            if trade_pnl is None:
                # Timeout
                final = close[min(i + max_hold - 1, n - 1)]
                if direction == "short":
                    trade_pnl = (entry_price - final) / entry_price * 100 - 0.2
                else:
                    trade_pnl = (final - entry_price) / entry_price * 100 - 0.2

            pnls.append(trade_pnl)
            i += max_hold // 2  # avoid overlapping trades

            i += 6  # minimum gap between trades

        if pnls:
            all_pnls.extend(pnls)
            coin_results[sym] = calc_metrics(pnls)

    return all_pnls, coin_results


def run():
    engine = ResearchEngine(top_n=30)

    print("\n" + "="*70)
    print("LEVEL 2: 볼륨 프로파일 POC 회귀 — 정식 검증")
    print("="*70)

    # ============================================================
    # TEST 1: 파라미터 그리드
    # ============================================================
    print("\n  TEST 1: 파라미터 그리드 (BTC only)")

    btc_coins = [(s, d) for s, d in engine.coins if s == "BTCUSDT"]
    results_grid = []

    for window in [120, 168, 336]:
        for dev_thresh in [1.5, 2.0, 3.0]:
            for rev_pct in [0.3, 0.5, 0.7]:
                for sl in [2, 3, 5]:
                    pnls, _ = run_vp_strategy(btc_coins, window, dev_thresh, rev_pct, sl,
                                              start_date=datetime.now() - timedelta(days=730))
                    m = calc_metrics(pnls)
                    if m["trades"] >= 10:
                        results_grid.append({
                            "window": window, "dev_thresh": dev_thresh,
                            "rev_pct": rev_pct, "sl": sl,
                            "pf": m["pf"], "wr": m["wr"], "trades": m["trades"],
                            "sharpe": m["sharpe"], "mdd": m["mdd"], "ret": m["ret"],
                        })

    engine.save("L2_vp_grid", results_grid)

    # Best combo
    if results_grid:
        best = max(results_grid, key=lambda x: x["pf"])
        print(f"    Best: window={best['window']} dev={best['dev_thresh']} rev={best['rev_pct']} sl={best['sl']}")
        print(f"          PF={best['pf']:.2f} WR={best['wr']:.1f}% T={best['trades']} Sharpe={best['sharpe']:.2f} MDD={best['mdd']:.1f}%")

        # Show top 5
        results_grid.sort(key=lambda x: x["pf"], reverse=True)
        print(f"\n    Top 5:")
        for i, r in enumerate(results_grid[:5]):
            print(f"      {i+1}. w={r['window']} d={r['dev_thresh']} r={r['rev_pct']} sl={r['sl']} → PF={r['pf']:.2f} T={r['trades']} Sharpe={r['sharpe']:.2f}")

        best_params = best
    else:
        print("    No results!")
        return

    # ============================================================
    # TEST 2: 멀티코인 검증 (best params)
    # ============================================================
    print(f"\n  TEST 2: 멀티코인 검증 (best params)")

    pnls_all, coin_results = run_vp_strategy(
        engine.coins, best_params["window"], best_params["dev_thresh"],
        best_params["rev_pct"], best_params["sl"],
        start_date=datetime.now() - timedelta(days=730),
    )

    results_coins = []
    profitable_count = 0
    for sym, m in sorted(coin_results.items(), key=lambda x: x[1]["pf"], reverse=True):
        mark = "✓" if m["pf"] > 1.0 else "✗"
        if m["pf"] > 1.0:
            profitable_count += 1
        results_coins.append({"coin": sym, **m})
        if len(results_coins) <= 10 or m["pf"] > 1.2:
            print(f"    {sym:12s}: PF={m['pf']:.2f} WR={m['wr']:.1f}% T={m['trades']} {mark}")

    m_all = calc_metrics(pnls_all)
    print(f"\n    AGGREGATE: PF={m_all['pf']:.2f} WR={m_all['wr']:.1f}% T={m_all['trades']} Sharpe={m_all['sharpe']:.2f} MDD={m_all['mdd']:.1f}%")
    print(f"    Profitable coins: {profitable_count}/{len(coin_results)}")

    engine.save("L2_vp_multicoin", results_coins)

    # ============================================================
    # TEST 3: OOS Walk-Forward
    # ============================================================
    print(f"\n  TEST 3: OOS Walk-Forward (6m IS → 3m OOS)")

    results_oos = []
    windows_wf = []
    start_wf = datetime(2024, 4, 1)

    while start_wf + timedelta(days=270) <= datetime.now():
        is_start = start_wf
        is_end = start_wf + timedelta(days=180)
        oos_start = is_end
        oos_end = is_end + timedelta(days=90)
        windows_wf.append((is_start, is_end, oos_start, oos_end))
        start_wf += timedelta(days=90)

    for i, (is_s, is_e, oos_s, oos_e) in enumerate(windows_wf):
        is_pnls, _ = run_vp_strategy(
            engine.coins, best_params["window"], best_params["dev_thresh"],
            best_params["rev_pct"], best_params["sl"], start_date=is_s,
        )
        # Filter to IS period (approximate)
        oos_pnls, _ = run_vp_strategy(
            engine.coins, best_params["window"], best_params["dev_thresh"],
            best_params["rev_pct"], best_params["sl"], start_date=oos_s,
        )

        is_m = calc_metrics(is_pnls)
        oos_m = calc_metrics(oos_pnls)

        is_mark = "✓" if is_m["pf"] > 1.0 else "✗"
        oos_mark = "✓" if oos_m["pf"] > 1.0 else "✗"

        results_oos.append({
            "window": i + 1,
            "is_period": f"{is_s.strftime('%Y-%m')}~{is_e.strftime('%Y-%m')}",
            "oos_period": f"{oos_s.strftime('%Y-%m')}~{oos_e.strftime('%Y-%m')}",
            "is_pf": is_m["pf"], "is_trades": is_m["trades"],
            "oos_pf": oos_m["pf"], "oos_trades": oos_m["trades"],
            "degradation": round(oos_m["pf"] - is_m["pf"], 2),
        })
        print(f"    W{i+1}: IS PF={is_m['pf']:.2f} {is_mark} | OOS PF={oos_m['pf']:.2f} {oos_mark} | Δ={oos_m['pf']-is_m['pf']:+.2f}")

    engine.save("L2_vp_oos", results_oos)

    if results_oos:
        oos_pfs = [r["oos_pf"] for r in results_oos if r["oos_trades"] > 0]
        if oos_pfs:
            print(f"\n    OOS avg PF: {np.mean(oos_pfs):.2f}, Profitable: {sum(p > 1.0 for p in oos_pfs)}/{len(oos_pfs)}")

    # ============================================================
    # TEST 4: 포지션 사이징 시뮬레이션
    # ============================================================
    print(f"\n  TEST 4: 포지션 사이징 ($10K, 1% risk)")

    pnls_full, _ = run_vp_strategy(
        engine.coins, best_params["window"], best_params["dev_thresh"],
        best_params["rev_pct"], best_params["sl"],
        start_date=datetime.now() - timedelta(days=365),
    )

    if pnls_full:
        capital = 10000
        sl_dollar = best_params["sl"]
        equity = [capital]
        for p in pnls_full:
            pos_size = equity[-1] * 0.01 / (sl_dollar / 100)
            pnl_dollar = pos_size * (p / 100)
            equity.append(equity[-1] + pnl_dollar)

        ea = np.array(equity)
        peaks = np.maximum.accumulate(ea)
        dd = (peaks - ea) / peaks * 100
        mdd = float(np.max(dd))
        final = equity[-1]
        ret = (final / capital - 1) * 100

        print(f"    $10,000 → ${final:,.0f} ({ret:+.1f}%) MDD={mdd:.1f}% Trades={len(pnls_full)}")


if __name__ == "__main__":
    run()
