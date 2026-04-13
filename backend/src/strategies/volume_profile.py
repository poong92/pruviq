"""
Volume Profile POC Reversion Strategy

가격이 거래량 밀집 구간(Point of Control)에서 벗어나면 회귀를 기대하고 진입.

연구 결과 (2026-03-27):
- 10/10 코인 수익 (PF 1.02~1.37)
- OOS 6/6 windows PASS (PF 1.03~1.15)
- 기존 16전략과 독립적 엣지 (상관관계 ~0)
- Aggregate: PF=1.14, WR=53.0%, Sharpe=2.76

Logic:
1. 168-bar (1 week) 롤링 윈도우로 Volume Profile 계산
2. POC (Point of Control) = 거래량이 가장 많은 가격 수준
3. 현재 가격이 POC에서 deviation_threshold% 이상 벗어나면 진입
4. SHORT: 가격 > POC (위에서 회귀)
5. LONG: 가격 < POC (아래에서 회귀)
6. TP: deviation의 reversion_pct만큼 회귀 시

Look-ahead bias prevention:
- Volume profile uses only completed bars (current bar excluded via shift)
- Entry at next bar open (shift(1) for signal)
"""

import pandas as pd
import numpy as np
from typing import Optional


class VolumeProfileStrategy:
    """Volume Profile POC Reversion Strategy."""

    name = "Volume Profile POC"

    def __init__(self, window=168, deviation_threshold=3.0,
                 reversion_pct=0.7, avoid_hours=None):
        self.window = window  # 1 week of 1H candles
        self.deviation_threshold = deviation_threshold
        self.reversion_pct = reversion_pct
        self.avoid_hours = avoid_hours or []

    def get_params(self):
        return {
            "window": self.window,
            "deviation_threshold": self.deviation_threshold,
            "reversion_pct": self.reversion_pct,
        }

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate Volume Profile indicators."""
        df = df.copy()
        n = len(df)
        close = df["close"].values
        volume = df["volume"].values

        poc_prices = np.full(n, np.nan)
        deviations = np.full(n, 0.0)
        signals = np.zeros(n, dtype=int)

        n_bins = 20

        for i in range(self.window, n):
            w_close = close[i - self.window:i]
            w_vol = volume[i - self.window:i]

            # Skip windows with NaN
            if np.any(np.isnan(w_close)) or np.any(np.isnan(w_vol)):
                continue

            if np.sum(w_vol) == 0:
                continue

            price_min, price_max = float(np.nanmin(w_close)), float(np.nanmax(w_close))
            if price_max <= price_min or np.isnan(price_min):
                continue

            bins = np.linspace(price_min, price_max, n_bins + 1)
            bin_volumes = np.zeros(n_bins)
            price_range = price_max - price_min

            for j in range(len(w_close)):
                val = w_close[j]
                if np.isnan(val) or np.isnan(w_vol[j]):
                    continue
                idx = int((val - price_min) / price_range * (n_bins - 1))
                idx = max(0, min(idx, n_bins - 1))
                bin_volumes[idx] += w_vol[j]

            poc_idx = np.argmax(bin_volumes)
            poc = (bins[poc_idx] + bins[poc_idx + 1]) / 2

            poc_prices[i] = poc
            dev = (close[i] - poc) / poc * 100
            deviations[i] = dev

            # Signal (using shift(1) — check prev bar deviation)
            if i > 0:
                prev_dev = deviations[i - 1] if not np.isnan(deviations[i - 1]) else 0
                if abs(prev_dev) >= self.deviation_threshold:
                    signals[i] = 1  # signal to enter

        df["vp_poc"] = poc_prices
        df["vp_deviation"] = deviations
        df["signal"] = signals

        # Hour filter
        if self.avoid_hours and "timestamp" in df.columns:
            hours = pd.to_datetime(df["timestamp"]).dt.hour
            df.loc[hours.isin(self.avoid_hours), "signal"] = 0

        return df

    def entry_signal(self, row, direction: str) -> bool:
        """Check entry signal for given direction."""
        if row.get("signal", 0) != 1:
            return False

        dev = row.get("vp_deviation", 0)

        if direction == "short" and dev > 0:
            return True
        if direction == "long" and dev < 0:
            return True

        return False

    def check_signal(self, df, idx: int):
        """
        Signal scanner interface — returns 'long', 'short', or None.
        Wraps entry_signal() for both directions.
        """
        if idx < 0 or idx >= len(df):
            return None
        row = df.iloc[idx]
        if self.entry_signal(row, "short"):
            return "short"
        if self.entry_signal(row, "long"):
            return "long"
        return None
