"""
Heikin Ashi Trend Strategy

Heikin Ashi 캔들 기반 강한 추세 감지 전략.

HA 캔들 계산 (look-ahead 없이 순차적):
  HA_Close = (open + high + low + close) / 4
  HA_Open = (prev_HA_Open + prev_HA_Close) / 2
  HA_High = max(high, HA_Open, HA_Close)
  HA_Low = min(low, HA_Open, HA_Close)

진입 조건:
- LONG: HA 양봉 N연속 + 마지막 캔들에 lower wick 없음 (강한 상승)
  lower wick = HA_Low < min(HA_Open, HA_Close)
- SHORT: HA 음봉 N연속 + 마지막 캔들에 upper wick 없음 (강한 하락)
  upper wick = HA_High > max(HA_Open, HA_Close)

진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class HeikinAshiStrategy:
    """Heikin Ashi Trend 전략"""

    name = "Heikin Ashi Trend"

    def __init__(
        self,
        consecutive: int = 3,
        wick_tolerance: float = 0.001,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.consecutive = consecutive
        self.wick_tolerance = wick_tolerance
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "consecutive": self.consecutive,
            "wick_tolerance": self.wick_tolerance,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Heikin Ashi 캔들 계산 (순차, look-ahead 없음)"""
        n = len(df)
        opens = df["open"].values.astype(float)
        highs = df["high"].values.astype(float)
        lows = df["low"].values.astype(float)
        closes = df["close"].values.astype(float)

        ha_open = np.empty(n)
        ha_close = np.empty(n)
        ha_high = np.empty(n)
        ha_low = np.empty(n)

        # 첫 캔들 초기화
        ha_close[0] = (opens[0] + highs[0] + lows[0] + closes[0]) / 4
        ha_open[0] = (opens[0] + closes[0]) / 2
        ha_high[0] = highs[0]
        ha_low[0] = lows[0]

        for i in range(1, n):
            ha_close[i] = (opens[i] + highs[i] + lows[i] + closes[i]) / 4
            ha_open[i] = (ha_open[i - 1] + ha_close[i - 1]) / 2
            ha_high[i] = max(highs[i], ha_open[i], ha_close[i])
            ha_low[i] = min(lows[i], ha_open[i], ha_close[i])

        # HA 양봉/음봉
        ha_bullish = ha_close > ha_open   # HA 양봉
        ha_bearish = ha_close < ha_open   # HA 음봉

        # wick 감지
        # lower wick: HA_Low < min(HA_Open, HA_Close) - tolerance
        body_bottom = np.minimum(ha_open, ha_close)
        body_top = np.maximum(ha_open, ha_close)
        body_size = body_top - body_bottom

        # tolerance는 body 대비 상대 비율로 적용
        tol = body_size * self.wick_tolerance
        has_lower_wick = ha_low < (body_bottom - tol)
        has_upper_wick = ha_high > (body_top + tol)

        df["ha_open"] = ha_open
        df["ha_close"] = ha_close
        df["ha_high"] = ha_high
        df["ha_low"] = ha_low
        df["ha_bullish"] = ha_bullish
        df["ha_bearish"] = ha_bearish
        df["ha_has_lower_wick"] = has_lower_wick
        df["ha_has_upper_wick"] = has_upper_wick

        # N연속 양봉/음봉 (rolling sum, min_periods=consecutive)
        bullish_series = pd.Series(ha_bullish.astype(int), index=df.index)
        bearish_series = pd.Series(ha_bearish.astype(int), index=df.index)

        # shift(1): 현재 캔들 제외하고 이전 consecutive 캔들 확인 (look-ahead 방지)
        # 실제로는 check_signal에서 prev 기반으로 확인하므로 raw 값 저장
        # rolling min: 모든 캔들이 bullish/bearish인지 확인
        df["ha_consec_bull"] = bullish_series.rolling(self.consecutive, min_periods=self.consecutive).min()
        df["ha_consec_bear"] = bearish_series.rolling(self.consecutive, min_periods=self.consecutive).min()

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
        min_idx = self.consecutive + 1
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
        consec_bull = curr.get("ha_consec_bull", 0)
        consec_bear = curr.get("ha_consec_bear", 0)
        has_lower_wick = curr.get("ha_has_lower_wick", True)
        has_upper_wick = curr.get("ha_has_upper_wick", True)

        if pd.isna(consec_bull) or pd.isna(consec_bear):
            return None

        # LONG: N연속 양봉 + lower wick 없음 (강한 상승)
        if consec_bull >= 1 and not has_lower_wick:
            return "long"

        # SHORT: N연속 음봉 + upper wick 없음 (강한 하락)
        if consec_bear >= 1 and not has_upper_wick:
            return "short"

        return None
