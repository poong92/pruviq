"""
SuperTrend Strategy

ATR 기반 동적 지지/저항선(SuperTrend)을 이용한 추세 추종 전략.

SuperTrend 계산:
  Basic Upper = (high + low) / 2 + multiplier * ATR
  Basic Lower = (high + low) / 2 - multiplier * ATR
  SuperTrend: 추세에 따라 upper/lower 중 하나로 결정

진입 조건:
- LONG: close가 SuperTrend line 위로 전환 (하락 → 상승 전환)
- SHORT: close가 SuperTrend line 아래로 전환 (상승 → 하락 전환)

진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class SuperTrendStrategy:
    """SuperTrend 전략"""

    name = "SuperTrend"

    def __init__(
        self,
        atr_period: int = 10,
        multiplier: float = 3.0,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.atr_period = atr_period
        self.multiplier = multiplier
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "atr_period": self.atr_period,
            "multiplier": self.multiplier,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """SuperTrend 계산"""
        high = df["high"]
        low = df["low"]
        close = df["close"]

        # ATR (Wilder's smoothing)
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs(),
        ], axis=1).max(axis=1)
        atr = tr.ewm(com=self.atr_period - 1, min_periods=self.atr_period).mean()

        # Basic bands
        hl2 = (high + low) / 2
        basic_upper = hl2 + self.multiplier * atr
        basic_lower = hl2 - self.multiplier * atr

        # SuperTrend 계산 (pandas loop 불가피 — 순차 의존성)
        n = len(df)
        supertrend = np.full(n, np.nan)
        direction = np.zeros(n, dtype=int)  # 1 = bullish, -1 = bearish

        final_upper = basic_upper.values.copy()
        final_lower = basic_lower.values.copy()
        close_arr = close.values
        atr_arr = atr.values

        for i in range(1, n):
            if np.isnan(atr_arr[i]):
                continue

            # Final upper band: 이전보다 작거나 이전 close가 이전 upper 이상이면 리셋
            if i > 0 and not np.isnan(final_upper[i - 1]):
                if basic_upper.values[i] < final_upper[i - 1] or close_arr[i - 1] > final_upper[i - 1]:
                    final_upper[i] = basic_upper.values[i]
                else:
                    final_upper[i] = final_upper[i - 1]
            else:
                final_upper[i] = basic_upper.values[i]

            # Final lower band: 이전보다 크거나 이전 close가 이전 lower 이하이면 리셋
            if i > 0 and not np.isnan(final_lower[i - 1]):
                if basic_lower.values[i] > final_lower[i - 1] or close_arr[i - 1] < final_lower[i - 1]:
                    final_lower[i] = basic_lower.values[i]
                else:
                    final_lower[i] = final_lower[i - 1]
            else:
                final_lower[i] = basic_lower.values[i]

            # Direction
            if i > 0 and not np.isnan(supertrend[i - 1]):
                prev_dir = direction[i - 1]
                if prev_dir == -1:  # 이전이 bearish
                    if close_arr[i] > final_upper[i]:
                        direction[i] = 1  # 전환: bullish
                        supertrend[i] = final_lower[i]
                    else:
                        direction[i] = -1
                        supertrend[i] = final_upper[i]
                else:  # 이전이 bullish
                    if close_arr[i] < final_lower[i]:
                        direction[i] = -1  # 전환: bearish
                        supertrend[i] = final_upper[i]
                    else:
                        direction[i] = 1
                        supertrend[i] = final_lower[i]
            else:
                # 초기값: close와 비교
                if close_arr[i] > final_upper[i]:
                    direction[i] = 1
                    supertrend[i] = final_lower[i]
                else:
                    direction[i] = -1
                    supertrend[i] = final_upper[i]

        df["supertrend"] = supertrend
        df["supertrend_dir"] = direction  # 1=bullish, -1=bearish
        # 전환 감지
        prev_dir = pd.Series(direction).shift(1)
        df["st_cross_up"] = (prev_dir == -1) & (pd.Series(direction) == 1)   # 하락→상승 전환
        df["st_cross_down"] = (prev_dir == 1) & (pd.Series(direction) == -1)  # 상승→하락 전환

        # Hour (UTC)
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"])
            df["hour"] = ts.dt.hour
        else:
            df["hour"] = 0

        return df

    def check_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """
        시그널 확인.
        idx = 시그널 캔들 (완성). 진입은 idx+1 open.
        """
        min_idx = self.atr_period * 2
        if idx < min_idx:
            return None
        if idx + 1 >= len(df):
            return None

        # 시간 필터 (entry bar 기준)
        if self.avoid_hours:
            next_hour = df.iloc[idx + 1].get("hour", 0)
            if next_hour in self.avoid_hours:
                return None

        curr = df.iloc[idx]
        st = curr.get("supertrend", np.nan)
        cross_up = curr.get("st_cross_up", False)
        cross_down = curr.get("st_cross_down", False)

        if pd.isna(st):
            return None

        # LONG: SuperTrend 상향 전환
        if cross_up:
            return "long"

        # SHORT: SuperTrend 하향 전환
        if cross_down:
            return "short"

        return None
