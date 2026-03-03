"""
BB Squeeze Strategy — AutoTrader v1.7.0 Parity

볼린저 밴드 스퀴즈 후 확장 시 진입하는 전략.
변동성 축소 → 확장 전환점을 포착.

AutoTrader 실거래 로직과 100% 동일한 조건:
1. 최근 squeeze_lookback 캔들 내 스퀴즈 존재 (any)
2. BB Width 확장: curr > prev AND curr > MA * expansion_threshold
3. 가격 방향 확인: close < bb_mid (SHORT) / close > bb_mid (LONG)
4. 볼륨: prev vol_ratio >= threshold
5. 트렌드: prev downtrend/uptrend (EMA 기반, 캔들 방향 아님)
6. BB 확장속도: curr bb_width_change >= expansion_rate * 100

진입: idx+1의 open (시그널 캔들 다음 봉 시가)
"""

import pandas as pd
import numpy as np
from typing import Optional


class BBSqueezeStrategy:
    """볼린저 밴드 스퀴즈 전략 — AutoTrader v1.7.0 parity"""

    name = "BB Squeeze"

    def __init__(
        self,
        bb_period: int = 20,
        bb_std: float = 2.0,
        squeeze_lookback: int = 10,          # AT default: 10
        squeeze_threshold: float = 0.8,      # bb_width < bb_width_ma * 0.8
        expansion_threshold: float = 0.9,    # bb_width > bb_width_ma * 0.9
        expansion_rate: float = 0.10,        # bb_width_change >= 10%
        volume_ratio: float = 2.0,
        volume_ma_period: int = 10,
        ema_fast: int = 20,
        ema_slow: int = 50,
        avoid_hours: list = None,
    ):
        self.bb_period = bb_period
        self.bb_std = bb_std
        self.squeeze_lookback = squeeze_lookback
        self.squeeze_threshold = squeeze_threshold
        self.expansion_threshold = expansion_threshold
        self.expansion_rate = expansion_rate
        self.volume_ratio = volume_ratio
        self.volume_ma_period = volume_ma_period
        self.ema_fast = ema_fast
        self.ema_slow = ema_slow
        self.avoid_hours = avoid_hours or []

    def get_params(self) -> dict:
        return {
            "bb_period": self.bb_period,
            "bb_std": self.bb_std,
            "squeeze_lookback": self.squeeze_lookback,
            "expansion_rate": self.expansion_rate,
            "expansion_threshold": self.expansion_threshold,
            "volume_ratio": self.volume_ratio,
            "ema_fast": self.ema_fast,
            "ema_slow": self.ema_slow,
            "avoid_hours": self.avoid_hours,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """지표 계산 — AutoTrader v1.7.0 indicators_squeeze.py와 동일"""
        close = df["close"]
        volume = df["volume"]

        # Bollinger Bands
        sma = close.rolling(self.bb_period).mean()
        std = close.rolling(self.bb_period).std()
        df["bb_mid"] = sma
        df["bb_upper"] = sma + self.bb_std * std
        df["bb_lower"] = sma - self.bb_std * std
        df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / sma * 100

        # BB Width MA (AT uses squeeze_lookback for this)
        df["bb_width_ma"] = df["bb_width"].rolling(self.squeeze_lookback).mean()

        # BB 확장속도 (pct_change * 100)
        df["bb_width_change"] = df["bb_width"].pct_change() * 100

        # 스퀴즈: 밴드폭 < MA * threshold
        df["is_squeeze"] = df["bb_width"] < df["bb_width_ma"] * self.squeeze_threshold

        # 최근 스퀴즈 (lookback 윈도우 내 any)
        df["recent_squeeze"] = (
            df["is_squeeze"].rolling(self.squeeze_lookback).max().astype(bool)
        )

        # BB 확장 중 (curr > prev)
        df["bb_expanding"] = df["bb_width"] > df["bb_width"].shift(1)

        # BB Width가 MA * expansion_threshold 이상
        df["bb_width_above_ma"] = (
            df["bb_width"] > df["bb_width_ma"] * self.expansion_threshold
        )

        # 볼륨 (AT uses squeeze_lookback for vol_ma period)
        vol_ma = volume.rolling(self.squeeze_lookback).mean()
        df["vol_ratio"] = np.where(vol_ma > 0, volume / vol_ma, 0)

        # EMA
        df["ema_fast"] = close.ewm(span=self.ema_fast, adjust=False).mean()
        df["ema_slow"] = close.ewm(span=self.ema_slow, adjust=False).mean()
        df["downtrend"] = df["ema_fast"] < df["ema_slow"]
        df["uptrend"] = df["ema_fast"] > df["ema_slow"]

        # 시간 (UTC)
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"])
            df["hour"] = ts.dt.hour
        else:
            df["hour"] = 0

        return df

    def check_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """
        시그널 확인 — AutoTrader v1.7.0 check_short_signal과 동일 로직.

        idx = 시그널 캔들 (AT의 curr). 진입은 idx+1의 open.

        SHORT 조건 (AT check_short_signal):
        0. 시간 필터 (entry bar = idx+1 시간)
        1. 최근 squeeze_lookback 캔들 내 스퀴즈 (idx-lookback ~ idx-1)
        2. 밴드폭 확장: curr > prev AND curr > MA * 0.9
        3. 가격 < BB 중간선
        4. 볼륨: prev vol_ratio >= threshold
        5. 트렌드: prev downtrend (EMA 기반)
        6. BB 확장속도 >= 10%
        """
        if idx < self.ema_slow + self.squeeze_lookback:
            return None
        if idx + 1 >= len(df):
            return None

        curr = df.iloc[idx]
        prev = df.iloc[idx - 1]

        # 0. 시간 필터 (entry bar 시간 기준)
        if self.avoid_hours:
            next_hour = df.iloc[idx + 1].get("hour", 0)
            if next_hour in self.avoid_hours:
                return None

        # NaN 체크
        if pd.isna(curr.get("bb_width", np.nan)) or pd.isna(prev.get("bb_width", np.nan)):
            return None

        # 1. 최근 스퀴즈 (past squeeze_lookback candles ending at prev)
        start_idx = max(0, idx - self.squeeze_lookback)
        if not df.iloc[start_idx:idx]["is_squeeze"].any():
            return None

        # 2. 밴드폭 확장
        expanding = (
            curr["bb_width"] > prev["bb_width"]
            and curr["bb_width"] > curr["bb_width_ma"] * self.expansion_threshold
        )
        if not expanding:
            return None

        # 4. 볼륨 (prev 캔들)
        if prev.get("vol_ratio", 0) < self.volume_ratio:
            return None

        # 6. BB 확장속도 (curr 캔들)
        bb_width_change = curr.get("bb_width_change", 0)
        if pd.isna(bb_width_change) or bb_width_change < self.expansion_rate * 100:
            return None

        # --- 방향별 조건 ---

        # SHORT: 가격 < BB mid + downtrend
        if curr["close"] < curr.get("bb_mid", float("inf")):
            if prev.get("downtrend", False):
                return "short"

        # LONG: 가격 > BB mid + uptrend
        if curr["close"] > curr.get("bb_mid", 0):
            if prev.get("uptrend", False):
                return "long"

        return None
