"""
HV Squeeze Strategy

BB squeeze detection with candle color direction filter (instead of EMA).
Ported from autotrader/indicators_hv_squeeze.py.

Differences from BB Squeeze:
- Uses prev candle color (bullish/bearish) instead of EMA trend
- Lower volume multiplier (1.5x vs 2.0x)
- Wider default SL/TP (5%/10%)

Logic:
1. Recent squeeze exists (BB width < 80% of MA)
2. BB width expanding (curr > prev)
3. Volume >= 1.5x MA
4. Price vs BB mid (above = long, below = short)
5. Prev candle direction confirms (bullish = long, bearish = short)

All conditions use completed candle data only. (look-ahead bias free)
"""

import pandas as pd
import numpy as np
from typing import Optional


class HVSqueezeStrategy:
    """HV Squeeze (Historical Volatility Squeeze) strategy"""

    name = "HV Squeeze"

    def __init__(
        self,
        bb_period: int = 20,
        bb_std: float = 2.0,
        squeeze_lookback: int = 10,
        squeeze_threshold: float = 0.8,
        volume_ratio: float = 1.5,
        volume_ma_period: int = 20,
        avoid_hours: list = None,
    ):
        self.bb_period = bb_period
        self.bb_std = bb_std
        self.squeeze_lookback = squeeze_lookback
        self.squeeze_threshold = squeeze_threshold
        self.volume_ratio = volume_ratio
        self.volume_ma_period = volume_ma_period
        self.avoid_hours = avoid_hours or []

    def get_params(self) -> dict:
        return {
            "bb_period": self.bb_period,
            "bb_std": self.bb_std,
            "squeeze_lookback": self.squeeze_lookback,
            "squeeze_threshold": self.squeeze_threshold,
            "volume_ratio": self.volume_ratio,
            "avoid_hours": self.avoid_hours,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate HV squeeze indicators."""
        close = df["close"]
        volume = df["volume"]

        # Bollinger Bands
        bb_mid = close.rolling(self.bb_period).mean()
        bb_std = close.rolling(self.bb_period).std()
        df["bb_upper"] = bb_mid + self.bb_std * bb_std
        df["bb_lower"] = bb_mid - self.bb_std * bb_std
        df["bb_mid"] = bb_mid

        # BB Width
        df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / bb_mid

        # BB Width MA for squeeze detection
        df["bb_width_ma"] = df["bb_width"].rolling(self.bb_period).mean()

        # Squeeze state: width < threshold * MA
        df["is_squeeze"] = df["bb_width"] < df["bb_width_ma"] * self.squeeze_threshold

        # Volume ratio
        vol_ma = volume.rolling(self.volume_ma_period).mean()
        df["vol_ratio"] = np.where(vol_ma > 0, volume / vol_ma, 0)

        # Candle direction (HV Squeeze key - uses candle color instead of EMA)
        df["is_bullish"] = close > df["open"]
        df["is_bearish"] = close < df["open"]

        # Hour (UTC)
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"])
            df["hour"] = ts.dt.hour
        else:
            df["hour"] = 0

        return df

    def check_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """
        Check for HV squeeze signal.
        idx = completed candle index (prev role).
        Entry at idx+1 open.
        """
        if idx < self.bb_period + self.squeeze_lookback + 1:
            return None

        # Time filter
        if idx + 1 < len(df):
            next_hour = df.iloc[idx + 1].get("hour", 0)
            if next_hour in self.avoid_hours:
                return None

        row = df.iloc[idx]      # current (acts as "curr" in autotrader logic)
        prev = df.iloc[idx - 1]  # previous

        # NaN check
        bb_width = row.get("bb_width", 0)
        prev_bb_width = prev.get("bb_width", 0)
        if pd.isna(bb_width) or pd.isna(prev_bb_width):
            return None

        # 1. Recent squeeze exists
        start = max(0, idx - self.squeeze_lookback)
        recent = df.iloc[start:idx]
        if not recent["is_squeeze"].any():
            return None

        # 2. BB width expanding
        if bb_width <= prev_bb_width:
            return None

        # 3. Volume filter (prev candle)
        vol_ratio = prev.get("vol_ratio", 0)
        if vol_ratio < self.volume_ratio:
            return None

        # 4 + 5. Direction: price vs BB mid + candle color
        bb_mid = row.get("bb_mid", 0)
        if pd.isna(bb_mid) or bb_mid <= 0:
            return None

        close = row.get("close", 0)

        if close > bb_mid and prev.get("is_bullish", False):
            return "long"
        elif close < bb_mid and prev.get("is_bearish", False):
            return "short"

        return None
