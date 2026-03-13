"""
ATR Breakout Strategy

ATR(14) x 2 band breakout with optional EMA trend filter.
Ported from autotrader/indicators_atr.py.

Logic:
1. ATR bands: close(shift 2) +/- ATR(shift 1) * multiplier
2. prev close breaks above upper band -> LONG
3. prev close breaks below lower band -> SHORT
4. Optional EMA trend filter

Look-ahead bias prevention:
- ATR: shift(1) - only uses ATR from previous candle
- Bands: shift(2) close + shift(1) ATR
- Signal: shift(1) close vs bands

All conditions use completed candle data only.
"""

import pandas as pd
import numpy as np
from typing import Optional


class ATRBreakoutStrategy:
    """ATR Band Breakout strategy"""

    name = "ATR Breakout"

    def __init__(
        self,
        atr_period: int = 14,
        atr_multiplier: float = 2.0,
        ema_fast: int = 20,
        ema_slow: int = 50,
        use_trend_filter: bool = True,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.atr_period = atr_period
        self.atr_multiplier = atr_multiplier
        self.ema_fast = ema_fast
        self.ema_slow = ema_slow
        self.use_trend_filter = use_trend_filter
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "atr_period": self.atr_period,
            "atr_multiplier": self.atr_multiplier,
            "ema_fast": self.ema_fast,
            "ema_slow": self.ema_slow,
            "use_trend_filter": self.use_trend_filter,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
            "min_vol_regime": self.min_vol_regime,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate ATR breakout indicators."""
        # True Range
        high_low = df["high"] - df["low"]
        high_close = abs(df["high"] - df["close"].shift(1))
        low_close = abs(df["low"] - df["close"].shift(1))
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)

        # ATR with shift(1) to prevent look-ahead
        df["atr"] = tr.rolling(self.atr_period).mean().shift(1)

        # ATR bands: base = close(shift 2), width = atr * multiplier
        df["atr_upper"] = df["close"].shift(2) + df["atr"] * self.atr_multiplier
        df["atr_lower"] = df["close"].shift(2) - df["atr"] * self.atr_multiplier

        # Breakout signals (prev close vs bands)
        df["breakout_up"] = df["close"].shift(1) > df["atr_upper"]
        df["breakout_down"] = df["close"].shift(1) < df["atr_lower"]

        # EMA trend filter
        df["ema_fast"] = df["close"].ewm(span=self.ema_fast, adjust=False).mean()
        df["ema_slow"] = df["close"].ewm(span=self.ema_slow, adjust=False).mean()

        # Prev candle trend
        df["uptrend"] = df["ema_fast"].shift(1) > df["ema_slow"].shift(1)
        df["downtrend"] = df["ema_fast"].shift(1) < df["ema_slow"].shift(1)

        # Hour (UTC)
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"])
            df["hour"] = ts.dt.hour
        else:
            df["hour"] = 0

        return df

    def check_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """
        Check for ATR breakout signal.
        idx = current bar index. Uses pre-computed breakout_up/breakout_down
        which already reference prev candle via shift(1).
        """
        if idx < self.ema_slow + self.atr_period + 2:
            return None

        row = df.iloc[idx]

        # Time filter
        if idx + 1 < len(df):
            next_hour = df.iloc[idx + 1].get("hour", 0)
            if next_hour in self.avoid_hours:
                return None

        # NaN check
        breakout_up = row.get("breakout_up", False)
        breakout_down = row.get("breakout_down", False)
        if pd.isna(breakout_up) or pd.isna(breakout_down):
            return None

        # Long breakout
        if breakout_up:
            if self.use_trend_filter:
                if not row.get("uptrend", False):
                    return None
            return "long"

        # Short breakout
        if breakout_down:
            if self.use_trend_filter:
                if not row.get("downtrend", False):
                    return None
            return "short"

        return None
