"""
Vectorized Simulation Engine — 10x faster than bar-by-bar loop.

Uses numpy arrays for SL/TP/timeout checks instead of Python for-loop.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Tuple
import pandas as pd
import numpy as np


@dataclass
class Trade:
    symbol: str
    direction: str
    entry_time: str
    exit_time: str
    entry_price: float
    exit_price: float
    pnl_pct: float
    pnl_gross_pct: float
    fee_pct: float
    funding_pct: float
    exit_reason: str
    bars_held: int
    pnl_usd: float = 0.0


@dataclass
class SimResult:
    strategy_name: str
    symbol: str
    params: dict
    market_type: str
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    total_return_pct: float
    profit_factor: float
    avg_win_pct: float
    avg_loss_pct: float
    max_drawdown_pct: float
    max_consecutive_losses: int
    total_fees_pct: float
    total_funding_pct: float
    tp_count: int
    sl_count: int
    timeout_count: int
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    trades: list = field(default_factory=list)
    equity_curve: list = field(default_factory=list)


def _compute_vol_regime_filter(df: pd.DataFrame, n: int, min_vol_regime: float) -> np.ndarray:
    """
    Compute ATR-based volatility regime filter.

    Returns a boolean array of length n where True = volatility is sufficient for entry.
    ATR ratio = current ATR(14) / 14-period MA of ATR. Entries allowed when ratio >= min_vol_regime.
    """
    vol_regime_ok = np.ones(n, dtype=bool)
    if min_vol_regime is None:
        return vol_regime_ok
    if "high" not in df.columns or "low" not in df.columns or "close" not in df.columns:
        return vol_regime_ok

    high = df["high"].values.astype(float)
    low = df["low"].values.astype(float)
    close = df["close"].values.astype(float)

    # True Range calculation
    tr = np.empty(n)
    tr[0] = high[0] - low[0]
    for i in range(1, n):
        tr[i] = max(high[i] - low[i], abs(high[i] - close[i - 1]), abs(low[i] - close[i - 1]))

    # 14-period ATR (EMA-style, matching standard ATR)
    atr_period = 14
    atr = np.full(n, np.nan)
    if n >= atr_period:
        atr[atr_period - 1] = np.mean(tr[:atr_period])
        for i in range(atr_period, n):
            atr[i] = (atr[i - 1] * (atr_period - 1) + tr[i]) / atr_period

    # ATR moving average (14-period SMA of ATR)
    atr_ma = np.full(n, np.nan)
    if n >= 2 * atr_period:
        for i in range(2 * atr_period - 2, n):
            atr_ma[i] = np.mean(atr[i - atr_period + 1:i + 1])

    # ATR ratio
    atr_ratio = np.where((atr_ma > 0) & ~np.isnan(atr_ma), atr / atr_ma, np.nan)
    vol_regime_ok = np.where(np.isnan(atr_ratio), False, atr_ratio >= min_vol_regime)

    return vol_regime_ok


def find_signals_vectorized(df: pd.DataFrame, strategy, direction: str = "short") -> np.ndarray:
    """
    Vectorized signal detection for BB Squeeze — AutoTrader v1.7.0 parity.

    Conditions at signal bar (idx), entry at idx+1:
    - recent_squeeze[idx-1]: any squeeze in past lookback candles (shift=1)
    - bb_expanding[idx]: curr bb_width > prev bb_width (shift=0)
    - bb_width_above_ma[idx]: curr bb_width > MA * 0.9 (shift=0)
    - close vs bb_mid[idx]: direction filter (shift=0)
    - vol_ratio[idx-1]: prev candle volume (shift=1)
    - downtrend/uptrend[idx-1]: prev candle EMA trend (shift=1)
    - bb_width_change[idx]: curr expansion speed >= 10% (shift=0)
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    # Extract arrays — AT parity fields
    recent_squeeze = col("recent_squeeze", np.zeros(n, dtype=bool))
    bb_expanding = col("bb_expanding", np.zeros(n, dtype=bool))
    bb_width_above_ma = col("bb_width_above_ma", np.zeros(n, dtype=bool))
    bb_width_change = col("bb_width_change")
    close = col("close")
    bb_mid = col("bb_mid")
    vol_ratio = col("vol_ratio")
    downtrend = col("downtrend", np.zeros(n, dtype=bool))
    uptrend = col("uptrend", np.zeros(n, dtype=bool))
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.ema_slow + strategy.squeeze_lookback
    expansion_min = strategy.expansion_rate * 100  # 0.10 -> 10

    valid_range = np.arange(n) >= min_idx

    # Shifted conditions (prev candle = shift 1)
    prev_recent_squeeze = np.roll(recent_squeeze, 1)
    prev_recent_squeeze[0] = False
    prev_vol_ratio = np.roll(vol_ratio, 1)
    prev_vol_ratio[0] = 0
    prev_downtrend = np.roll(downtrend, 1)
    prev_downtrend[0] = False
    prev_uptrend = np.roll(uptrend, 1)
    prev_uptrend[0] = False

    # Base conditions (matching AT exactly)
    has_recent_squeeze = prev_recent_squeeze.astype(bool)
    has_bb_expanding = bb_expanding.astype(bool)
    has_bb_above_ma = bb_width_above_ma.astype(bool)
    has_volume = prev_vol_ratio >= strategy.volume_ratio
    has_expansion_speed = bb_width_change >= expansion_min

    # Time filter (check entry bar = idx+1 hour)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            h = hour[i + 1]
            if np.isnan(h):
                next_hour_ok[i] = False
            elif int(h) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False  # Can't enter on last bar

    # avoid_months filter (entry bar = idx+1 month)
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    # ATR volatility regime filter
    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    # Combine base conditions
    base_ok = (
        valid_range & has_recent_squeeze & has_bb_expanding
        & has_bb_above_ma & has_volume & has_expansion_speed & next_hour_ok & next_month_ok
        & vol_regime_ok
    )

    # Direction-specific conditions
    if direction == "short":
        signal = base_ok & (close < bb_mid) & prev_downtrend
    else:
        signal = base_ok & (close > bb_mid) & prev_uptrend

    return np.where(signal)[0]


