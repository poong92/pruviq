"""
Ichimoku Cloud Strategy (일목균형표)

아시아권에서 특히 인기 있는 종합 추세 지표.

구성 요소:
- Tenkan-sen (전환선): (9기간 고가 + 9기간 저가) / 2
- Kijun-sen (기준선): (26기간 고가 + 26기간 저가) / 2
- Senkou Span A (선행스팬 A): (Tenkan + Kijun) / 2, 26기간 선행
- Senkou Span B (선행스팬 B): (52기간 고가 + 52기간 저가) / 2, 26기간 선행

진입 조건:
- LONG: close > cloud (Span A & B 모두 위) AND Tenkan이 Kijun 위로 교차
- SHORT: close < cloud (Span A & B 모두 아래) AND Tenkan이 Kijun 아래로 교차

Senkou Span은 26기간 선행이므로, 현재 캔들(idx)에서의 cloud는
idx+26 위치의 Span 값임. shift(-26)으로 현재에 매핑.
진입: 시그널 캔들(idx) 다음 캔들(idx+1) open.
"""

import pandas as pd
import numpy as np
from typing import Optional


class IchimokuStrategy:
    """Ichimoku Cloud 전략"""

    name = "Ichimoku Cloud"

    def __init__(
        self,
        tenkan: int = 9,
        kijun: int = 26,
        senkou_b: int = 52,
        avoid_hours: list = None,
        avoid_months: list = None,
        min_vol_regime: float = None,
    ):
        self.tenkan = tenkan
        self.kijun = kijun
        self.senkou_b = senkou_b
        self.avoid_hours = avoid_hours or []
        self.avoid_months = avoid_months or []
        self.min_vol_regime = min_vol_regime

    def get_params(self) -> dict:
        return {
            "tenkan": self.tenkan,
            "kijun": self.kijun,
            "senkou_b": self.senkou_b,
            "avoid_hours": self.avoid_hours,
            "avoid_months": self.avoid_months,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ichimoku 지표 계산"""
        high = df["high"]
        low = df["low"]
        close = df["close"]

        # Tenkan-sen (전환선): 9기간 중간값
        tenkan_high = high.rolling(self.tenkan, min_periods=self.tenkan).max()
        tenkan_low = low.rolling(self.tenkan, min_periods=self.tenkan).min()
        tenkan_sen = (tenkan_high + tenkan_low) / 2

        # Kijun-sen (기준선): 26기간 중간값
        kijun_high = high.rolling(self.kijun, min_periods=self.kijun).max()
        kijun_low = low.rolling(self.kijun, min_periods=self.kijun).min()
        kijun_sen = (kijun_high + kijun_low) / 2

        # Senkou Span A: (Tenkan + Kijun) / 2, 현재 기준으로 26기간 뒤에 그려짐
        # shift(-26): 미래 위치의 값을 현재로 당겨옴 → look-ahead 발생 위험
        # 올바른 접근: 현재 캔들(idx)의 cloud는 idx-kijun 시점에 계산된 Span 값
        # shift(kijun): 26기간 전의 Span A/B 값이 현재 cloud에 해당
        senkou_span_a_raw = (tenkan_sen + kijun_sen) / 2
        span_a = senkou_span_a_raw.shift(self.kijun)  # 26기간 전 계산값 → 현재 cloud

        # Senkou Span B: 52기간 중간값, 26기간 선행
        senkou_b_high = high.rolling(self.senkou_b, min_periods=self.senkou_b).max()
        senkou_b_low = low.rolling(self.senkou_b, min_periods=self.senkou_b).min()
        senkou_span_b_raw = (senkou_b_high + senkou_b_low) / 2
        span_b = senkou_span_b_raw.shift(self.kijun)  # 26기간 전 계산값 → 현재 cloud

        df["tenkan_sen"] = tenkan_sen
        df["kijun_sen"] = kijun_sen
        df["span_a"] = span_a
        df["span_b"] = span_b

        # Cloud 상/하단
        df["cloud_top"] = pd.concat([span_a, span_b], axis=1).max(axis=1)
        df["cloud_bottom"] = pd.concat([span_a, span_b], axis=1).min(axis=1)

        # Tenkan/Kijun 교차 (shift(1) = prev bar로 교차 감지)
        prev_tenkan = tenkan_sen.shift(1)
        prev_kijun = kijun_sen.shift(1)

        # Tenkan crosses above Kijun (LONG)
        df["tk_cross_up"] = (prev_tenkan < prev_kijun) & (tenkan_sen > kijun_sen)
        # Tenkan crosses below Kijun (SHORT)
        df["tk_cross_down"] = (prev_tenkan > prev_kijun) & (tenkan_sen < kijun_sen)

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
        min_idx = self.senkou_b + self.kijun + 1
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
        close = curr.get("close", np.nan)
        cloud_top = curr.get("cloud_top", np.nan)
        cloud_bottom = curr.get("cloud_bottom", np.nan)
        cross_up = curr.get("tk_cross_up", False)
        cross_down = curr.get("tk_cross_down", False)

        if any(pd.isna(v) for v in [close, cloud_top, cloud_bottom]):
            return None

        # LONG: close > cloud (상단 위) + Tenkan 상향 교차
        if close > cloud_top and cross_up:
            return "long"

        # SHORT: close < cloud (하단 아래) + Tenkan 하향 교차
        if close < cloud_bottom and cross_down:
            return "short"

        return None
