#!/usr/bin/env python3
"""
LEVEL 0-A: 데이터 무결성 검증

엔진 수학 검증(L0) 아래에 있는 가장 기초.
데이터가 오염되면 그 위의 모든 결론이 무효.

검증 항목:
1. 결측값 (NaN, 0, missing timestamps)
2. 이상치 (1시간에 ±50% 가격 변동)
3. 시간 연속성 (1H 간격 빠짐)
4. OHLC 논리 (high >= open,close >= low)
5. 볼륨 이상 (0 볼륨 캔들)
6. 데이터 범위 (시작일~종료일)
7. 코인 간 시간 정렬
"""

import sys
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from research.framework import ResearchEngine


def run():
    engine = ResearchEngine(top_n=50, verbose=False)

    print("="*70)
    print("LEVEL 0-A: 데이터 무결성 검증")
    print(f"코인: {len(engine.coins)}개, 데이터: {engine.data_dir}")
    print("="*70)

    issues = []
    coin_stats = []

    for sym, df in engine.coins:
        n = len(df)
        problems = []

        # 1. 결측값
        nan_count = df[["open", "high", "low", "close", "volume"]].isna().sum().sum()
        if nan_count > 0:
            problems.append(f"NaN: {nan_count}")

        zero_close = (df["close"] == 0).sum()
        if zero_close > 0:
            problems.append(f"zero_close: {zero_close}")

        # 2. 이상치 (1H에 ±30% 이상)
        returns = df["close"].pct_change().dropna()
        extreme = (returns.abs() > 0.30).sum()
        if extreme > 0:
            max_ret = returns.abs().max() * 100
            problems.append(f"extreme_moves: {extreme} (max {max_ret:.1f}%)")

        # 3. 시간 연속성
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"])
            diffs = ts.diff().dropna()
            expected_gap = pd.Timedelta(hours=1)

            gaps = diffs[diffs > expected_gap * 1.5]
            if len(gaps) > 0:
                max_gap_hours = gaps.max().total_seconds() / 3600
                problems.append(f"time_gaps: {len(gaps)} (max {max_gap_hours:.0f}h)")

            # 중복 타임스탬프
            duplicates = ts.duplicated().sum()
            if duplicates > 0:
                problems.append(f"dup_timestamps: {duplicates}")

            date_range = f"{ts.iloc[0].strftime('%Y-%m-%d')} ~ {ts.iloc[-1].strftime('%Y-%m-%d')}"
        else:
            date_range = "no_timestamp"
            problems.append("no_timestamp_column")

        # 4. OHLC 논리
        ohlc_violation = (
            (df["high"] < df["open"]) | (df["high"] < df["close"]) |
            (df["low"] > df["open"]) | (df["low"] > df["close"]) |
            (df["high"] < df["low"])
        ).sum()
        if ohlc_violation > 0:
            problems.append(f"ohlc_violation: {ohlc_violation}")

        # 5. 볼륨
        zero_vol = (df["volume"] == 0).sum()
        if zero_vol > n * 0.01:  # >1%면 문제
            problems.append(f"zero_volume: {zero_vol} ({zero_vol/n*100:.1f}%)")

        # 6. 가격 범위 합리성
        price_range = df["close"].max() / df["close"].min() if df["close"].min() > 0 else 0
        if price_range > 1000:
            problems.append(f"extreme_range: {price_range:.0f}x")

        stat = {
            "coin": sym,
            "candles": n,
            "range": date_range,
            "nan": nan_count,
            "extreme_moves": extreme,
            "time_gaps": len(gaps) if "timestamp" in df.columns else -1,
            "ohlc_violations": ohlc_violation,
            "zero_volume_pct": round(zero_vol / n * 100, 1),
            "price_range_x": round(price_range, 1),
            "status": "CLEAN" if not problems else "ISSUES",
            "issues": "; ".join(problems) if problems else "",
        }
        coin_stats.append(stat)

        if problems:
            issues.append((sym, problems))

    engine.save("L0A_data_integrity", coin_stats)

    # Summary
    clean = sum(1 for s in coin_stats if s["status"] == "CLEAN")
    total = len(coin_stats)
    print(f"\n  CLEAN: {clean}/{total} coins")

    if issues:
        print(f"  ISSUES: {len(issues)} coins")
        for sym, probs in issues[:15]:
            print(f"    {sym:15s}: {', '.join(probs)}")
        if len(issues) > 15:
            print(f"    ... and {len(issues) - 15} more")

    # 전체 통계
    all_candles = sum(s["candles"] for s in coin_stats)
    all_nan = sum(s["nan"] for s in coin_stats)
    all_extreme = sum(s["extreme_moves"] for s in coin_stats)
    all_gaps = sum(s["time_gaps"] for s in coin_stats if s["time_gaps"] >= 0)
    all_ohlc = sum(s["ohlc_violations"] for s in coin_stats)

    print(f"\n  전체 통계:")
    print(f"    총 캔들: {all_candles:,}")
    print(f"    NaN: {all_nan} ({all_nan/all_candles*100:.3f}%)")
    print(f"    극단 변동(±30%): {all_extreme}")
    print(f"    시간 갭: {all_gaps}")
    print(f"    OHLC 위반: {all_ohlc}")

    # 날짜 범위 일관성
    if "timestamp" in engine.coins[0][1].columns:
        starts = [pd.to_datetime(df["timestamp"]).iloc[0] for _, df in engine.coins]
        ends = [pd.to_datetime(df["timestamp"]).iloc[-1] for _, df in engine.coins]
        print(f"\n  날짜 범위:")
        print(f"    가장 빠른 시작: {min(starts)}")
        print(f"    가장 늦은 시작: {max(starts)}")
        print(f"    가장 빠른 종료: {min(ends)}")
        print(f"    가장 늦은 종료: {max(ends)}")
        print(f"    공통 범위: {max(starts)} ~ {min(ends)}")

    overall = "PASS" if clean >= total * 0.9 and all_ohlc == 0 and all_nan == 0 else "WARN" if all_ohlc == 0 else "FAIL"
    print(f"\n  LEVEL 0-A: {overall}")
    return overall


if __name__ == "__main__":
    run()