def find_signals_momentum(df: pd.DataFrame, strategy, direction: str = "long") -> np.ndarray:
    """
    Vectorized signal detection for Momentum Breakout strategy.

    Conditions at signal bar (idx), entry at idx+1:
    - close[idx] > highest_20[idx]: breakout (highest_20 already shifted by 1 in calculate_indicators)
    - vol_ratio[idx] >= volume_ratio: volume confirmation
    - uptrend[idx]: EMA20 > EMA50
    - hour[idx+1] not in avoid_hours: time filter on entry bar
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    close = col("close")
    highest_20 = col("highest_20")
    vol_ratio = col("vol_ratio")
    uptrend = col("uptrend", np.zeros(n, dtype=bool))
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.ema_slow + strategy.breakout_lookback
    valid_range = np.arange(n) >= min_idx

    # Breakout: close > highest_20 (highest_20 is already shifted by 1 in calculate_indicators)
    highest_valid = ~np.isnan(highest_20) & (highest_20 > 0)
    has_breakout = highest_valid & (close > highest_20)

    # Volume filter
    has_volume = vol_ratio >= strategy.volume_ratio

    # Uptrend filter
    has_uptrend = uptrend.astype(bool)

    # Time filter (check entry bar = idx+1 hour)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        next_hour = np.roll(hour, -1)
        next_hour[-1] = 0
        for h in avoid_set:
            next_hour_ok &= (next_hour != h)
    next_hour_ok[-1] = False  # Can't enter on last bar

    # avoid_months filter (entry bar = idx+1 month)
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[-1] = False

    # ATR volatility regime filter
    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    # Combine all conditions
    signal = valid_range & has_breakout & has_volume & has_uptrend & next_hour_ok & next_month_ok & vol_regime_ok

    # For "short" direction (unlikely but for completeness), no signals
    if direction != "long":
        return np.array([], dtype=int)

    return np.where(signal)[0]


def find_signals_hv_squeeze(df: pd.DataFrame, strategy, direction: str = "short") -> np.ndarray:
    """
    Vectorized signal detection for HV Squeeze strategy.

    Conditions at signal bar (idx), entry at idx+1:
    - Recent squeeze in past squeeze_lookback candles
    - BB width expanding (curr > prev)
    - Volume >= volume_ratio (prev candle)
    - Price vs BB mid + prev candle color matches direction
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    is_squeeze = col("is_squeeze", np.zeros(n, dtype=bool))
    bb_width = col("bb_width")
    bb_mid = col("bb_mid")
    vol_ratio = col("vol_ratio")
    is_bullish = col("is_bullish", np.zeros(n, dtype=bool))
    is_bearish = col("is_bearish", np.zeros(n, dtype=bool))
    close = col("close")
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.bb_period + strategy.squeeze_lookback + 1

    # Recent squeeze: rolling any() over squeeze_lookback window
    squeeze_bool = is_squeeze.astype(float)
    squeeze_rolling = pd.Series(squeeze_bool).rolling(strategy.squeeze_lookback, min_periods=1).sum().values
    has_recent_squeeze = np.roll(squeeze_rolling > 0, 1)
    has_recent_squeeze[0] = False

    # BB width expanding
    prev_bb_width = np.roll(bb_width, 1)
    prev_bb_width[0] = np.nan
    has_expanding = bb_width > prev_bb_width

    # Volume filter (prev candle)
    prev_vol = np.roll(vol_ratio, 1)
    prev_vol[0] = 0
    has_volume = prev_vol >= strategy.volume_ratio

    # Prev candle color
    prev_bullish = np.roll(is_bullish, 1)
    prev_bullish[0] = False
    prev_bearish = np.roll(is_bearish, 1)
    prev_bearish[0] = False

    # NaN guards
    valid_bb = ~np.isnan(bb_width) & ~np.isnan(bb_mid) & (bb_mid > 0)
    valid_range = np.arange(n) >= min_idx

    # Time filter (check entry bar = idx+1 hour)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        next_hour = np.roll(hour, -1)
        next_hour[-1] = 0
        for h in avoid_set:
            next_hour_ok &= (next_hour != h)
    next_hour_ok[-1] = False

    # avoid_months filter (entry bar = idx+1 month)
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[-1] = False

    # ATR volatility regime filter
    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    # Base conditions
    base_ok = valid_range & has_recent_squeeze & has_expanding & has_volume & valid_bb & next_hour_ok & next_month_ok & vol_regime_ok

    # Direction
    if direction == "long":
        signal = base_ok & (close > bb_mid) & prev_bullish
    elif direction == "short":
        signal = base_ok & (close < bb_mid) & prev_bearish
    else:
        # both: combine
        signal_long = base_ok & (close > bb_mid) & prev_bullish
        signal_short = base_ok & (close < bb_mid) & prev_bearish
        signal = signal_long | signal_short

    return np.where(signal)[0]


