#!/usr/bin/env python3
"""
LEVEL 6: 외부 데이터 전략 연구

1. OI (Open Interest) — 가격과 OI 변화의 관계 → 시그널
2. Fear & Greed Index — 극단값에서 반대 방향 진입
3. Options Max Pain — 만기 전 가격 끌림 효과
4. 기존 전략 + 외부 데이터 조합

모든 데이터를 수집 → 백테스트 기간과 매칭 → 엣지 검증
"""

import sys
import time
import json
import csv
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

import numpy as np
import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).parent.parent))
from research.framework import ResearchEngine, calc_metrics, COST_MODEL
from src.strategies.registry import get_strategy
from src.simulation.engine_fast import run_fast

OUT_DIR = Path(__file__).parent / "20260328"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# DATA COLLECTION
# ============================================================
def fetch_oi_history(symbol="BTCUSDT", period="1h", limit=500):
    """Fetch OI history from Binance."""
    url = "https://fapi.binance.com/futures/data/openInterestHist"
    all_data = []
    end_time = None

    for _ in range(10):
        params = {"symbol": symbol, "period": period, "limit": limit}
        if end_time:
            params["endTime"] = end_time
        try:
            r = requests.get(url, params=params, timeout=15)
            if r.status_code != 200:
                break
            data = r.json()
            if not data:
                break
            all_data.extend(data)
            end_time = data[0]["timestamp"] - 1
            time.sleep(0.3)
            if len(data) < limit:
                break
        except Exception as e:
            print(f"  OI fetch error: {e}")
            break

    if not all_data:
        return None

    df = pd.DataFrame(all_data)
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
    df["sumOpenInterest"] = df["sumOpenInterest"].astype(float)
    df["sumOpenInterestValue"] = df["sumOpenInterestValue"].astype(float)
    df = df.drop_duplicates(subset="timestamp").sort_values("timestamp").reset_index(drop=True)
    return df


def fetch_fear_greed(limit=365):
    """Fetch Fear & Greed Index history."""
    try:
        r = requests.get(f"https://api.alternative.me/fng/?limit={limit}", timeout=10)
        data = r.json().get("data", [])
        df = pd.DataFrame(data)
        df["timestamp"] = pd.to_datetime(df["timestamp"].astype(int), unit="s")
        df["value"] = df["value"].astype(int)
        df = df.sort_values("timestamp").reset_index(drop=True)
        return df
    except Exception as e:
        print(f"  FnG fetch error: {e}")
        return None


def fetch_funding_rates_full():
    """Load cached funding rates."""
    path = Path(__file__).parent / "20260327" / "btc_funding_rates_full.csv"
    if path.exists():
        df = pd.read_csv(path)
        df["fundingTime"] = pd.to_datetime(df["fundingTime"])
        return df
    return None


# ============================================================
# RESEARCH 1: OI 변화율 → 가격 방향 예측
# ============================================================
def research_oi(engine):
    print("\n" + "="*70)
    print("RESEARCH 1: Open Interest 변화율 → 가격 방향")
    print("="*70)

    print("  Fetching OI history...")
    oi_df = fetch_oi_history("BTCUSDT", "1h", 500)
    if oi_df is None or len(oi_df) < 100:
        print("  Insufficient OI data")
        return []

    oi_df.to_csv(OUT_DIR / "btc_oi_history.csv", index=False)
    print(f"  OI records: {len(oi_df)}, range: {oi_df['timestamp'].iloc[0]} ~ {oi_df['timestamp'].iloc[-1]}")

    # OI 변화율 계산
    oi_df["oi_change_pct"] = oi_df["sumOpenInterest"].pct_change() * 100

    # BTC 가격 매칭
    btc = engine.get_btc()
    results = []

    for _, row in oi_df.iterrows():
        ts = row["timestamp"]
        oi_change = row["oi_change_pct"]
        if pd.isna(oi_change):
            continue

        # 다음 8시간 가격 변화
        mask_now = (btc["timestamp"] >= ts - timedelta(hours=1)) & (btc["timestamp"] <= ts)
        mask_8h = (btc["timestamp"] >= ts + timedelta(hours=7)) & (btc["timestamp"] <= ts + timedelta(hours=9))

        d_now = btc[mask_now]
        d_8h = btc[mask_8h]

        if len(d_now) > 0 and len(d_8h) > 0:
            ret_8h = (d_8h["close"].iloc[0] / d_now["close"].iloc[-1] - 1) * 100
            results.append({
                "timestamp": ts.strftime("%Y-%m-%d %H:%M"),
                "oi_change_pct": round(oi_change, 4),
                "return_8h": round(ret_8h, 4),
            })

    if not results:
        print("  No matched data")
        return []

    df_merged = pd.DataFrame(results)
    engine.save("L6_oi_returns", results)

    # 분석: OI 급증/급감 시 가격 방향
    print(f"\n  Matched: {len(df_merged)} records")
    for name, low, high in [
        ("OI surge (>2%)", 2, 999),
        ("OI rise (0.5~2%)", 0.5, 2),
        ("OI flat (-0.5~+0.5%)", -0.5, 0.5),
        ("OI drop (-2~-0.5%)", -2, -0.5),
        ("OI crash (<-2%)", -999, -2),
    ]:
        mask = (df_merged["oi_change_pct"] > low) & (df_merged["oi_change_pct"] <= high)
        subset = df_merged[mask]
        if len(subset) < 5:
            continue
        avg_ret = subset["return_8h"].mean()
        up_pct = (subset["return_8h"] > 0).sum() / len(subset) * 100
        print(f"    {name:25s}: N={len(subset):4d} avg_ret={avg_ret:+.3f}% up={up_pct:.0f}%")

    return results


