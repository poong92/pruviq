#!/usr/bin/env python3
"""
혁신 연구 — OHLCV만으로 가능한 새로운 엣지 탐색

LEVEL 1: Hurst Exponent 레짐 필터 (트렌드 vs 평균회귀 구분)
LEVEL 2: 모멘텀 로테이션 (cross-sectional momentum)
LEVEL 3: 멀티타임프레임 확인 (1H + 4H 정렬)
LEVEL 4: 볼륨 프로파일 전략 (POC 회귀)
LEVEL 5: 조합 — 기존 전략 + 새 필터

각 레벨을 검증 후 다음으로 진행.
"""

import sys
import time
import csv
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from research.framework import ResearchEngine, calc_metrics, hurst_exponent, volume_profile, COST_MODEL
from src.strategies.registry import get_strategy
from src.simulation.engine_fast import run_fast

OUT_DIR = Path("/tmp/strategy_analysis")
OUT_DIR.mkdir(exist_ok=True)

FEE, SLIP, FUND = COST_MODEL["fee_pct"], COST_MODEL["slippage_pct"], COST_MODEL["funding_rate_8h"]
START_2Y = datetime.now() - timedelta(days=730)
START_1Y = datetime.now() - timedelta(days=365)


def load_coins(top_n=30):
    """Delegate to ResearchEngine but keep standalone compatibility."""
    e = ResearchEngine(top_n=top_n, verbose=False)
    return e.coins


# calc_metrics is imported from framework
# hurst_exponent is imported from framework

_PLACEHOLDER = {
        "pf": round(tw / tl, 2),
        "wr": round(len(wins) / len(pnls) * 100, 1),
        "trades": len(pnls),
        "sharpe": round(sharpe, 2),
        "mdd": round(mdd, 1),
        "ret": round(sum(pnls), 1),
    }


def save_csv(results, filename):
    if not results:
        return
    path = OUT_DIR / f"{filename}.csv"
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=results[0].keys())
        w.writeheader()
        w.writerows(results)
    print(f"  ✓ {path.name}: {len(results)} rows")


