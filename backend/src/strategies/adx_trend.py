"""
ADX Trend Strategy

ADX(Average Directional Index) + DMI(Directional Movement Index) 조합으로
강한 추세 발생 시 방향성 진입하는 전략.

진입 조건:
- LONG: ADX > threshold (강한 추세) AND +DI > -DI AND +DI가 -DI 위로 교차
- SHORT: ADX > threshold AND -DI > +DI AND -DI가 +DI 위로 교차

교차 감지: prev bar에서 di_plus < di_minus, curr bar에서 di_plus > di_minus (LONG).
진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class ADXTrendStrategy:
    """ADX Trend 전략"""

    name = "ADX Trend"

    def __init__(
        self,
        adx_period: int = 14,
        adx_threshold: float = 25.0,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.adx_period = adx_period
        self.adx_threshold = adx_threshold
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "adx_period": self.adx_period,
            "adx_threshold": self.adx_threshold,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """ADX + DMI 계산"""
        high = df["high"]
        low = df["low"]
        close = df["close"]
        n = len(df)

        # True Range
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs(),
        ], axis=1).max(axis=1)

        # Directional Movement
        up_move = high - high.shift(1)
        down_move = low.shift(1) - low

        # +DM: up_move > down_move AND up_move > 0
        plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
        # -DM: down_move > up_move AND down_move > 0
        minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

        plus_dm_s = pd.Series(plus_dm, index=df.index)
        minus_dm_s = pd.Series(minus_dm, index=df.index)

        # Wilder's smoothing (EMA with com = period - 1)
        atr_smooth = tr.ewm(com=self.adx_period - 1, min_periods=self.adx_period).mean()
        plus_dm_smooth = plus_dm_s.ewm(com=self.adx_period - 1, min_periods=self.adx_period).mean()
        minus_dm_smooth = minus_dm_s.ewm(com=self.adx_period - 1, min_periods=self.adx_period).mean()

        # +DI and -DI
        di_plus = (plus_dm_smooth / atr_smooth.replace(0, np.nan)) * 100
        di_minus = (minus_dm_smooth / atr_smooth.replace(0, np.nan)) * 100

        # DX
        di_diff = (di_plus - di_minus).abs()
        di_sum = (di_plus + di_minus).replace(0, np.nan)
        dx = (di_diff / di_sum) * 100

        # ADX = smoothed DX
        adx = dx.ewm(com=self.adx_period - 1, min_periods=self.adx_period).mean()

        df["adx"] = adx
        df["di_plus"] = di_plus
        df["di_minus"] = di_minus

        # 교차 감지 (shift(1) = prev bar)
        prev_di_plus = di_plus.shift(1)
        prev_di_minus = di_minus.shift(1)

        # +DI crosses above -DI (LONG signal)
        df["di_cross_up"] = (prev_di_plus < prev_di_minus) & (di_plus > di_minus)
        # -DI crosses above +DI (SHORT signal)
        df["di_cross_down"] = (prev_di_plus > prev_di_minus) & (di_plus < di_minus)

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
        min_idx = self.adx_period * 3
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
        adx = curr.get("adx", np.nan)
        di_plus = curr.get("di_plus", np.nan)
        di_minus = curr.get("di_minus", np.nan)
        cross_up = curr.get("di_cross_up", False)
        cross_down = curr.get("di_cross_down", False)

        if any(pd.isna(v) for v in [adx, di_plus, di_minus]):
            return None

        strong_trend = adx > self.adx_threshold

        # LONG: 강한 추세 + +DI > -DI + +DI 교차 상향
        if strong_trend and di_plus > di_minus and cross_up:
            return "long"

        # SHORT: 강한 추세 + -DI > +DI + -DI 교차 상향
        if strong_trend and di_minus > di_plus and cross_down:
            return "short"

        return None