# ============================================================
# RESEARCH 2: Fear & Greed → 전략 성과
# ============================================================
def research_fear_greed(engine):
    print("\n" + "="*70)
    print("RESEARCH 2: Fear & Greed Index → 전략 필터")
    print("="*70)

    fng_df = fetch_fear_greed(365)
    if fng_df is None or len(fng_df) < 30:
        print("  Insufficient FnG data")
        return []

    fng_df.to_csv(OUT_DIR / "fear_greed_history.csv", index=False)
    print(f"  FnG records: {len(fng_df)}, range: {fng_df['timestamp'].iloc[0].date()} ~ {fng_df['timestamp'].iloc[-1].date()}")
    print(f"  Current: {fng_df['value'].iloc[-1]} ({fng_df['value_classification'].iloc[-1]})")

    # 일별 FnG lookup
    fng_daily = {}
    for _, row in fng_df.iterrows():
        fng_daily[row["timestamp"].strftime("%Y-%m-%d")] = row["value"]

    # 전략별: FnG 구간에서 성과 비교
    engine.precompute(["atr-breakout", "bb-squeeze-short", "ichimoku", "ma-cross"])

    strategies = [("atr-breakout", "short"), ("bb-squeeze-short", "short"),
                  ("ichimoku", "short"), ("ma-cross", "short")]

    results = []
    fng_bins = [
        ("Extreme Fear (0-20)", 0, 20),
        ("Fear (20-40)", 20, 40),
        ("Neutral (40-60)", 40, 60),
        ("Greed (60-80)", 60, 80),
        ("Extreme Greed (80-100)", 80, 100),
    ]

    for sid, direction in strategies:
        strategy, _, _ = get_strategy(sid)
        print(f"\n  {sid} {direction}:")

        for bin_name, fng_low, fng_high in fng_bins:
            pnls = []
            for sym, df_ind in engine.indicator_cache[sid]:
                df = df_ind[df_ind["timestamp"] >= pd.Timestamp(datetime.now() - timedelta(days=365))]
                if len(df) < 50:
                    continue
                r = run_fast(df, strategy, sym, sl_pct=0.07, tp_pct=0.07, max_bars=48,
                            fee_pct=COST_MODEL["fee_pct"], slippage_pct=COST_MODEL["slippage_pct"],
                            direction=direction, market_type="futures", strategy_id=sid,
                            funding_rate_8h=COST_MODEL["funding_rate_8h"])
                for t in r.trades:
                    day = str(t.entry_time)[:10]
                    fng = fng_daily.get(day)
                    if fng is not None and fng_low <= fng < fng_high:
                        pnls.append(t.pnl_pct)

            m = calc_metrics(pnls)
            if m["trades"] >= 10:
                mark = "★" if m["pf"] > 1.2 else ("▸" if m["pf"] > 1.0 else "")
                print(f"    {bin_name:25s}: PF={m['pf']:.2f} WR={m['wr']:.1f}% T={m['trades']} {mark}")
                results.append({
                    "strategy": f"{sid}({direction})",
                    "fng_bin": bin_name,
                    "pf": m["pf"], "wr": m["wr"], "trades": m["trades"],
                })

    engine.save("L6_fng_strategy", results)
    return results


