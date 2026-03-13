"""
Donchian Breakout Strategy — 터틀 트레이딩 방식

채널 돌파를 이용한 추세 추종 전략 (리처드 데니스 / 터틀 트레이딩 기반).

진입 조건:
- LONG: close > 직전 channel_period 캔들의 최고가 (상단 채널 돌파)
- SHORT: close < 직전 channel_period 캔들의 최저가 (하단 채널 이탈)

중요: 시그널 캔들(idx)의 close가 돌파 기준이므로
      채널은 idx-1까지의 데이터로 계산 (look-ahead 방지).

진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class DonchianBreakoutStrategy:
    """도치안 채널 돌파 전략"""

    name = "Donchian Breakout"

    def __init__(
        self,
        channel_period: int = 20,
        exit_period: int = 10,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.channel_period = channel_period
        self.exit_period = exit_period
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "channel_period": self.channel_period,
            "exit_period": self.exit_period,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """도치안 채널 계산"""
        high = df["high"]
        low = df["low"]

        # 채널은 shift(1) 적용: 현재 캔들 제외, idx-1까지의 최고/최저
        # rolling(N).max()는 현재 포함이므로 shift(1)로 이전 캔들까지만 포함
        df["dc_upper"] = high.shift(1).rolling(self.channel_period).max()
        df["dc_lower"] = low.shift(1).rolling(self.channel_period).min()

        # 출구 채널 (더 좁음)
        df["dc_exit_upper"] = high.shift(1).rolling(self.exit_period).max()
        df["dc_exit_lower"] = low.shift(1).rolling(self.exit_period).min()

        # 중간선
        df["dc_mid"] = (df["dc_upper"] + df["dc_lower"]) / 2

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
        min_idx = self.channel_period + 1
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
        curr_close = curr.get("close", np.nan)
        dc_upper = curr.get("dc_upper", np.nan)
        dc_lower = curr.get("dc_lower", np.nan)

        if pd.isna(curr_close) or pd.isna(dc_upper) or pd.isna(dc_lower):
            return None
        if dc_upper <= 0 or dc_lower <= 0:
            return None

        # LONG: 상단 채널 돌파
        if curr_close > dc_upper:
            return "long"

        # SHORT: 하단 채널 이탈
        if curr_close < dc_lower:
            return "short"

        return None