# ============================================================
# LEVEL 1: Hurst Exponent 레짐 분류기
# ============================================================
def hurst_exponent(series, max_lag=100):
    """Rescaled Range (R/S) method for Hurst exponent."""
    n = len(series)
    if n < max_lag * 2:
        return 0.5

    lags = range(10, min(max_lag, n // 4))
    rs_values = []

    for lag in lags:
        rs_list = []
        for start in range(0, n - lag, lag):
            segment = series[start:start + lag]
            mean_seg = np.mean(segment)
            deviate = np.cumsum(segment - mean_seg)
            r = np.max(deviate) - np.min(deviate)
            s = np.std(segment, ddof=1)
            if s > 0:
                rs_list.append(r / s)
        if rs_list:
            rs_values.append((np.log(lag), np.log(np.mean(rs_list))))

    if len(rs_values) < 5:
        return 0.5

    x = np.array([v[0] for v in rs_values])
    y = np.array([v[1] for v in rs_values])
    slope, _ = np.polyfit(x, y, 1)
    return float(np.clip(slope, 0, 1))


def level1_hurst(coins):
    print("\n" + "="*70)
    print("LEVEL 1: Hurst Exponent 레짐 분류기")
    print("H > 0.6 = trending, H < 0.4 = mean-reverting, 0.4-0.6 = random")
    print("="*70)

    btc_df = None
    for sym, df in coins:
        if sym == "BTCUSDT":
            btc_df = df.copy()
            break

    if btc_df is None:
        print("  No BTC data!")
        return []

    # Calculate rolling Hurst
    returns = btc_df["close"].pct_change().dropna().values
    window = 168  # 1 week of 1H candles

    hurst_values = []
    for i in range(window, len(returns), 24):  # every 24h
        h = hurst_exponent(returns[max(0, i - window):i])
        ts = btc_df["timestamp"].iloc[i] if i < len(btc_df) else None
        hurst_values.append({"timestamp": ts, "hurst": h})

    h_arr = np.array([v["hurst"] for v in hurst_values])
    print(f"  Rolling Hurst (window={window}, {len(hurst_values)} samples):")
    print(f"    Mean: {np.mean(h_arr):.3f}")
    print(f"    Std:  {np.std(h_arr):.3f}")
    print(f"    Min:  {np.min(h_arr):.3f}, Max: {np.max(h_arr):.3f}")
    print(f"    Trending (H>0.6): {sum(h > 0.6 for h in h_arr)}/{len(h_arr)} ({sum(h > 0.6 for h in h_arr)/len(h_arr)*100:.0f}%)")
    print(f"    Mean-Rev (H<0.4): {sum(h < 0.4 for h in h_arr)}/{len(h_arr)} ({sum(h < 0.4 for h in h_arr)/len(h_arr)*100:.0f}%)")
    print(f"    Random  (0.4-0.6): {sum(0.4 <= h <= 0.6 for h in h_arr)}/{len(h_arr)} ({sum(0.4 <= h <= 0.6 for h in h_arr)/len(h_arr)*100:.0f}%)")

    # Test: does Hurst predict which strategy works better?
    # Split into trending vs mean-reverting periods, test strategies on each
    print(f"\n  Testing: Hurst regime → strategy performance")

    # Pre-compute indicators
    strategies_to_test = [
        ("atr-breakout", "short"),  # trend follower
        ("bb-squeeze-short", "short"),  # squeeze (structural)
        ("supertrend", "short"),  # trend follower
        ("ichimoku", "short"),  # trend follower
        ("mean-reversion", "long"),  # mean reverter
        ("mean-reversion", "short"),  # mean reverter
    ]

    indicator_cache = {}
    for sid, _ in strategies_to_test:
        if sid not in indicator_cache:
            strategy, _, _ = get_strategy(sid)
            coin_list = []
            for sym, df in coins:
                coin_list.append((sym, strategy.calculate_indicators(df.copy())))
            indicator_cache[sid] = coin_list

    # For each month, classify by Hurst and test strategies
    results = []
    current = datetime.now() - timedelta(days=700)

    while current + timedelta(days=30) <= datetime.now():
        month_start = current
        month_end = current + timedelta(days=30)

        # Calculate Hurst for this month
        mask = (btc_df["timestamp"] >= pd.Timestamp(month_start)) & \
               (btc_df["timestamp"] <= pd.Timestamp(month_end))
        month_returns = btc_df[mask]["close"].pct_change().dropna().values
        h = hurst_exponent(month_returns) if len(month_returns) > 50 else 0.5

        regime = "trending" if h > 0.55 else ("mean_rev" if h < 0.45 else "random")

        for sid, direction in strategies_to_test:
            strategy, _, _ = get_strategy(sid)
            pnls = []
            for sym, df_ind in indicator_cache[sid]:
                d = df_ind[(df_ind["timestamp"] >= pd.Timestamp(month_start)) &
                           (df_ind["timestamp"] <= pd.Timestamp(month_end))]
                if len(d) < 50:
                    continue
                r = run_fast(d, strategy, sym, sl_pct=0.07, tp_pct=0.07, max_bars=48,
                            fee_pct=FEE, slippage_pct=SLIP, direction=direction,
                            market_type="futures", strategy_id=sid, funding_rate_8h=FUND)
                for t in r.trades:
                    pnls.append(t.pnl_pct)

            m = calc_metrics(pnls)
            results.append({
                "month": month_start.strftime("%Y-%m"),
                "hurst": round(h, 3),
                "regime": regime,
                "strategy": f"{sid}({direction})",
                "pf": m["pf"],
                "wr": m["wr"],
                "trades": m["trades"],
                "ret": m["ret"],
            })

        current += timedelta(days=30)

    save_csv(results, "innovation_L1_hurst")

    # Analyze: trending regime에서 trend 전략 vs mean-rev 전략
    trend_strats = [r for r in results if r["regime"] == "trending"]
    meanrev_strats = [r for r in results if r["regime"] == "mean_rev"]

    print(f"\n  Regime-specific strategy performance:")
    for regime_name, regime_data in [("TRENDING", trend_strats), ("MEAN-REV", meanrev_strats), ("RANDOM", [r for r in results if r["regime"] == "random"])]:
        if not regime_data:
            continue
        print(f"\n    {regime_name} regime ({len(set(r['month'] for r in regime_data))} months):")
        strat_perf = defaultdict(list)
        for r in regime_data:
            strat_perf[r["strategy"]].append(r["pf"])
        for strat, pfs in sorted(strat_perf.items(), key=lambda x: np.mean(x[1]), reverse=True):
            avg_pf = np.mean(pfs)
            mark = "★" if avg_pf > 1.1 else ("▸" if avg_pf > 1.0 else "")
            print(f"      {strat:30s}: avg PF={avg_pf:.2f} {mark}")

    return results


# ============================================================
# LEVEL 2: 모멘텀 로테이션 (Cross-Sectional)
# ============================================================
def level2_momentum_rotation(coins):
    print("\n" + "="*70)
    print("LEVEL 2: 모멘텀 로테이션 (7d return 순위 → top/bottom)")
    print("="*70)

    # 매주: 모든 코인의 7일 수익률 → top 5 long, bottom 5 short
    # 1주 보유 후 리밸런스

    results = []
    weekly_pnls_long = []
    weekly_pnls_short = []
    weekly_pnls_ls = []

    current = datetime.now() - timedelta(days=365)

    while current + timedelta(days=14) <= datetime.now():
        lookback_start = current
        lookback_end = current + timedelta(days=7)
        forward_start = lookback_end
        forward_end = lookback_end + timedelta(days=7)

        # Calculate 7d return for each coin
        coin_returns_lb = {}
        coin_returns_fw = {}

        for sym, df in coins:
            mask_lb = (df["timestamp"] >= pd.Timestamp(lookback_start)) & \
                      (df["timestamp"] <= pd.Timestamp(lookback_end))
            mask_fw = (df["timestamp"] >= pd.Timestamp(forward_start)) & \
                      (df["timestamp"] <= pd.Timestamp(forward_end))

            d_lb = df[mask_lb]
            d_fw = df[mask_fw]

            if len(d_lb) > 20 and len(d_fw) > 20:
                ret_lb = (d_lb["close"].iloc[-1] / d_lb["close"].iloc[0] - 1) * 100
                ret_fw = (d_fw["close"].iloc[-1] / d_fw["close"].iloc[0] - 1) * 100
                coin_returns_lb[sym] = ret_lb
                coin_returns_fw[sym] = ret_fw

        if len(coin_returns_lb) < 10:
            current += timedelta(days=7)
            continue

        # Sort by lookback return
        sorted_coins = sorted(coin_returns_lb.items(), key=lambda x: x[1], reverse=True)
        top5 = [c[0] for c in sorted_coins[:5]]
        bottom5 = [c[0] for c in sorted_coins[-5:]]

        # Forward returns
        top5_fw = [coin_returns_fw[c] for c in top5 if c in coin_returns_fw]
        bottom5_fw = [coin_returns_fw[c] for c in bottom5 if c in coin_returns_fw]

        if top5_fw and bottom5_fw:
            long_ret = np.mean(top5_fw)
            short_ret = -np.mean(bottom5_fw)  # short = profit from decline
            ls_ret = (long_ret + short_ret) / 2

            weekly_pnls_long.append(long_ret)
            weekly_pnls_short.append(short_ret)
            weekly_pnls_ls.append(ls_ret)

            results.append({
                "week_start": forward_start.strftime("%Y-%m-%d"),
                "long_top5": round(long_ret, 2),
                "short_bottom5": round(short_ret, 2),
                "long_short": round(ls_ret, 2),
                "top5_coins": ",".join(top5),
                "bottom5_coins": ",".join(bottom5),
            })

        current += timedelta(days=7)

    save_csv(results, "innovation_L2_momentum")

    print(f"\n  {len(results)} weeks tested")
    for name, pnls in [("Long Top5", weekly_pnls_long), ("Short Bottom5", weekly_pnls_short), ("Long-Short", weekly_pnls_ls)]:
        m = calc_metrics(pnls)
        eq_final = 100
        for p in pnls:
            eq_final *= (1 + p / 100)
        print(f"    {name:20s}: PF={m['pf']:.2f} WR={m['wr']:.1f}% Sharpe={m['sharpe']:.2f} Total={sum(pnls):.1f}% Final={eq_final:.0f}")

    return results


# ============================================================
# LEVEL 3: 멀티타임프레임 확인
# ============================================================
def level3_multi_timeframe(coins, indicator_cache=None):
    print("\n" + "="*70)
    print("LEVEL 3: 멀티타임프레임 확인 (1H signal + 4H trend)")
    print("="*70)

    strategies_to_test = [
        ("atr-breakout", "short"),
        ("bb-squeeze-short", "short"),
        ("supertrend", "short"),
        ("ichimoku", "short"),
    ]

    results = []

    for sid, direction in strategies_to_test:
        strategy, _, _ = get_strategy(sid)
        pnls_base = []
        pnls_mtf = []

        for sym, df_full in coins:
            df = df_full[df_full["timestamp"] >= pd.Timestamp(START_1Y)].copy()
            if len(df) < 500:
                continue

            # 1H indicators
            df_1h = strategy.calculate_indicators(df.copy())

            # 4H trend: resample and check EMA20 > EMA50
            df_4h = df.resample("4h", on="timestamp").agg({
                "open": "first", "high": "max", "low": "min",
                "close": "last", "volume": "sum"
            }).dropna().reset_index()
            df_4h["ema20"] = df_4h["close"].ewm(span=20).mean()
            df_4h["ema50"] = df_4h["close"].ewm(span=50).mean()
            df_4h["trend_4h"] = np.where(df_4h["ema20"] > df_4h["ema50"], "up", "down")

            # Base: just 1H
            r_base = run_fast(df_1h, strategy, sym, sl_pct=0.07, tp_pct=0.07, max_bars=48,
                            fee_pct=FEE, slippage_pct=SLIP, direction=direction,
                            market_type="futures", strategy_id=sid, funding_rate_8h=FUND)
            for t in r_base.trades:
                pnls_base.append(t.pnl_pct)

            # MTF: 1H signal only when 4H trend aligns
            # For SHORT: only when 4H trend is "down"
            # For LONG: only when 4H trend is "up"
            # We do this by modifying the signal column
            df_mtf = df_1h.copy()
            if "signal" in df_mtf.columns:
                # Map 4H trend to 1H bars
                df_mtf["trend_4h"] = "neutral"
                for _, row_4h in df_4h.iterrows():
                    mask = (df_mtf["timestamp"] >= row_4h["timestamp"]) & \
                           (df_mtf["timestamp"] < row_4h["timestamp"] + pd.Timedelta(hours=4))
                    df_mtf.loc[mask, "trend_4h"] = row_4h["trend_4h"]

                # Filter signals: SHORT only when 4H downtrend
                if direction == "short":
                    df_mtf.loc[df_mtf["trend_4h"] != "down", "signal"] = 0
                elif direction == "long":
                    df_mtf.loc[df_mtf["trend_4h"] != "up", "signal"] = 0

            r_mtf = run_fast(df_mtf, strategy, sym, sl_pct=0.07, tp_pct=0.07, max_bars=48,
                           fee_pct=FEE, slippage_pct=SLIP, direction=direction,
                           market_type="futures", strategy_id=sid, funding_rate_8h=FUND)
            for t in r_mtf.trades:
                pnls_mtf.append(t.pnl_pct)

        m_base = calc_metrics(pnls_base)
        m_mtf = calc_metrics(pnls_mtf)

        print(f"\n  {sid} {direction}:")
        print(f"    1H only:    PF={m_base['pf']:.2f} WR={m_base['wr']:.1f}% T={m_base['trades']} Sharpe={m_base['sharpe']:.2f} MDD={m_base['mdd']:.1f}%")
        print(f"    1H+4H MTF:  PF={m_mtf['pf']:.2f} WR={m_mtf['wr']:.1f}% T={m_mtf['trades']} Sharpe={m_mtf['sharpe']:.2f} MDD={m_mtf['mdd']:.1f}%")

        improvement = m_mtf["pf"] - m_base["pf"]
        mark = "↑ IMPROVED" if improvement > 0.05 else ("= SAME" if abs(improvement) <= 0.05 else "↓ WORSE")
        print(f"    Δ PF: {improvement:+.2f} {mark}")

        results.append({
            "strategy": f"{sid}({direction})",
            "base_pf": m_base["pf"], "base_wr": m_base["wr"], "base_trades": m_base["trades"],
            "mtf_pf": m_mtf["pf"], "mtf_wr": m_mtf["wr"], "mtf_trades": m_mtf["trades"],
            "pf_delta": round(improvement, 2),
            "base_sharpe": m_base["sharpe"], "mtf_sharpe": m_mtf["sharpe"],
        })

    save_csv(results, "innovation_L3_mtf")
    return results


# ============================================================
# LEVEL 4: 볼륨 프로파일 (POC 회귀)
# ============================================================
def level4_volume_profile(coins):
    print("\n" + "="*70)
    print("LEVEL 4: 볼륨 프로파일 (POC 회귀 전략)")
    print("="*70)

    pnls_all = []
    results = []

    for sym, df_full in coins[:10]:  # top 10 for speed
        df = df_full[df_full["timestamp"] >= pd.Timestamp(START_1Y)].copy()
        if len(df) < 500:
            continue

        # Rolling 168-period (1 week) volume profile
        close = df["close"].values
        volume = df["volume"].values
        n = len(close)

        window = 168
        pnls = []

        for i in range(window, n - 48, 24):  # check every 24 bars
            # Volume profile for last `window` bars
            w_close = close[i - window:i]
            w_vol = volume[i - window:i]

            if np.sum(w_vol) == 0:
                continue

            # Create price bins
            price_min, price_max = np.min(w_close), np.max(w_close)
            if price_max == price_min:
                continue

            n_bins = 20
            bins = np.linspace(price_min, price_max, n_bins + 1)
            bin_volumes = np.zeros(n_bins)

            for j in range(len(w_close)):
                bin_idx = int((w_close[j] - price_min) / (price_max - price_min) * (n_bins - 1))
                bin_idx = min(bin_idx, n_bins - 1)
                bin_volumes[bin_idx] += w_vol[j]

            poc_idx = np.argmax(bin_volumes)
            poc_price = (bins[poc_idx] + bins[poc_idx + 1]) / 2

            current_price = close[i]
            deviation = (current_price - poc_price) / poc_price * 100

            # Signal: price deviates > 2% from POC → mean revert
            if abs(deviation) > 2.0:
                # Short if above POC, long if below
                direction = "short" if deviation > 0 else "long"

                # Simple trade: entry at current, exit at POC or SL/TP
                entry_price = current_price
                sl_pct = 3.0
                tp_price = poc_price

                # Simulate forward 48 bars
                for k in range(1, min(48, n - i)):
                    future_price = close[i + k]

                    if direction == "short":
                        pnl = (entry_price - future_price) / entry_price * 100
                        if pnl >= abs(deviation) * 0.5:  # TP at 50% reversion
                            pnls.append(pnl - 0.2)  # fees
                            break
                        if pnl <= -sl_pct:
                            pnls.append(-sl_pct - 0.2)
                            break
                    else:
                        pnl = (future_price - entry_price) / entry_price * 100
                        if pnl >= abs(deviation) * 0.5:
                            pnls.append(pnl - 0.2)
                            break
                        if pnl <= -sl_pct:
                            pnls.append(-sl_pct - 0.2)
                            break
                else:
                    # Timeout
                    if direction == "short":
                        pnls.append((entry_price - close[min(i + 47, n - 1)]) / entry_price * 100 - 0.2)
                    else:
                        pnls.append((close[min(i + 47, n - 1)] - entry_price) / entry_price * 100 - 0.2)

        if pnls:
            m = calc_metrics(pnls)
            pnls_all.extend(pnls)
            results.append({
                "coin": sym, "pf": m["pf"], "wr": m["wr"],
                "trades": m["trades"], "sharpe": m["sharpe"], "ret": m["ret"],
            })
            mark = "✓" if m["pf"] > 1.0 else "✗"
            print(f"  {sym:10s}: PF={m['pf']:.2f} WR={m['wr']:.1f}% T={m['trades']} {mark}")

    save_csv(results, "innovation_L4_volume_profile")

    if pnls_all:
        m_all = calc_metrics(pnls_all)
        print(f"\n  AGGREGATE: PF={m_all['pf']:.2f} WR={m_all['wr']:.1f}% T={m_all['trades']} Sharpe={m_all['sharpe']:.2f}")

    return results


# ============================================================
# LEVEL 5: 조합 — 기존 최강 전략 + 새 필터
# ============================================================
def level5_combined(coins):
    print("\n" + "="*70)
    print("LEVEL 5: 기존 전략 + Hurst 필터 + MTF 조합")
    print("="*70)

    btc_df = None
    for sym, df in coins:
        if sym == "BTCUSDT":
            btc_df = df.copy()
            break

    # Pre-compute rolling Hurst for BTC
    returns = btc_df["close"].pct_change().dropna().values
    hurst_by_day = {}
    for i in range(168, len(returns), 24):
        h = hurst_exponent(returns[max(0, i - 168):i])
        day = str(btc_df["timestamp"].iloc[i])[:10]
        hurst_by_day[day] = h

    # Test combinations
    configs = [
        {"name": "EW 5xSHORT (baseline)", "strategies": [
            ("atr-breakout", "short"), ("bb-squeeze-short", "short"),
            ("keltner-squeeze", "short"), ("ichimoku", "short"), ("supertrend", "short")
        ], "hurst_filter": None},
        {"name": "EW 5xSHORT + Hurst>0.5 only", "strategies": [
            ("atr-breakout", "short"), ("bb-squeeze-short", "short"),
            ("keltner-squeeze", "short"), ("ichimoku", "short"), ("supertrend", "short")
        ], "hurst_filter": "trending"},
        {"name": "Trend(H>0.5)→SHORT, MR(H<0.5)→MeanRev", "strategies": "adaptive", "hurst_filter": "adaptive"},
    ]

    # Pre-compute all indicators
    all_sids = ["atr-breakout", "bb-squeeze-short", "keltner-squeeze", "ichimoku", "supertrend", "mean-reversion"]
    indicator_cache = {}
    for sid in all_sids:
        strategy, _, _ = get_strategy(sid)
        coin_list = []
        for sym, df in coins:
            coin_list.append((sym, strategy.calculate_indicators(df.copy())))
        indicator_cache[sid] = coin_list

    for config in configs:
        name = config["name"]
        print(f"\n  --- {name} ---")

        equity = [10000]
        period_pnls = []

        current = datetime.now() - timedelta(days=365)
        while current + timedelta(days=7) <= datetime.now():
            week_start = current
            week_end = current + timedelta(days=7)
            day_key = week_start.strftime("%Y-%m-%d")

            h = hurst_by_day.get(day_key, 0.5)

            # Select strategies based on config
            if config["hurst_filter"] == "trending" and h < 0.5:
                current += timedelta(days=7)
                equity.append(equity[-1])  # flat
                continue
            elif config["hurst_filter"] == "adaptive":
                if h > 0.5:
                    strats = [("atr-breakout", "short"), ("supertrend", "short"), ("ichimoku", "short")]
                else:
                    strats = [("mean-reversion", "long"), ("mean-reversion", "short"), ("bb-squeeze-short", "short")]
            elif config["strategies"] == "adaptive":
                strats = [("atr-breakout", "short")]
            else:
                strats = config["strategies"]

            # Run all selected strategies
            week_pnls = []
            for sid, direction in strats:
                strategy, _, _ = get_strategy(sid)
                for sym, df_ind in indicator_cache[sid]:
                    d = df_ind[(df_ind["timestamp"] >= pd.Timestamp(week_start)) &
                               (df_ind["timestamp"] <= pd.Timestamp(week_end))]
                    if len(d) < 50:
                        continue
                    r = run_fast(d, strategy, sym, sl_pct=0.07, tp_pct=0.07, max_bars=48,
                                fee_pct=FEE, slippage_pct=SLIP, direction=direction,
                                market_type="futures", strategy_id=sid, funding_rate_8h=FUND)
                    for t in r.trades:
                        week_pnls.append(t.pnl_pct / len(strats))  # equal weight

            week_total = sum(week_pnls)
            period_pnls.append(week_total)
            cap = equity[-1] * (1 + week_total / 100 * 0.3)
            equity.append(cap)

            current += timedelta(days=7)

        # Metrics
        ea = np.array(equity)
        peaks = np.maximum.accumulate(ea)
        dd = (peaks - ea) / peaks * 100
        mdd = float(np.max(dd))
        final = equity[-1]
        ret = (final / 10000 - 1) * 100
        profitable_weeks = sum(1 for p in period_pnls if p > 0)

        pa = np.array(period_pnls) if period_pnls else np.array([0])
        sharpe = float(np.mean(pa) / np.std(pa) * np.sqrt(52)) if np.std(pa) > 0 else 0

        mark = "★" if ret > 30 and mdd < 30 else ("✓" if ret > 0 else "✗")
        print(f"    ${10000} → ${final:,.0f} ({ret:+.1f}%) MDD={mdd:.1f}% Sharpe={sharpe:.2f} W+={profitable_weeks}/{len(period_pnls)} {mark}")

    return []


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    start = time.time()
    print(f"Innovation Research — {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    coins = load_coins(top_n=30)
    print(f"Loaded {len(coins)} coins")

    l1 = level1_hurst(coins)
    l2 = level2_momentum_rotation(coins)
    l3 = level3_multi_timeframe(coins)
    l4 = level4_volume_profile(coins)
    l5 = level5_combined(coins)

    elapsed = time.time() - start
    print(f"\n{'='*70}")
    print(f"COMPLETE in {elapsed:.0f}s ({elapsed/60:.1f}m)")
