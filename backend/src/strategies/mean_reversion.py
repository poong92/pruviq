"""
Mean Reversion Strategy

평균 회귀 전략. 가격이 SMA에서 크게 이탈했을 때 회귀를 노림.
RSI 필터로 과매도/과매수 상태를 추가 확인.

진입 조건:
- LONG: close < SMA - std_mult * σ (하단 밴드 이탈) + RSI < rsi_oversold
- SHORT: close > SMA + std_mult * σ (상단 밴드 이탈) + RSI > rsi_overbought

진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class MeanReversionStrategy:
    """평균 회귀 전략"""

    name = "Mean Reversion"

    def __init__(
        self,
        sma_period: int = 20,
        std_mult: float = 2.0,
        rsi_period: int = 14,
        rsi_oversold: float = 30.0,
        rsi_overbought: float = 70.0,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.sma_period = sma_period
        self.std_mult = std_mult
        self.rsi_period = rsi_period
        self.rsi_oversold = rsi_oversold
        self.rsi_overbought = rsi_overbought
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "sma_period": self.sma_period,
            "std_mult": self.std_mult,
            "rsi_period": self.rsi_period,
            "rsi_oversold": self.rsi_oversold,
            "rsi_overbought": self.rsi_overbought,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """SMA 밴드 + RSI 계산"""
        close = df["close"]

        # SMA와 표준편차 밴드
        df["sma"] = close.rolling(self.sma_period).mean()
        std = close.rolling(self.sma_period).std()
        df["band_upper"] = df["sma"] + self.std_mult * std
        df["band_lower"] = df["sma"] - self.std_mult * std

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
        idx = 시그널 캔들 (완성). 진입은 idx+1 open.
        """
        min_idx = max(self.sma_period, self.rsi_period) + 1
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
        band_upper = curr.get("band_upper", np.nan)
        band_lower = curr.get("band_lower", np.nan)
        rsi = curr.get("rsi", np.nan)

        if any(pd.isna(v) for v in [curr_close, band_upper, band_lower, rsi]):
            return None

        # LONG: 하단 밴드 이탈 + RSI 과매도
        if curr_close < band_lower and rsi < self.rsi_oversold:
            return "long"

        # SHORT: 상단 밴드 이탈 + RSI 과매수
        if curr_close > band_upper and rsi > self.rsi_overbought:
            return "short"

        return None
