"""
MA Cross Strategy (Golden Cross / Death Cross)

이동평균 교차 전략 — 가장 널리 알려진 추세 추종 전략.

진입 조건:
- LONG: fast EMA가 slow EMA 위로 교차 (Golden Cross)
- SHORT: fast EMA가 slow EMA 아래로 교차 (Death Cross)

교차 감지: prev bar에서 fast < slow, curr bar에서 fast > slow (골든).
진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class MACrossStrategy:
    """MA Cross 전략"""

    name = "MA Cross"

    def __init__(
        self,
        fast_period: int = 50,
        slow_period: int = 200,
        use_ema: bool = True,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.use_ema = use_ema
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "fast_period": self.fast_period,
            "slow_period": self.slow_period,
            "use_ema": self.use_ema,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """이동평균 계산 + 교차 감지"""
        close = df["close"]

        if self.use_ema:
            fast_ma = close.ewm(span=self.fast_period, min_periods=self.fast_period).mean()
            slow_ma = close.ewm(span=self.slow_period, min_periods=self.slow_period).mean()
        else:
            fast_ma = close.rolling(self.fast_period, min_periods=self.fast_period).mean()
            slow_ma = close.rolling(self.slow_period, min_periods=self.slow_period).mean()

        df["ma_fast"] = fast_ma
        df["ma_slow"] = slow_ma

        # 교차 감지 (shift(1) = prev bar)
        prev_fast = fast_ma.shift(1)
        prev_slow = slow_ma.shift(1)

        # Golden Cross: prev_fast < prev_slow AND curr_fast > curr_slow
        df["ma_cross_up"] = (prev_fast < prev_slow) & (fast_ma > slow_ma)
        # Death Cross: prev_fast > prev_slow AND curr_fast < curr_slow
        df["ma_cross_down"] = (prev_fast > prev_slow) & (fast_ma < slow_ma)

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
        min_idx = self.slow_period + 1
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
        cross_up = curr.get("ma_cross_up", False)
        cross_down = curr.get("ma_cross_down", False)
        ma_fast = curr.get("ma_fast", np.nan)
        ma_slow = curr.get("ma_slow", np.nan)

        if pd.isna(ma_fast) or pd.isna(ma_slow):
            return None

        # LONG: Golden Cross
        if cross_up:
            return "long"

        # SHORT: Death Cross
        if cross_down:
            return "short"

        return None
