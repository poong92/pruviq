"""
RSI Divergence Strategy

강세/약세 다이버전스를 포착하는 전략.
가격과 RSI의 방향이 엇갈릴 때(다이버전스) 추세 전환을 노림.

진입 조건:
- LONG: RSI < oversold(30) + 가격 신저점이지만 RSI는 이전보다 높음 (강세 다이버전스)
- SHORT: RSI > overbought(70) + 가격 신고점이지만 RSI는 이전보다 낮음 (약세 다이버전스)

룩백 윈도우(lookback=10) 내에서 이전 극값과 비교.
진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class RSIDivergenceStrategy:
    """RSI 다이버전스 전략"""

    name = "RSI Divergence"

    def __init__(
        self,
        rsi_period: int = 14,
        oversold: float = 30.0,
        overbought: float = 70.0,
        lookback: int = 10,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.rsi_period = rsi_period
        self.oversold = oversold
        self.overbought = overbought
        self.lookback = lookback
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "rsi_period": self.rsi_period,
            "oversold": self.oversold,
            "overbought": self.overbought,
            "lookback": self.lookback,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """RSI 계산"""
        close = df["close"]

        # RSI (Wilder's smoothing)
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=self.rsi_period - 1, min_periods=self.rsi_period).mean()
        avg_loss = loss.ewm(com=self.rsi_period - 1, min_periods=self.rsi_period).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        df["rsi"] = 100 - (100 / (1 + rs))

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
        idx = 시그널 캔들 (완성된 캔들). 진입은 idx+1 open.
        """
        min_idx = self.rsi_period + self.lookback
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
        curr_rsi = curr.get("rsi", np.nan)
        curr_close = curr.get("close", np.nan)
        if pd.isna(curr_rsi) or pd.isna(curr_close):
            return None

        # lookback 윈도우 (idx-lookback ~ idx-1)
        window = df.iloc[max(0, idx - self.lookback): idx]
        if len(window) < 2:
            return None

        # LONG: 강세 다이버전스
        # 가격 신저점(curr < window min close) + RSI는 window RSI min보다 높음
        if curr_rsi < self.oversold:
            window_low = window["close"].min()
            window_rsi_low = window["rsi"].min() if "rsi" in window.columns else np.nan
            if not pd.isna(window_rsi_low):
                price_new_low = curr_close < window_low
                rsi_higher = curr_rsi > window_rsi_low
                if price_new_low and rsi_higher:
                    return "long"

        # SHORT: 약세 다이버전스
        # 가격 신고점(curr > window max close) + RSI는 window RSI max보다 낮음
        if curr_rsi > self.overbought:
            window_high = window["close"].max()
            window_rsi_high = window["rsi"].max() if "rsi" in window.columns else np.nan
            if not pd.isna(window_rsi_high):
                price_new_high = curr_close > window_high
                rsi_lower = curr_rsi < window_rsi_high
                if price_new_high and rsi_lower:
                    return "short"

        return None