def find_signals_atr_breakout(df: pd.DataFrame, strategy, direction: str = "long") -> np.ndarray:
    """
    Vectorized signal detection for ATR Breakout strategy.

    Uses pre-computed breakout_up/breakout_down columns (already shifted).
    Optional EMA trend filter via uptrend/downtrend.
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    breakout_up = col("breakout_up", np.zeros(n, dtype=bool)).astype(bool)
    breakout_down = col("breakout_down", np.zeros(n, dtype=bool)).astype(bool)
    uptrend = col("uptrend", np.zeros(n, dtype=bool)).astype(bool)
    downtrend = col("downtrend", np.zeros(n, dtype=bool)).astype(bool)
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.ema_slow + strategy.atr_period + 2
    valid_range = np.arange(n) >= min_idx

    # Time filter
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        next_hour = np.roll(hour, -1)
        next_hour[-1] = 0
        for h in avoid_set:
            next_hour_ok &= (next_hour != h)
    next_hour_ok[-1] = False

    # avoid_months filter (entry bar = idx+1 month)
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[-1] = False

    # ATR volatility regime filter
    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    base = valid_range & next_hour_ok & next_month_ok & vol_regime_ok

    if strategy.use_trend_filter:
        signal_long = base & breakout_up & uptrend
        signal_short = base & breakout_down & downtrend
    else:
        signal_long = base & breakout_up
        signal_short = base & breakout_down

    if direction == "long":
        signal = signal_long
    elif direction == "short":
        signal = signal_short
    else:
        signal = signal_long | signal_short

    return np.where(signal)[0]


def find_signals_rsi_divergence(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for RSI Divergence strategy.

    LONG: RSI < oversold + 가격 신저점 + RSI는 lookback 내 RSI min보다 높음
    SHORT: RSI > overbought + 가격 신고점 + RSI는 lookback 내 RSI max보다 낮음

    lookback 롤링 통계를 shift(1)로 계산해 look-ahead 방지.
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    close = col("close")
    rsi = col("rsi")
    hour = col("hour", np.zeros(n, dtype=int))

    lookback = strategy.lookback
    min_idx = strategy.rsi_period + lookback
    valid_range = np.arange(n) >= min_idx

    # Rolling min/max over lookback window (shift=1: 현재 캔들 제외)
    rsi_series = pd.Series(rsi)
    close_series = pd.Series(close)

    # shift(1)한 뒤 rolling: 현재 idx 제외하고 이전 lookback 캔들의 통계
    rsi_min_prev = rsi_series.shift(1).rolling(lookback, min_periods=1).min().values
    rsi_max_prev = rsi_series.shift(1).rolling(lookback, min_periods=1).max().values
    close_min_prev = close_series.shift(1).rolling(lookback, min_periods=1).min().values
    close_max_prev = close_series.shift(1).rolling(lookback, min_periods=1).max().values

    valid_rsi = ~np.isnan(rsi) & ~np.isnan(rsi_min_prev) & ~np.isnan(rsi_max_prev)

    # LONG conditions
    is_oversold = rsi < strategy.oversold
    price_new_low = close < close_min_prev
    rsi_diverge_up = rsi > rsi_min_prev  # RSI는 이전 최저보다 높음
    long_cond = valid_range & valid_rsi & is_oversold & price_new_low & rsi_diverge_up

    # SHORT conditions
    is_overbought = rsi > strategy.overbought
    price_new_high = close > close_max_prev
    rsi_diverge_down = rsi < rsi_max_prev  # RSI는 이전 최고보다 낮음
    short_cond = valid_range & valid_rsi & is_overbought & price_new_high & rsi_diverge_down

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_macd_cross(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for MACD Cross strategy.

    LONG: macd_cross_up (골든크로스) + macd_line < 0
    SHORT: macd_cross_down (데드크로스) + macd_line > 0
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    macd_line = col("macd_line")
    macd_hist = col("macd_hist")
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.slow + strategy.signal + 1
    valid_range = np.arange(n) >= min_idx

    # 교차 감지: hist 부호 전환 (shift=1로 prev hist)
    prev_hist = np.roll(macd_hist, 1)
    prev_hist[0] = 0.0
    cross_up = (prev_hist < 0) & (macd_hist > 0)    # 골든크로스
    cross_down = (prev_hist > 0) & (macd_hist < 0)  # 데드크로스

    valid_macd = ~np.isnan(macd_line) & ~np.isnan(macd_hist)

    long_cond = valid_range & valid_macd & cross_up & (macd_line < 0)
    short_cond = valid_range & valid_macd & cross_down & (macd_line > 0)

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_donchian_breakout(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for Donchian Breakout strategy.

    LONG: close > dc_upper (채널 상단 돌파)
    SHORT: close < dc_lower (채널 하단 이탈)

    dc_upper/dc_lower는 calculate_indicators에서 shift(1) 적용됨.
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    close = col("close")
    dc_upper = col("dc_upper")
    dc_lower = col("dc_lower")
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.channel_period + 1
    valid_range = np.arange(n) >= min_idx

    valid_dc = ~np.isnan(dc_upper) & ~np.isnan(dc_lower) & (dc_upper > 0) & (dc_lower > 0)

    long_cond = valid_range & valid_dc & (close > dc_upper)
    short_cond = valid_range & valid_dc & (close < dc_lower)

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_mean_reversion(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for Mean Reversion strategy.

    LONG: close < band_lower + rsi < rsi_oversold
    SHORT: close > band_upper + rsi > rsi_overbought
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    close = col("close")
    band_upper = col("band_upper")
    band_lower = col("band_lower")
    rsi = col("rsi")
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = max(strategy.sma_period, strategy.rsi_period) + 1
    valid_range = np.arange(n) >= min_idx

    valid_bands = ~np.isnan(band_upper) & ~np.isnan(band_lower) & ~np.isnan(rsi)

    long_cond = valid_range & valid_bands & (close < band_lower) & (rsi < strategy.rsi_oversold)
    short_cond = valid_range & valid_bands & (close > band_upper) & (rsi > strategy.rsi_overbought)

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_supertrend(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for SuperTrend strategy.

    LONG: st_cross_up (SuperTrend 상향 전환)
    SHORT: st_cross_down (SuperTrend 하향 전환)
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    supertrend = col("supertrend")
    cross_up = col("st_cross_up", np.zeros(n, dtype=bool)).astype(bool)
    cross_down = col("st_cross_down", np.zeros(n, dtype=bool)).astype(bool)
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.atr_period * 2
    valid_range = np.arange(n) >= min_idx

    valid_st = ~np.isnan(supertrend)

    long_cond = valid_range & valid_st & cross_up
    short_cond = valid_range & valid_st & cross_down

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_keltner_squeeze(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for Keltner Squeeze strategy.

    스퀴즈 해소 + 방향성 돌파:
    LONG: squeeze_release + close > kc_upper
    SHORT: squeeze_release + close < kc_lower
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    close = col("close")
    kc_upper = col("kc_upper")
    kc_lower = col("kc_lower")
    squeeze_release = col("squeeze_release", np.zeros(n, dtype=bool)).astype(bool)
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = max(strategy.kc_period, strategy.bb_period, strategy.atr_period) + 2
    valid_range = np.arange(n) >= min_idx

    valid_kc = ~np.isnan(kc_upper) & ~np.isnan(kc_lower) & ~np.isnan(close)

    long_cond = valid_range & valid_kc & squeeze_release & (close > kc_upper)
    short_cond = valid_range & valid_kc & squeeze_release & (close < kc_lower)

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_stochastic_rsi(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for Stochastic RSI strategy.

    LONG: stochrsi_k < oversold + golden cross (%K crosses above %D)
    SHORT: stochrsi_k > overbought + death cross (%K crosses below %D)

    교차 감지: shift(1)로 prev bar 비교 → look-ahead 없음.
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    k = col("stochrsi_k")
    d = col("stochrsi_d")
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.rsi_period + strategy.stoch_period + strategy.k_smooth + strategy.d_smooth
    valid_range = np.arange(n) >= min_idx

    # prev bar (shift 1)
    prev_k = np.roll(k, 1)
    prev_k[0] = np.nan
    prev_d = np.roll(d, 1)
    prev_d[0] = np.nan

    valid_vals = ~np.isnan(k) & ~np.isnan(d) & ~np.isnan(prev_k) & ~np.isnan(prev_d)

    # Golden Cross: prev_k < prev_d AND curr_k > curr_d
    golden_cross = (prev_k < prev_d) & (k > d)
    # Death Cross: prev_k > prev_d AND curr_k < curr_d
    death_cross = (prev_k > prev_d) & (k < d)

    long_cond = valid_range & valid_vals & (k < strategy.oversold) & golden_cross
    short_cond = valid_range & valid_vals & (k > strategy.overbought) & death_cross

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_ma_cross(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for MA Cross strategy.

    LONG: ma_cross_up (Golden Cross — fast EMA crosses above slow EMA)
    SHORT: ma_cross_down (Death Cross — fast EMA crosses below slow EMA)

    교차 열은 calculate_indicators에서 shift(1) 기반으로 이미 계산됨.
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    ma_fast = col("ma_fast")
    ma_slow = col("ma_slow")
    cross_up = col("ma_cross_up", np.zeros(n, dtype=bool)).astype(bool)
    cross_down = col("ma_cross_down", np.zeros(n, dtype=bool)).astype(bool)
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.slow_period + 1
    valid_range = np.arange(n) >= min_idx

    valid_ma = ~np.isnan(ma_fast) & ~np.isnan(ma_slow)

    long_cond = valid_range & valid_ma & cross_up
    short_cond = valid_range & valid_ma & cross_down

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_adx_trend(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for ADX Trend strategy.

    LONG: ADX > threshold + di_plus > di_minus + di_cross_up
    SHORT: ADX > threshold + di_minus > di_plus + di_cross_down

    교차 열은 calculate_indicators에서 shift(1) 기반으로 이미 계산됨.
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    adx = col("adx")
    di_plus = col("di_plus")
    di_minus = col("di_minus")
    cross_up = col("di_cross_up", np.zeros(n, dtype=bool)).astype(bool)
    cross_down = col("di_cross_down", np.zeros(n, dtype=bool)).astype(bool)
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.adx_period * 3
    valid_range = np.arange(n) >= min_idx

    valid_adx = ~np.isnan(adx) & ~np.isnan(di_plus) & ~np.isnan(di_minus)
    strong_trend = adx > strategy.adx_threshold

    long_cond = valid_range & valid_adx & strong_trend & (di_plus > di_minus) & cross_up
    short_cond = valid_range & valid_adx & strong_trend & (di_minus > di_plus) & cross_down

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_ichimoku(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for Ichimoku Cloud strategy.

    LONG: close > cloud_top + tk_cross_up (Tenkan crosses above Kijun)
    SHORT: close < cloud_bottom + tk_cross_down (Tenkan crosses below Kijun)

    cloud_top/bottom은 calculate_indicators에서 shift(kijun) 적용으로 look-ahead 없음.
    tk_cross 열은 shift(1) 기반으로 계산됨.
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    close = col("close")
    cloud_top = col("cloud_top")
    cloud_bottom = col("cloud_bottom")
    cross_up = col("tk_cross_up", np.zeros(n, dtype=bool)).astype(bool)
    cross_down = col("tk_cross_down", np.zeros(n, dtype=bool)).astype(bool)
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.senkou_b + strategy.kijun + 1
    valid_range = np.arange(n) >= min_idx

    valid_cloud = ~np.isnan(cloud_top) & ~np.isnan(cloud_bottom) & ~np.isnan(close)

    long_cond = valid_range & valid_cloud & (close > cloud_top) & cross_up
    short_cond = valid_range & valid_cloud & (close < cloud_bottom) & cross_down

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_heikin_ashi(df: pd.DataFrame, strategy, direction: str = "both") -> np.ndarray:
    """
    Vectorized signal detection for Heikin Ashi Trend strategy.

    LONG: ha_consec_bull >= 1 (N연속 양봉) + lower wick 없음
    SHORT: ha_consec_bear >= 1 (N연속 음봉) + upper wick 없음

    ha_consec_bull/bear은 rolling min으로 모든 캔들이 bull/bear인지 확인.
    wick 판정은 현재 캔들 기준 (완성 캔들이므로 look-ahead 아님).
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    consec_bull = col("ha_consec_bull")
    consec_bear = col("ha_consec_bear")
    has_lower_wick = col("ha_has_lower_wick", np.ones(n, dtype=bool)).astype(bool)
    has_upper_wick = col("ha_has_upper_wick", np.ones(n, dtype=bool)).astype(bool)
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.consecutive + 1
    valid_range = np.arange(n) >= min_idx

    valid_ha = ~np.isnan(consec_bull) & ~np.isnan(consec_bear)

    long_cond = valid_range & valid_ha & (consec_bull >= 1) & ~has_lower_wick
    short_cond = valid_range & valid_ha & (consec_bear >= 1) & ~has_upper_wick

    # Time filter (entry bar = idx+1)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            if int(hour[i + 1]) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False

    # avoid_months filter
    avoid_months_set = set(getattr(strategy, 'avoid_months', None) or [])
    next_month_ok = np.ones(n, dtype=bool)
    if avoid_months_set and "timestamp" in df.columns:
        months = pd.to_datetime(df["timestamp"]).dt.month.values
        next_months = np.empty(n, dtype=int)
        next_months[:-1] = months[1:]
        next_months[-1] = 0
        for m in avoid_months_set:
            next_month_ok &= (next_months != m)
    next_month_ok[n - 1] = False

    min_vol_regime = getattr(strategy, 'min_vol_regime', None)
    vol_regime_ok = _compute_vol_regime_filter(df, n, min_vol_regime)

    filters = next_hour_ok & next_month_ok & vol_regime_ok

    if direction == "long":
        signal = long_cond & filters
    elif direction == "short":
        signal = short_cond & filters
    else:
        signal = (long_cond | short_cond) & filters

    return np.where(signal)[0]


