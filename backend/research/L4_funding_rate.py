#!/usr/bin/env python3
"""
LEVEL 4: 펀딩레이트 시그널 검증

외부 데이터 없이도 할 수 있는 것:
- 바이낸스 API에서 히스토리컬 펀딩레이트 수집
- 펀딩레이트 극단값 → 방향 시그널로 사용
- 기존 전략의 필터로 적용

검증 질문:
1. 펀딩레이트를 지금 수집할 수 있는가?
2. 극단 펀딩(>0.05%) 시 반대 방향 진입이 수익적인가?
3. 기존 SHORT 전략에 "펀딩레이트 양수일 때만" 필터 적용하면?
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).parent.parent))
from research.framework import ResearchEngine, calc_metrics, COST_MODEL


def fetch_funding_history(symbol="BTCUSDT", limit=1000):
    """Fetch historical funding rates from Binance Futures API."""
    url = "https://fapi.binance.com/fapi/v1/fundingRate"
    all_rates = []
    end_time = None

    for _ in range(5):  # max 5 pages = 5000 records
        params = {"symbol": symbol, "limit": limit}
        if end_time:
            params["endTime"] = end_time

        try:
            r = requests.get(url, params=params, timeout=10)
            if r.status_code != 200:
                print(f"  API error: {r.status_code}")
                break
            data = r.json()
            if not data:
                break

            all_rates.extend(data)
            end_time = data[0]["fundingTime"] - 1  # go backward
            if len(data) < limit:
                break
        except Exception as e:
            print(f"  Fetch error: {e}")
            break

    if not all_rates:
        return None

    df = pd.DataFrame(all_rates)
    df["fundingTime"] = pd.to_datetime(df["fundingTime"], unit="ms")
    df["fundingRate"] = df["fundingRate"].astype(float)
    df = df.sort_values("fundingTime").reset_index(drop=True)

    return df


def run():
    engine = ResearchEngine(top_n=30)

    print("\n" + "="*70)
    print("LEVEL 4: 펀딩레이트 시그널")
    print("="*70)

    # ============================================================
    # STEP 1: 펀딩레이트 데이터 수집
    # ============================================================
    print("\n  STEP 1: BTC 펀딩레이트 수집")

    cache_path = engine._results_dir / "btc_funding_rates.csv"
    if cache_path.exists():
        print(f"    캐시 사용: {cache_path}")
        funding_df = pd.read_csv(cache_path)
        funding_df["fundingTime"] = pd.to_datetime(funding_df["fundingTime"])
    else:
        funding_df = fetch_funding_history("BTCUSDT")
        if funding_df is None:
            print("    펀딩레이트 수집 실패!")
            return
        funding_df.to_csv(cache_path, index=False)
        print(f"    저장: {cache_path} ({len(funding_df)} records)")

    rates = funding_df["fundingRate"].values
    print(f"    Records: {len(funding_df)}")
    print(f"    Range: {funding_df['fundingTime'].iloc[0]} ~ {funding_df['fundingTime'].iloc[-1]}")
    print(f"    Mean: {np.mean(rates)*100:.4f}%")
    print(f"    Std:  {np.std(rates)*100:.4f}%")
    print(f"    Min:  {np.min(rates)*100:.4f}%")
    print(f"    Max:  {np.max(rates)*100:.4f}%")

    # 극단값 분포
    high_pos = (rates > 0.0005).sum()  # > 0.05%
    high_neg = (rates < -0.0005).sum()  # < -0.05%
    extreme_pos = (rates > 0.001).sum()  # > 0.1%
    extreme_neg = (rates < -0.001).sum()  # < -0.1%

    print(f"\n    극단값 분포:")
    print(f"      > +0.05%:  {high_pos} times ({high_pos/len(rates)*100:.1f}%)")
    print(f"      < -0.05%:  {high_neg} times ({high_neg/len(rates)*100:.1f}%)")
    print(f"      > +0.1%:   {extreme_pos} times ({extreme_pos/len(rates)*100:.1f}%)")
    print(f"      < -0.1%:   {extreme_neg} times ({extreme_neg/len(rates)*100:.1f}%)")

    # ============================================================
    # STEP 2: 펀딩레이트 → 다음 8h 가격 변동 예측력
    # ============================================================
    print(f"\n  STEP 2: 펀딩레이트 → 가격 변동 예측력")

    btc = engine.get_btc()
    if btc is None:
        print("    No BTC data!")
        return

    # Merge funding with OHLCV
    btc_hourly = btc.set_index("timestamp")

    results = []
    for _, row in funding_df.iterrows():
        ft = row["fundingTime"]
        fr = row["fundingRate"]

        # Find BTC close at funding time and 8h later
        mask_now = (btc["timestamp"] >= ft - timedelta(hours=1)) & (btc["timestamp"] <= ft)
        mask_8h = (btc["timestamp"] >= ft + timedelta(hours=7)) & (btc["timestamp"] <= ft + timedelta(hours=9))

        d_now = btc[mask_now]
        d_8h = btc[mask_8h]

        if len(d_now) > 0 and len(d_8h) > 0:
            price_now = d_now["close"].iloc[-1]
            price_8h = d_8h["close"].iloc[0]
            ret_8h = (price_8h / price_now - 1) * 100

            results.append({
                "time": ft.strftime("%Y-%m-%d %H:%M"),
                "funding_rate": round(fr * 100, 4),
                "price_now": round(price_now, 2),
                "price_8h": round(price_8h, 2),
                "return_8h": round(ret_8h, 2),
            })

    if not results:
        print("    No matched data!")
        return

    engine.save("L4_funding_returns", results)

    # Analyze: 극단 펀딩 시 반대 방향 수익?
    df_merged = pd.DataFrame(results)
    print(f"\n    Matched records: {len(df_merged)}")

    for threshold_name, low, high in [
        ("all", -999, 999),
        ("neutral (-0.01~+0.01)", -0.01, 0.01),
        ("positive (>+0.01)", 0.01, 999),
        ("negative (<-0.01)", -999, -0.01),
        ("high_pos (>+0.05)", 0.05, 999),
        ("high_neg (<-0.05)", -999, -0.05),
        ("extreme_pos (>+0.1)", 0.1, 999),
        ("extreme_neg (<-0.1)", -999, -0.1),
    ]:
        mask = (df_merged["funding_rate"] > low) & (df_merged["funding_rate"] <= high)
        subset = df_merged[mask]
        if len(subset) < 5:
            continue

        avg_ret = subset["return_8h"].mean()
        pos_pct = (subset["return_8h"] > 0).sum() / len(subset) * 100

        # 반대 방향 (양수 펀딩 → 매도, 음수 펀딩 → 매수)
        if "pos" in threshold_name:
            contrary_ret = -avg_ret  # short when funding positive
        elif "neg" in threshold_name:
            contrary_ret = avg_ret  # long when funding negative
        else:
            contrary_ret = 0

        mark = "★" if abs(contrary_ret) > 0.1 else ""
        print(f"      {threshold_name:30s}: N={len(subset):4d} avg_ret={avg_ret:+.3f}% up={pos_pct:.0f}% contrary_edge={contrary_ret:+.3f}% {mark}")

    # ============================================================
    # STEP 3: 펀딩레이트 필터 + 기존 전략
    # ============================================================
    print(f"\n  STEP 3: 펀딩레이트 필터 적용 (SHORT 전략)")

    engine.precompute(["atr-breakout", "bb-squeeze-short"])

    # Create funding rate lookup by date
    funding_daily = {}
    for _, row in funding_df.iterrows():
        day = row["fundingTime"].strftime("%Y-%m-%d")
        if day not in funding_daily:
            funding_daily[day] = []
        funding_daily[day].append(row["fundingRate"])

    funding_daily_avg = {day: np.mean(rates_list) for day, rates_list in funding_daily.items()}

    for sid in ["atr-breakout", "bb-squeeze-short"]:
        print(f"\n    {sid} SHORT:")

        # Base: no filter
        pnls_base = engine.simulate(sid, "short", start_date=datetime.now() - timedelta(days=365))

        # Filtered: only when daily avg funding > 0 (longs paying shorts = short bias)
        from src.strategies.registry import get_strategy
        from src.simulation.engine_fast import run_fast
        strategy, _, _ = get_strategy(sid)

        pnls_filtered = []
        for sym, df_ind in engine.indicator_cache[sid]:
            df = df_ind[df_ind["timestamp"] >= pd.Timestamp(datetime.now() - timedelta(days=365))]
            if len(df) < 50:
                continue

            result = run_fast(
                df, strategy, sym, sl_pct=0.07, tp_pct=0.07, max_bars=48,
                fee_pct=COST_MODEL["fee_pct"], slippage_pct=COST_MODEL["slippage_pct"],
                direction="short", market_type="futures", strategy_id=sid,
                funding_rate_8h=COST_MODEL["funding_rate_8h"],
            )

            for t in result.trades:
                # Check if funding was positive on trade entry date
                entry_day = str(t.entry_time)[:10]
                daily_fr = funding_daily_avg.get(entry_day, 0)
                if daily_fr > 0:  # positive funding = short favorable
                    pnls_filtered.append(t.pnl_pct)

        m_base = calc_metrics(pnls_base)
        m_filtered = calc_metrics(pnls_filtered)

        print(f"      Base:     PF={m_base['pf']:.2f} WR={m_base['wr']:.1f}% T={m_base['trades']} Sharpe={m_base['sharpe']:.2f}")
        print(f"      +FundFilt: PF={m_filtered['pf']:.2f} WR={m_filtered['wr']:.1f}% T={m_filtered['trades']} Sharpe={m_filtered['sharpe']:.2f}")
        diff = m_filtered["pf"] - m_base["pf"]
        print(f"      Δ PF: {diff:+.2f} {'↑ IMPROVED' if diff > 0.05 else '= SAME' if abs(diff) <= 0.05 else '↓ WORSE'}")


if __name__ == "__main__":
    run()