# ============================================================
# RESEARCH 3: 신규 OHLCV 전략 (Kalman, Z-Score, Pairs)
# ============================================================
def research_new_strategies(engine):
    print("\n" + "="*70)
    print("RESEARCH 3: 신규 OHLCV 전략")
    print("="*70)

    btc = engine.get_btc()
    close = btc["close"].values
    n = len(close)
    results = []

    # 3a: Z-Score Mean Reversion (168-period)
    print("\n  3a: Z-Score Mean Reversion (168-period)")
    window = 168
    pnls_zscore = []
    for i in range(window + 10, n - 48, 8):
        w = close[i-window:i]
        z = (close[i] - np.mean(w)) / np.std(w) if np.std(w) > 0 else 0

        if abs(z) < 2.0:
            continue

        direction = "short" if z > 0 else "long"
        entry = close[i+1] if i+1 < n else close[i]

        for k in range(2, min(48, n-i)):
            future = close[i+k]
            if direction == "short":
                pnl = (entry - future) / entry * 100
            else:
                pnl = (future - entry) / entry * 100

            if pnl >= 2.0:
                pnls_zscore.append(pnl - 0.2)
                break
            if pnl <= -3.0:
                pnls_zscore.append(-3.0 - 0.2)
                break
        else:
            final = close[min(i+47, n-1)]
            pnl = ((entry-final)/entry*100 if direction=="short" else (final-entry)/entry*100) - 0.2
            pnls_zscore.append(pnl)

    m = calc_metrics(pnls_zscore)
    print(f"    BTC: PF={m['pf']:.2f} WR={m['wr']:.1f}% T={m['trades']} Sharpe={m['sharpe']:.2f}")
    results.append({"strategy": "z-score-168", "coin": "BTC", **m})

    # 3b: Kalman Filter Trend
    print("\n  3b: Kalman Filter (adaptive EMA)")
    # Simple Kalman: state = price, measurement = close
    kalman = np.zeros(n)
    kalman[0] = close[0]
    q = 0.001  # process noise
    r_noise = 0.1  # measurement noise
    p = 1.0
    for i in range(1, n):
        # predict
        p_pred = p + q
        # update
        k = p_pred / (p_pred + r_noise)
        kalman[i] = kalman[i-1] + k * (close[i] - kalman[i-1])
        p = (1 - k) * p_pred

    pnls_kalman = []
    for i in range(200, n - 48, 12):
        # Signal: price crosses Kalman line
        prev_above = close[i-1] > kalman[i-1]
        curr_above = close[i] > kalman[i]

        if prev_above and not curr_above:  # cross below → short
            direction = "short"
        elif not prev_above and curr_above:  # cross above → long
            direction = "long"
        else:
            continue

        entry = close[i+1] if i+1 < n else close[i]
        for k in range(2, min(48, n-i)):
            future = close[i+k]
            pnl = ((entry-future)/entry*100 if direction=="short" else (future-entry)/entry*100)
            if pnl >= 3.0:
                pnls_kalman.append(pnl - 0.2)
                break
            if pnl <= -3.0:
                pnls_kalman.append(-3.0 - 0.2)
                break
        else:
            final = close[min(i+47, n-1)]
            pnl = ((entry-final)/entry*100 if direction=="short" else (final-entry)/entry*100) - 0.2
            pnls_kalman.append(pnl)

    m = calc_metrics(pnls_kalman)
    print(f"    BTC: PF={m['pf']:.2f} WR={m['wr']:.1f}% T={m['trades']} Sharpe={m['sharpe']:.2f}")
    results.append({"strategy": "kalman-cross", "coin": "BTC", **m})

    # 3c: Pairs Trading (BTC/ETH spread)
    print("\n  3c: Pairs Trading (BTC/ETH spread)")
    eth = None
    for sym, df in engine.coins:
        if sym == "ETHUSDT":
            eth = df.copy()
            break

    if eth is not None:
        # Align timestamps
        merged = pd.merge(
            btc[["timestamp", "close"]].rename(columns={"close": "btc"}),
            eth[["timestamp", "close"]].rename(columns={"close": "eth"}),
            on="timestamp", how="inner"
        )
        merged["ratio"] = merged["btc"] / merged["eth"]
        merged["ratio_z"] = (merged["ratio"] - merged["ratio"].rolling(168).mean()) / merged["ratio"].rolling(168).std()

        pnls_pairs = []
        ratio_vals = merged["ratio"].values
        z_vals = merged["ratio_z"].values
        n_pairs = len(merged)

        for i in range(200, n_pairs - 48, 12):
            z = z_vals[i]
            if pd.isna(z) or abs(z) < 1.5:
                continue

            # z > 1.5: ratio too high → short BTC, long ETH (expect ratio to drop)
            # z < -1.5: ratio too low → long BTC, short ETH
            entry_ratio = ratio_vals[i]

            for k in range(2, min(48, n_pairs-i)):
                exit_ratio = ratio_vals[i+k]
                if z > 0:
                    pnl = (entry_ratio - exit_ratio) / entry_ratio * 100
                else:
                    pnl = (exit_ratio - entry_ratio) / entry_ratio * 100

                if pnl >= 2.0:
                    pnls_pairs.append(pnl - 0.4)  # 2-leg fees
                    break
                if pnl <= -3.0:
                    pnls_pairs.append(-3.0 - 0.4)
                    break
            else:
                exit_ratio = ratio_vals[min(i+47, n_pairs-1)]
                pnl = ((entry_ratio-exit_ratio)/entry_ratio*100 if z > 0 else (exit_ratio-entry_ratio)/entry_ratio*100) - 0.4
                pnls_pairs.append(pnl)

        m = calc_metrics(pnls_pairs)
        print(f"    BTC/ETH: PF={m['pf']:.2f} WR={m['wr']:.1f}% T={m['trades']} Sharpe={m['sharpe']:.2f}")
        results.append({"strategy": "pairs-btceth", "coin": "BTC/ETH", **m})

    engine.save("L6_new_strategies", results)
    return results