def find_signals_volume_profile(df: pd.DataFrame, strategy, direction: str) -> np.ndarray:
    """Volume Profile POC reversion — uses pre-computed signal + deviation columns."""
    n = len(df)
    if n < 200 or "signal" not in df.columns or "vp_deviation" not in df.columns:
        return np.array([], dtype=int)

    signal = df["signal"].values.astype(bool)
    deviation = df["vp_deviation"].values

    # SHORT when deviation > 0 (price above POC), LONG when < 0
    if direction == "short":
        cond = signal & (deviation > 0)
    elif direction == "long":
        cond = signal & (deviation < 0)
    else:  # both
        cond = signal & (deviation != 0)

    # Apply avoid_hours filter
    avoid_hours = getattr(strategy, 'avoid_hours', [])
    if avoid_hours and "timestamp" in df.columns:
        hours = pd.to_datetime(df["timestamp"]).dt.hour.values
        next_hours = np.roll(hours, -1)
        next_hours[-1] = 0
        for h in avoid_hours:
            cond &= (next_hours != h)

    return np.where(cond)[0]


def find_signals_generic(df: pd.DataFrame, strategy, direction: str) -> np.ndarray:
    """
    Generic signal detection fallback — calls strategy.check_signal() per bar.
    ~5x slower than vectorized but works for any strategy.
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    signals = []
    for idx in range(n - 1):
        result = strategy.check_signal(df, idx)
        if result == direction or (direction == "both" and result in ("long", "short")):
            signals.append(idx)

    return np.array(signals, dtype=int) if signals else np.array([], dtype=int)


def simulate_vectorized(
    df: pd.DataFrame,
    signal_indices: np.ndarray,
    sl_pct: float,
    tp_pct: float,
    max_bars: int,
    fee_pct: float,
    slippage_pct: float,
    direction: str,
    symbol: str,
    funding_rate_8h: float = 0.0001,
    timeframe: str = "1H",
) -> List[Trade]:
    """
    Vectorized simulation — given signal indices, process trades.
    Still sequential (no overlapping positions) but inner exit search is optimized.
    """
    direction = direction.lower() if direction else "short"

    if len(signal_indices) == 0 or len(df) < 10:
        return []

    # Pre-extract arrays for fast access
    opens = df["open"].values.astype(float)
    highs = df["high"].values.astype(float)
    lows = df["low"].values.astype(float)
    closes = df["close"].values.astype(float)
    times = df["timestamp"].values

    n = len(df)
    trades = []
    next_available = 0  # Earliest bar we can enter

    for sig_idx in signal_indices:
        entry_idx = sig_idx + 1
        if entry_idx >= n or entry_idx < next_available:
            continue

        entry_price = opens[entry_idx]
        if direction == "short":
            entry_price *= (1 - slippage_pct)
            sl_price = entry_price * (1 + sl_pct)
            tp_price = entry_price * (1 - tp_pct)
        else:
            entry_price *= (1 + slippage_pct)
            sl_price = entry_price * (1 - sl_pct)
            tp_price = entry_price * (1 + tp_pct)

        # Search for exit within max_bars
        exit_idx = None
        exit_price = None
        exit_reason = None

        end_idx = min(entry_idx + max_bars, n)

        for j in range(entry_idx, end_idx):
            if direction == "short":
                sl_hit = highs[j] >= sl_price
                tp_hit = lows[j] <= tp_price
            else:
                sl_hit = lows[j] <= sl_price
                tp_hit = highs[j] >= tp_price

            if sl_hit and tp_hit:
                # Conservative: SL wins
                exit_idx = j
                exit_price = sl_price
                exit_reason = "sl"
                break
            elif sl_hit:
                exit_idx = j
                exit_price = sl_price
                exit_reason = "sl"
                break
            elif tp_hit:
                exit_idx = j
                exit_price = tp_price
                exit_reason = "tp"
                break

        if exit_idx is None:
            # Timeout
            exit_idx = end_idx - 1 if end_idx - 1 < n else n - 1
            exit_price = closes[exit_idx]
            exit_reason = "timeout"

        # Apply exit slippage
        if direction == "short":
            exit_price_adj = exit_price * (1 + slippage_pct)
            pnl_gross = (entry_price - exit_price_adj) / entry_price
        else:
            exit_price_adj = exit_price * (1 - slippage_pct)
            pnl_gross = (exit_price_adj - entry_price) / entry_price

        fee = fee_pct * 2
        bars_held = exit_idx - entry_idx
        tf_hours = {"1H": 1, "2H": 2, "4H": 4, "6H": 6, "8H": 8, "12H": 12, "1D": 24}.get(timeframe.upper(), 1)
        funding_payments = (bars_held * tf_hours) // 8
        # SHORT receives positive funding; LONG pays
        if direction == "short":
            funding_cost = -(funding_payments * funding_rate_8h)  # income
        else:
            funding_cost = funding_payments * funding_rate_8h      # expense
        pnl_net = pnl_gross - fee - funding_cost

        trades.append(Trade(
            symbol=symbol,
            direction=direction,
            entry_time=str(times[entry_idx]),
            exit_time=str(times[exit_idx]),
            entry_price=entry_price,
            exit_price=exit_price,
            pnl_pct=round(pnl_net * 100, 4),
            pnl_gross_pct=round(pnl_gross * 100, 4),
            fee_pct=round(fee * 100, 4),
            funding_pct=round(funding_cost * 100, 4),
            exit_reason=exit_reason,
            bars_held=bars_held,
        ))

        next_available = exit_idx + 1

    return trades


def run_fast(
    df: pd.DataFrame,
    strategy,
    symbol: str,
    sl_pct: float = 0.10,
    tp_pct: float = 0.08,
    max_bars: int = 48,
    fee_pct: float = 0.0008,
    slippage_pct: float = 0.0002,
    direction: str = "short",
    market_type: str = "futures",
    strategy_id: str = None,
    funding_rate_8h: float = 0.0001,
    timeframe: str = "1H",
) -> SimResult:
    """Complete fast simulation pipeline."""

    # Find signals: use vectorized implementations where available
    if strategy_id in ("bb-squeeze-short", "bb-squeeze-long", None):
        signal_indices = find_signals_vectorized(df, strategy, direction)
    elif strategy_id == "momentum-long":
        signal_indices = find_signals_momentum(df, strategy, direction)
    elif strategy_id == "hv-squeeze":
        signal_indices = find_signals_hv_squeeze(df, strategy, direction)
    elif strategy_id == "atr-breakout":
        signal_indices = find_signals_atr_breakout(df, strategy, direction)
    elif strategy_id == "rsi-divergence":
        signal_indices = find_signals_rsi_divergence(df, strategy, direction)
    elif strategy_id == "macd-cross":
        signal_indices = find_signals_macd_cross(df, strategy, direction)
    elif strategy_id == "donchian-breakout":
        signal_indices = find_signals_donchian_breakout(df, strategy, direction)
    elif strategy_id == "mean-reversion":
        signal_indices = find_signals_mean_reversion(df, strategy, direction)
    elif strategy_id == "supertrend":
        signal_indices = find_signals_supertrend(df, strategy, direction)
    elif strategy_id == "keltner-squeeze":
        signal_indices = find_signals_keltner_squeeze(df, strategy, direction)
    elif strategy_id == "stochastic-rsi":
        signal_indices = find_signals_stochastic_rsi(df, strategy, direction)
    elif strategy_id == "ma-cross":
        signal_indices = find_signals_ma_cross(df, strategy, direction)
    elif strategy_id == "adx-trend":
        signal_indices = find_signals_adx_trend(df, strategy, direction)
    elif strategy_id == "ichimoku":
        signal_indices = find_signals_ichimoku(df, strategy, direction)
    elif strategy_id == "heikin-ashi":
        signal_indices = find_signals_heikin_ashi(df, strategy, direction)
    elif strategy_id == "volume-profile":
        signal_indices = find_signals_volume_profile(df, strategy, direction)
    else:
        signal_indices = find_signals_generic(df, strategy, direction)

    # Simulate trades
    trades = simulate_vectorized(
        df, signal_indices,
        sl_pct, tp_pct, max_bars,
        fee_pct, slippage_pct,
        direction, symbol,
        funding_rate_8h=funding_rate_8h,
        timeframe=timeframe,
    )

    # Build result
    if not trades:
        return SimResult(
            strategy_name=strategy.name, symbol=symbol,
            params=strategy.get_params(), market_type=market_type,
            total_trades=0, wins=0, losses=0, win_rate=0,
            total_return_pct=0, profit_factor=0,
            avg_win_pct=0, avg_loss_pct=0,
            max_drawdown_pct=0, max_consecutive_losses=0,
            total_fees_pct=0, total_funding_pct=0, tp_count=0, sl_count=0, timeout_count=0,
        )

    wins = [t for t in trades if t.pnl_pct > 0]
    losses = [t for t in trades if t.pnl_pct <= 0]
    gross_profit = sum(t.pnl_pct for t in wins) if wins else 0
    gross_loss = abs(sum(t.pnl_pct for t in losses)) if losses else 0.0
    total_return = sum(t.pnl_pct for t in trades)
    total_fees = sum(t.fee_pct for t in trades)
    total_funding = sum(t.funding_pct for t in trades)

    # MDD + consecutive
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    eq = []
    max_consec = 0
    cur_consec = 0

    for t in trades:
        equity += t.pnl_pct
        peak = max(peak, equity)
        dd_pct = (peak - equity) / peak * 100 if peak > 0 else 0.0  # % of peak (industry standard)
        dd_pct = min(dd_pct, 100.0)  # Cap at 100%
        max_dd = max(max_dd, dd_pct)
        eq.append(round(equity, 2))

        if t.pnl_pct <= 0:
            cur_consec += 1
            max_consec = max(max_consec, cur_consec)
        else:
            cur_consec = 0

    # Risk-adjusted metrics — daily-return based (annualized with sqrt(365))
    from collections import defaultdict as _dd
    daily_pnl = _dd(float)
    for t in trades:
        day_key = t.exit_time[:10]  # YYYY-MM-DD
        if day_key and day_key != "NaT" and len(day_key) == 10:
            daily_pnl[day_key] += t.pnl_pct
    daily_returns = np.array(list(daily_pnl.values())) if daily_pnl else np.array([])

    if len(daily_returns) >= 5:
        dr_avg = float(np.mean(daily_returns))
        dr_std = float(np.std(daily_returns, ddof=1))
        sharpe = round(dr_avg / dr_std * np.sqrt(365), 2) if dr_std > 0 else 0.0
        # TDD Sortino (Sortino & van der Meer 1991): sqrt(mean(min(r,0)^2)) over ALL observations
        downside = np.minimum(daily_returns, 0)
        tdd = float(np.sqrt(np.mean(downside ** 2)))
        sortino = round(dr_avg / tdd * np.sqrt(365), 2) if tdd > 0 else 0.0
        # Calmar: CAGR / MDD (CAGR = compound annualized growth rate)
        # Use calendar days (not trade days) for accurate annualization
        sorted_days_fast = sorted(daily_pnl.keys())
        from datetime import datetime as _dt_calmar_fast
        n_calendar_days = (_dt_calmar_fast.strptime(sorted_days_fast[-1], "%Y-%m-%d") - _dt_calmar_fast.strptime(sorted_days_fast[0], "%Y-%m-%d")).days + 1
        # equity starts at 0, so final = total_return (pct points). Convert to growth ratio.
        growth_ratio = (equity + 100) / 100 if equity > -100 else 0.001  # avoid <=0
        years = max(n_calendar_days, 1) / 365
        cagr_pct = (growth_ratio ** (1 / years) - 1) * 100 if years > 0 else 0.0
        calmar = round(cagr_pct / max_dd, 2) if max_dd > 0 else 0.0
    else:
        sharpe, sortino, calmar = 0.0, 0.0, 0.0

    return SimResult(
        strategy_name=strategy.name, symbol=symbol,
        params=strategy.get_params(), market_type=market_type,
        total_trades=len(trades),
        wins=len(wins), losses=len(losses),
        win_rate=round(len(wins) / len(trades) * 100, 2),
        total_return_pct=round(total_return, 2),
        profit_factor=round(gross_profit / gross_loss, 2) if gross_loss > 0 else (999.99 if gross_profit > 0 else 0.0),
        avg_win_pct=round(sum(t.pnl_pct for t in wins) / len(wins), 4) if wins else 0,
        avg_loss_pct=round(sum(t.pnl_pct for t in losses) / len(losses), 4) if losses else 0,
        max_drawdown_pct=round(max_dd, 2),
        max_consecutive_losses=max_consec,
        total_fees_pct=round(total_fees, 2),
        total_funding_pct=round(total_funding, 2),
        tp_count=sum(1 for t in trades if t.exit_reason == "tp"),
        sl_count=sum(1 for t in trades if t.exit_reason == "sl"),
        timeout_count=sum(1 for t in trades if t.exit_reason == "timeout"),
        sharpe_ratio=sharpe,
        sortino_ratio=sortino,
        calmar_ratio=calmar,
        trades=trades,
        equity_curve=eq,
    )
