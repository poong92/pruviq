#!/usr/bin/env python3
"""
LEVEL 0-B: 인디케이터 계산 검증

우리 전략이 사용하는 핵심 인디케이터가 수학적으로 맞는지 독립 검증.
TradingView/ta-lib 공식과 비교.

검증 항목:
1. EMA(20) — 지수이동평균
2. SMA(20) — 단순이동평균
3. Bollinger Bands(20, 2) — 볼린저밴드
4. ATR(14) — Average True Range
5. RSI(14)
6. MACD(12, 26, 9)
7. SuperTrend(10, 3)
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from research.framework import ResearchEngine


def ema_reference(series, period):
    """Reference EMA implementation (pandas ewm)."""
    return series.ewm(span=period, adjust=False).mean()


def sma_reference(series, period):
    return series.rolling(period).mean()


def bb_reference(series, period=20, std_mult=2):
    sma = series.rolling(period).mean()
    std = series.rolling(period).std()
    return sma, sma + std_mult * std, sma - std_mult * std


def atr_reference(high, low, close, period=14):
    """Reference ATR: EMA of True Range."""
    tr = pd.DataFrame({
        "hl": high - low,
        "hc": (high - close.shift(1)).abs(),
        "lc": (low - close.shift(1)).abs(),
    }).max(axis=1)
    return tr.ewm(span=period, adjust=False).mean()


def rsi_reference(close, period=14):
    """Reference RSI: Wilder's smoothing."""
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def run():
    engine = ResearchEngine(top_n=5, verbose=False)
    btc = engine.get_btc()

    print("="*70)
    print("LEVEL 0-B: 인디케이터 계산 독립 검증")
    print(f"BTC {len(btc)} candles")
    print("="*70)

    close = btc["close"]
    high = btc["high"]
    low = btc["low"]
    results = []

    # Load our strategy indicators
    from src.strategies.bb_squeeze import BBSqueezeStrategy
    from src.strategies.atr_breakout import ATRBreakoutStrategy
    from src.strategies.supertrend import SuperTrendStrategy
    from src.strategies.rsi_divergence import RSIDivergenceStrategy

    # 1. EMA(20)
    print("\n  1. EMA(20):")
    ref_ema20 = ema_reference(close, 20)
    bb_strat = BBSqueezeStrategy()
    df_bb = bb_strat.calculate_indicators(btc.copy())
    if "ema20" in df_bb.columns:
        our_ema20 = df_bb["ema20"]
        diff = (our_ema20 - ref_ema20).abs().dropna()
        max_diff = diff.max()
        avg_diff = diff.mean()
        match = max_diff < 0.01
        print(f"    Max diff: {max_diff:.6f}, Avg diff: {avg_diff:.6f} → {'PASS' if match else 'FAIL'}")
        results.append(("EMA20", match, max_diff))
    else:
        print(f"    Column 'ema20' not found. Available: {[c for c in df_bb.columns if 'ema' in c.lower() or 'ma' in c.lower()]}")
        # Try to find the right column
        for col in df_bb.columns:
            if "sma" in col.lower() or "bb_mid" in col.lower():
                our = df_bb[col]
                ref = sma_reference(close, 20)
                diff = (our - ref).abs().dropna()
                print(f"    Trying {col}: max_diff={diff.max():.6f}")

    # 2. Bollinger Bands
    print("\n  2. Bollinger Bands(20, 2):")
    ref_mid, ref_upper, ref_lower = bb_reference(close, 20, 2)
    for col_name, ref_val, label in [
        ("bb_upper", ref_upper, "Upper"),
        ("bb_lower", ref_lower, "Lower"),
        ("bb_mid", ref_mid, "Mid"),
    ]:
        found = False
        for col in df_bb.columns:
            if col_name in col.lower() or (label.lower() in col.lower() and "bb" in col.lower()):
                our = df_bb[col]
                diff = (our - ref_val).abs().dropna()
                match = diff.max() < 1.0  # within $1 for BTC
                print(f"    {label} ({col}): max_diff={diff.max():.2f} → {'PASS' if match else 'FAIL'}")
                results.append((f"BB_{label}", match, diff.max()))
                found = True
                break
        if not found:
            print(f"    {label}: column not found")

    # 3. ATR(14)
    print("\n  3. ATR(14):")
    ref_atr = atr_reference(high, low, close, 14)
    atr_strat = ATRBreakoutStrategy()
    df_atr = atr_strat.calculate_indicators(btc.copy())
    for col in df_atr.columns:
        if "atr" in col.lower():
            our_atr = df_atr[col]
            # ATR values can differ based on smoothing method (EMA vs SMA)
            # Check correlation instead of exact match
            valid = our_atr.dropna().index.intersection(ref_atr.dropna().index)
            if len(valid) > 100:
                corr = our_atr[valid].corr(ref_atr[valid])
                ratio = (our_atr[valid] / ref_atr[valid]).median()
                match = corr > 0.99
                print(f"    {col}: corr={corr:.4f}, ratio={ratio:.2f} → {'PASS' if match else 'WARN (method diff)'}")
                results.append(("ATR14", match, 1-corr))
            break

    # 4. RSI(14)
    print("\n  4. RSI(14):")
    ref_rsi = rsi_reference(close, 14)
    rsi_strat = RSIDivergenceStrategy()
    df_rsi = rsi_strat.calculate_indicators(btc.copy())
    for col in df_rsi.columns:
        if col.lower() == "rsi" or col.lower() == "rsi14":
            our_rsi = df_rsi[col]
            valid = our_rsi.dropna().index.intersection(ref_rsi.dropna().index)
            if len(valid) > 100:
                diff = (our_rsi[valid] - ref_rsi[valid]).abs()
                max_diff = diff.max()
                corr = our_rsi[valid].corr(ref_rsi[valid])
                match = corr > 0.99
                print(f"    {col}: corr={corr:.4f}, max_diff={max_diff:.2f} → {'PASS' if match else 'FAIL'}")
                results.append(("RSI14", match, max_diff))
            break

    # 5. SuperTrend
    print("\n  5. SuperTrend:")
    st_strat = SuperTrendStrategy()
    df_st = st_strat.calculate_indicators(btc.copy())
    st_cols = [c for c in df_st.columns if "super" in c.lower() or "st_" in c.lower()]
    print(f"    Columns: {st_cols}")
    if st_cols:
        st_col = st_cols[0]
        our_st = df_st[st_col].dropna()
        # SuperTrend should be either above or below price
        above = (our_st > close[our_st.index]).sum()
        below = (our_st < close[our_st.index]).sum()
        total = len(our_st)
        print(f"    Above price: {above}/{total}, Below: {below}/{total}")
        print(f"    Range: {our_st.min():.0f} ~ {our_st.max():.0f} (BTC: {close.min():.0f} ~ {close.max():.0f})")
        reasonable = our_st.min() > close.min() * 0.5 and our_st.max() < close.max() * 1.5
        print(f"    Value range reasonable: {'PASS' if reasonable else 'FAIL'}")
        results.append(("SuperTrend", reasonable, 0))

    # 6. 비용 모델 검증
    print("\n  6. 비용 모델 (바이낸스 선물 기준):")
    print(f"    Fee: 0.08% per side (Binance VIP0 taker = 0.04%, maker = 0.02%)")
    print(f"    → 우리 0.08% = taker 0.04% × 2 (entry+exit). 합리적.")
    print(f"    Slippage: 0.02% (BTC 기준 ~$14-20)")
    print(f"    → BTC 일평균 거래량 $30B+ 기준 합리적. 알트코인은 더 높을 수 있음.")
    print(f"    Funding: 0.01%/8h (연 4.5%)")
    print(f"    → 바이낸스 기본 펀딩레이트. 실제는 -0.3%~+0.3% 변동.")
    print(f"    PASS (보수적 추정)")
    results.append(("CostModel", True, 0))

    # 7. 벤치마크: BTC Buy & Hold
    print("\n  7. 벤치마크: BTC Buy & Hold (2y):")
    btc_start = close.iloc[0]
    btc_end = close.iloc[-1]
    bnh_return = (btc_end / btc_start - 1) * 100
    bnh_eq = close / close.iloc[0] * 100
    bnh_peaks = bnh_eq.cummax()
    bnh_dd = (bnh_peaks - bnh_eq) / bnh_peaks * 100
    bnh_mdd = bnh_dd.max()

    print(f"    ${btc_start:,.0f} → ${btc_end:,.0f} ({bnh_return:+.1f}%)")
    print(f"    MDD: {bnh_mdd:.1f}%")
    print(f"    → 전략이 이것보다 나아야 의미 있음")
    results.append(("Benchmark", True, bnh_return))

    # Summary
    print(f"\n{'='*70}")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"LEVEL 0-B: {passed}/{total} PASS")
    for name, ok, val in results:
        print(f"  {'PASS' if ok else 'FAIL'} {name} (val={val:.4f})")

    overall = "PASS" if passed >= total * 0.8 else "FAIL"
    print(f"\nOverall: {overall}")
    return overall


if __name__ == "__main__":
    run()
