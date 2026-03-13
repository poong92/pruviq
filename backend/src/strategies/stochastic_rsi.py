"""
Stochastic RSI Strategy

Stochastic oscillator를 RSI에 적용하여 과매수/과매도 구간에서
모멘텀 교차를 포착하는 전략.

진입 조건:
- LONG: StochRSI %K < 20 (oversold) AND %K가 %D 위로 교차 (골든 크로스)
- SHORT: StochRSI %K > 80 (overbought) AND %K가 %D 아래로 교차 (데드 크로스)

교차 감지: prev_k < prev_d AND curr_k > curr_d (골든), 반대(데드).
진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class StochasticRSIStrategy:
    """Stochastic RSI 전략"""

    name = "Stochastic RSI"

    def __init__(
        self,
        rsi_period: int = 14,
        stoch_period: int = 14,
        k_smooth: int = 3,
        d_smooth: int = 3,
        oversold: float = 20.0,
        overbought: float = 80.0,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.rsi_period = rsi_period
        self.stoch_period = stoch_period
        self.k_smooth = k_smooth
        self.d_smooth = d_smooth
        self.oversold = oversold
        self.overbought = overbought
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "rsi_period": self.rsi_period,
            "stoch_period": self.stoch_period,
            "k_smooth": self.k_smooth,
            "d_smooth": self.d_smooth,
            "oversold": self.oversold,
            "overbought": self.overbought,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """StochRSI 계산"""
        close = df["close"]

        # Step 1: RSI (Wilder's smoothing)
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=self.rsi_period - 1, min_periods=self.rsi_period).mean()
        avg_loss = loss.ewm(com=self.rsi_period - 1, min_periods=self.rsi_period).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100 - (100 / (1 + rs))

        # Step 2: Stochastic of RSI
        rsi_min = rsi.rolling(self.stoch_period, min_periods=self.stoch_period).min()
        rsi_max = rsi.rolling(self.stoch_period, min_periods=self.stoch_period).max()
        rsi_range = (rsi_max - rsi_min).replace(0, np.nan)
        stoch_rsi = (rsi - rsi_min) / rsi_range * 100

        # Step 3: %K (smoothed StochRSI) and %D (smoothed %K)
        k = stoch_rsi.rolling(self.k_smooth, min_periods=1).mean()
        d = k.rolling(self.d_smooth, min_periods=1).mean()

        df["stochrsi_k"] = k
        df["stochrsi_d"] = d

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
        min_idx = self.rsi_period + self.stoch_period + self.k_smooth + self.d_smooth
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
        prev = df.iloc[idx - 1]

        k_curr = curr.get("stochrsi_k", np.nan)
        d_curr = curr.get("stochrsi_d", np.nan)
        k_prev = prev.get("stochrsi_k", np.nan)
        d_prev = prev.get("stochrsi_d", np.nan)

        if any(pd.isna(v) for v in [k_curr, d_curr, k_prev, d_prev]):
            return None

        # LONG: oversold + 골든 크로스 (%K crosses above %D)
        golden_cross = (k_prev < d_prev) and (k_curr > d_curr)
        if k_curr < self.oversold and golden_cross:
            return "long"

        # SHORT: overbought + 데드 크로스 (%K crosses below %D)
        death_cross = (k_prev > d_prev) and (k_curr < d_curr)
        if k_curr > self.overbought and death_cross:
            return "short"

        return None