# ============================================================
# RESEARCH 4: 기존 전략 깊이 파기 (최근 30일 실패 원인)
# ============================================================
def research_recent_failure(engine):
    print("\n" + "="*70)
    print("RESEARCH 4: 최근 30일 ATR SHORT 실패 원인 분석")
    print("="*70)

    engine.precompute(["atr-breakout"])
    strategy, _, _ = get_strategy("atr-breakout")

    start_30d = datetime.now() - timedelta(days=30)
    results = []

    # 코인별 최근 30일 성과
    print("  코인별 최근 30일 ATR SHORT:")
    coin_results = []
    for sym, df_ind in engine.indicator_cache["atr-breakout"]:
        df = df_ind[df_ind["timestamp"] >= pd.Timestamp(start_30d)]
        if len(df) < 50:
            continue
        r = run_fast(df, strategy, sym, sl_pct=0.07, tp_pct=0.07, max_bars=48,
                    fee_pct=COST_MODEL["fee_pct"], slippage_pct=COST_MODEL["slippage_pct"],
                    direction="short", market_type="futures", strategy_id="atr-breakout",
                    funding_rate_8h=COST_MODEL["funding_rate_8h"])
        pnls = [t.pnl_pct for t in r.trades]
        m = calc_metrics(pnls)
        coin_results.append({"coin": sym, **m})

    # 수익 코인 vs 손실 코인
    profitable = [c for c in coin_results if c["pf"] > 1.0 and c["trades"] >= 3]
    losing = [c for c in coin_results if c["pf"] <= 1.0 and c["trades"] >= 3]

    print(f"    수익 코인: {len(profitable)}/{len(coin_results)}")
    print(f"    손실 코인: {len(losing)}/{len(coin_results)}")

    if profitable:
        profitable.sort(key=lambda x: x["pf"], reverse=True)
        print(f"    Top 5 수익:")
        for c in profitable[:5]:
            print(f"      {c['coin']:12s}: PF={c['pf']:.2f} WR={c['wr']:.1f}% T={c['trades']}")

    if losing:
        losing.sort(key=lambda x: x["pf"])
        print(f"    Top 5 손실:")
        for c in losing[:5]:
            print(f"      {c['coin']:12s}: PF={c['pf']:.2f} WR={c['wr']:.1f}% T={c['trades']}")

    engine.save("L6_recent_failure", coin_results)

    # 최근 30일에서 어떤 전략이 살아남는지
    print(f"\n  최근 30일 전체 전략 비교:")
    engine.precompute(list(engine.indicator_cache.keys()) + ["supertrend", "donchian-breakout", "keltner-squeeze", "mean-reversion"])

    all_strats = [
        ("atr-breakout", "short"), ("bb-squeeze-short", "short"),
        ("ichimoku", "short"), ("ma-cross", "short"),
        ("supertrend", "short"), ("donchian-breakout", "short"),
        ("keltner-squeeze", "short"), ("mean-reversion", "short"),
        ("mean-reversion", "long"),
    ]

    recent_results = []
    for sid, direction in all_strats:
        pnls = engine.simulate(sid, direction, start_date=start_30d)
        m = calc_metrics(pnls)
        mark = "★" if m["pf"] > 1.2 else ("✓" if m["pf"] > 1.0 else "✗")
        print(f"    {sid:25s} {direction:6s}: PF={m['pf']:.2f} WR={m['wr']:.1f}% T={m['trades']} {mark}")
        recent_results.append({"strategy": f"{sid}({direction})", "period": "30d", **m})

    engine.save("L6_recent_all_strategies", recent_results)
    return recent_results


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    start = time.time()
    print(f"LEVEL 6: External Data + New Strategies — {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    engine = ResearchEngine(top_n=30)

    r1 = research_oi(engine)
    r2 = research_fear_greed(engine)
    r3 = research_new_strategies(engine)
    r4 = research_recent_failure(engine)

    elapsed = time.time() - start
    print(f"\n{'='*70}")
    print(f"COMPLETE in {elapsed:.0f}s ({elapsed/60:.1f}m)")
    print(f"Results: {OUT_DIR}")
