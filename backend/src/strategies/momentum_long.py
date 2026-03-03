"""
Momentum Breakout LONG Strategy

20-candle high breakout with volume confirmation and EMA trend filter.
Ported from autotrader/indicators_squeeze.py check_momentum_long_signal().

Logic:
1. prev close > 20-candle highest high (breakout)
2. Volume >= 2.0x MA
3. EMA20 > EMA50 (uptrend)
4. Time filter

Entry: Next bar open after breakout signal.
All conditions use completed candle (prev) only. (look-ahead bias free)
"""

import pandas as pd
import numpy as np
from typing import Optional


class MomentumLongStrategy:
    """Momentum Breakout LONG strategy"""

    name = "Momentum Long"

    def __init__(
        self,
        breakout_lookback: int = 20,
        volume_ratio: float = 2.0,
        volume_ma_period: int = 10,
        ema_fast: int = 20,
        ema_slow: int = 50,
        avoid_hours: list = None,
    ):
        self.breakout_lookback = breakout_lookback
        self.volume_ratio = volume_ratio
        self.volume_ma_period = volume_ma_period
        self.ema_fast = ema_fast
        self.ema_slow = ema_slow
        self.avoid_hours = avoid_hours or [1, 2, 3, 8, 9, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23]

    def get_params(self) -> dict:
        return {
            "breakout_lookback": self.breakout_lookback,
            "volume_ratio": self.volume_ratio,
            "ema_fast": self.ema_fast,
            "ema_slow": self.ema_slow,
            "avoid_hours": self.avoid_hours,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate momentum breakout indicators."""
        close = df["close"]
        volume = df["volume"]

        # 20-candle highest high (shifted by 1 to avoid look-ahead)
        df["highest_20"] = close.rolling(self.breakout_lookback).max().shift(1)

        # Volume ratio
        vol_ma = volume.rolling(self.volume_ma_period).mean()
        df["vol_ratio"] = np.where(vol_ma > 0, volume / vol_ma, 0)

        # EMA
        df["ema_fast"] = close.ewm(span=self.ema_fast, adjust=False).mean()
        df["ema_slow"] = close.ewm(span=self.ema_slow, adjust=False).mean()

        # Uptrend
        df["uptrend"] = df["ema_fast"] > df["ema_slow"]

        # Hour (UTC)
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"])
            df["hour"] = ts.dt.hour
        else:
            df["hour"] = 0

        return df

    def check_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """
        Check for momentum breakout signal.
        idx = completed candle index (prev role).
        Entry at idx+1 open.
        """
        if idx < self.ema_slow + self.breakout_lookback:
            return None

        row = df.iloc[idx]

        # Time filter (check next bar's hour)
        if idx + 1 < len(df):
            next_hour = df.iloc[idx + 1].get("hour", 0)
            if next_hour in self.avoid_hours:
                return None

        # 1. Breakout: prev close > 20-candle highest high
        highest_20 = row.get("highest_20", 0)
        if pd.isna(highest_20) or highest_20 <= 0:
            return None

        if row["close"] <= highest_20:
            return None

        # 2. Volume filter
        vol_ratio = row.get("vol_ratio", 0)
        if vol_ratio < self.volume_ratio:
            return None

        # 3. Uptrend filter
        if not row.get("uptrend", False):
            return None

        return "long"
