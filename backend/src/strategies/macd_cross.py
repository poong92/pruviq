"""
MACD Cross Strategy

MACD 교차를 이용한 추세 추종 전략.
추가 필터: 제로라인 아래에서 교차(LONG) / 제로라인 위에서 교차(SHORT).

진입 조건:
- LONG: MACD line이 signal line 위로 교차 + MACD < 0 (저점에서 상승 전환)
- SHORT: MACD line이 signal line 아래로 교차 + MACD > 0 (고점에서 하락 전환)

진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class MACDCrossStrategy:
    """MACD 교차 전략"""

    name = "MACD Cross"

    def __init__(
        self,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.fast = fast
        self.slow = slow
        self.signal = signal
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "fast": self.fast,
            "slow": self.slow,
            "signal": self.signal,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """MACD 계산"""
        close = df["close"]

        ema_fast = close.ewm(span=self.fast, adjust=False).mean()
        ema_slow = close.ewm(span=self.slow, adjust=False).mean()
        df["macd_line"] = ema_fast - ema_slow
        df["macd_signal"] = df["macd_line"].ewm(span=self.signal, adjust=False).mean()
        df["macd_hist"] = df["macd_line"] - df["macd_signal"]

        # 교차 여부: curr에서 교차 발생 (prev hist 부호 != curr hist 부호)
        prev_hist = df["macd_hist"].shift(1)
        # 골든크로스: hist가 음→양 (macd_line이 signal 위로)
        df["macd_cross_up"] = (prev_hist < 0) & (df["macd_hist"] > 0)
        # 데드크로스: hist가 양→음 (macd_line이 signal 아래로)
        df["macd_cross_down"] = (prev_hist > 0) & (df["macd_hist"] < 0)

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
        min_idx = self.slow + self.signal + 1
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
        macd_line = curr.get("macd_line", np.nan)
        cross_up = curr.get("macd_cross_up", False)
        cross_down = curr.get("macd_cross_down", False)

        if pd.isna(macd_line):
            return None

        # LONG: 골든크로스 + MACD < 0 (저점 교차)
        if cross_up and macd_line < 0:
            return "long"

        # SHORT: 데드크로스 + MACD > 0 (고점 교차)
        if cross_down and macd_line > 0:
            return "short"

        return None
