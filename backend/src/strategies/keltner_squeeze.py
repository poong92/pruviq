"""
Keltner Channel Squeeze Strategy

BB가 Keltner Channel 안으로 완전히 들어가면 스퀴즈(낮은 변동성).
스퀴즈 해소 후 방향성 돌파 시 진입.

BB Squeeze vs Keltner Squeeze:
- BB Squeeze: BB Width 자체의 수축/확장
- Keltner Squeeze: BB가 KC 내부에 있으면 스퀴즈, KC 밖으로 나오면 해소

진입 조건:
- 스퀴즈 해소: BB upper가 KC upper 위로 나옴 (LONG) 또는
               BB lower가 KC lower 아래로 나옴 (SHORT)
- LONG: squeeze 해소 + close > KC upper
- SHORT: squeeze 해소 + close < KC lower

진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class KeltnerSqueezeStrategy:
    """Keltner Channel 스퀴즈 전략"""

    name = "Keltner Squeeze"

    def __init__(
        self,
        kc_period: int = 20,
        kc_mult: float = 1.5,
        bb_period: int = 20,
        bb_std: float = 2.0,
        atr_period: int = 10,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.kc_period = kc_period
        self.kc_mult = kc_mult
        self.bb_period = bb_period
        self.bb_std = bb_std
        self.atr_period = atr_period
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "kc_period": self.kc_period,
            "kc_mult": self.kc_mult,
            "bb_period": self.bb_period,
            "bb_std": self.bb_std,
            "atr_period": self.atr_period,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """BB + Keltner Channel 계산"""
        high = df["high"]
        low = df["low"]
        close = df["close"]

        # Bollinger Bands
        bb_sma = close.rolling(self.bb_period).mean()
        bb_std = close.rolling(self.bb_period).std()
        df["bb_upper"] = bb_sma + self.bb_std * bb_std
        df["bb_lower"] = bb_sma - self.bb_std * bb_std
        df["bb_mid"] = bb_sma

        # ATR (Wilder's smoothing)
        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs(),
        ], axis=1).max(axis=1)
        atr = tr.ewm(com=self.atr_period - 1, min_periods=self.atr_period).mean()

        # Keltner Channel (EMA 기반)
        kc_mid = close.ewm(span=self.kc_period, adjust=False).mean()
        df["kc_upper"] = kc_mid + self.kc_mult * atr
        df["kc_lower"] = kc_mid - self.kc_mult * atr
        df["kc_mid"] = kc_mid

        # 스퀴즈 상태: BB upper < KC upper AND BB lower > KC lower
        df["in_squeeze"] = (df["bb_upper"] < df["kc_upper"]) & (df["bb_lower"] > df["kc_lower"])

        # 스퀴즈 해소: 이전 캔들 in_squeeze=True, 현재 in_squeeze=False
        prev_squeeze = df["in_squeeze"].shift(1)
        df["squeeze_release"] = prev_squeeze & (~df["in_squeeze"])

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
        min_idx = max(self.kc_period, self.bb_period, self.atr_period) + 2
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
        squeeze_release = curr.get("squeeze_release", False)
        curr_close = curr.get("close", np.nan)
        kc_upper = curr.get("kc_upper", np.nan)
        kc_lower = curr.get("kc_lower", np.nan)

        if not squeeze_release:
            return None
        if any(pd.isna(v) for v in [curr_close, kc_upper, kc_lower]):
            return None

        # LONG: 스퀴즈 해소 + close > KC upper
        if curr_close > kc_upper:
            return "long"

        # SHORT: 스퀴즈 해소 + close < KC lower
        if curr_close < kc_lower:
            return "short"

        return None
