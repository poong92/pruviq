"""
BB Squeeze Strategy

볼린저 밴드 스퀴즈 후 확장 시 진입하는 전략.
변동성 축소 → 확장 전환점을 포착.

로직:
1. BB Width가 최근 N봉 중 최소 → "스퀴즈" 상태
2. 현재 봉에서 BB Width가 확장 (expansion_rate >= threshold)
3. 거래량이 평균 대비 volume_ratio 이상
4. EMA 트렌드 확인

진입:
- SHORT: 스퀴즈 해소 + 하락 트렌드 + 볼륨 스파이크
- LONG: 스퀴즈 해소 + 상승 트렌드 + 볼륨 스파이크

모든 조건은 '완성된 캔들(prev)'로만 판단. (look-ahead bias 제거)
"""

import pandas as pd
import numpy as np
from typing import Optional


class BBSqueezeStrategy:
    """볼린저 밴드 스퀴즈 전략"""

    name = "BB Squeeze"

    def __init__(
        self,
        bb_period: int = 20,
        bb_std: float = 2.0,
        squeeze_lookback: int = 20,
        expansion_rate: float = 0.10,    # BB width 확장 속도 >= 10%
        volume_ratio: float = 2.0,       # 볼륨 MA 대비 배수
        volume_ma_period: int = 10,
        ema_fast: int = 20,
        ema_slow: int = 50,
        avoid_hours: list = None,        # UTC 시간 필터
    ):
        self.bb_period = bb_period
        self.bb_std = bb_std
        self.squeeze_lookback = squeeze_lookback
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
            "volume_ratio": self.volume_ratio,
            "ema_fast": self.ema_fast,
            "ema_slow": self.ema_slow,
            "avoid_hours": self.avoid_hours,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """지표 계산"""
        close = df["close"]
        volume = df["volume"]

        # Bollinger Bands
        sma = close.rolling(self.bb_period).mean()
        std = close.rolling(self.bb_period).std()
        df["bb_upper"] = sma + self.bb_std * std
        df["bb_lower"] = sma - self.bb_std * std
        df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / sma

        # BB Width 최소 (스퀴즈 감지)
        df["bb_width_min"] = df["bb_width"].rolling(self.squeeze_lookback).min()

        # BB 확장 속도
        prev_width = df["bb_width"].shift(1)
        df["bb_expansion"] = np.where(
            prev_width > 0,
            (df["bb_width"] - prev_width) / prev_width,
            0,
        )

        # 볼륨 비율
        vol_ma = volume.rolling(self.volume_ma_period).mean()
        df["vol_ratio"] = np.where(vol_ma > 0, volume / vol_ma, 0)

        # EMA
        df["ema_fast"] = close.ewm(span=self.ema_fast, adjust=False).mean()
        df["ema_slow"] = close.ewm(span=self.ema_slow, adjust=False).mean()

        # 캔들 방향
        df["is_bearish"] = close < df["open"]
        df["is_bullish"] = close > df["open"]

        # 시간 (UTC)
        if "timestamp" in df.columns:
            ts = pd.to_datetime(df["timestamp"])
            df["hour"] = ts.dt.hour
        else:
            df["hour"] = 0

        return df

    def check_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """
        시그널 확인.
        idx = 완성된 캔들 인덱스 (prev 역할).
        진입은 idx+1의 open에서 발생.
        """
        if idx < self.ema_slow + self.squeeze_lookback:
            return None

        row = df.iloc[idx]

        # 시간 필터 (다음 캔들 시간 기준으로 필터)
        if idx + 1 < len(df):
            next_hour = df.iloc[idx + 1].get("hour", 0)
            if next_hour in self.avoid_hours:
                return None

        # 1. 스퀴즈 상태: 이전 봉이 최소 BB Width였거나 근접
        bb_width = row.get("bb_width", 0)
        bb_width_min = row.get("bb_width_min", 0)
        if bb_width_min <= 0 or bb_width <= 0:
            return None

        # 현재 BB Width가 최근 최소값의 1.2배 이내 → 스퀴즈에서 막 풀리는 중
        is_near_squeeze = bb_width <= bb_width_min * 1.2

        # 2. 확장 속도
        expansion = row.get("bb_expansion", 0)
        has_expansion = expansion >= self.expansion_rate

        # 3. 볼륨
        vol_ratio = row.get("vol_ratio", 0)
        has_volume = vol_ratio >= self.volume_ratio

        # 모든 기본 조건 충족?
        if not (is_near_squeeze and has_expansion and has_volume):
            return None

        # 4. 방향 결정 (트렌드 + 캔들)
        ema_fast = row.get("ema_fast", 0)
        ema_slow = row.get("ema_slow", 0)
        is_bearish = row.get("is_bearish", False)
        is_bullish = row.get("is_bullish", False)

        if ema_fast < ema_slow and is_bearish:
            return "short"
        elif ema_fast > ema_slow and is_bullish:
            return "long"

        return None
