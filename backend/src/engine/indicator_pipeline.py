"""
PRUVIQ IndicatorPipeline - Dynamic indicator computation.

Computes only the indicators requested by user strategy JSON.
Supports: BB, EMA, ATR, HV, Volume, Candle, RSI, MACD, Stochastic, ADX, Price Action,
Ichimoku, Parabolic SAR, Williams %R.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Set


# Registry of available indicators and their computed fields
INDICATOR_REGISTRY = {
    "bb": {
        "name": "Bollinger Bands",
        "fields": ["bb_upper", "bb_lower", "bb_mid", "bb_width", "bb_width_ma",
                    "bb_width_change", "is_squeeze", "recent_squeeze",
                    "bb_expanding", "bb_width_above_ma"],
        "default_params": {"period": 20, "std": 2.0, "squeeze_lookback": 10,
                           "squeeze_threshold": 0.8, "expansion_threshold": 0.9},
    },
    "ema": {
        "name": "EMA Trend",
        "fields": ["ema_fast", "ema_slow", "uptrend", "downtrend"],
        "default_params": {"fast": 20, "slow": 50},
    },
    "volume": {
        "name": "Volume Analysis",
        "fields": ["vol_ma", "vol_ratio"],
        "default_params": {"ma_period": 10},
    },
    "candle": {
        "name": "Candle Pattern",
        "fields": ["bullish", "bearish", "doji"],
        "default_params": {"doji_threshold": 0.1},
    },
    "atr": {
        "name": "ATR",
        "fields": ["atr", "atr_upper", "atr_lower"],
        "default_params": {"period": 14, "multiplier": 2.0},
    },
    "hv": {
        "name": "Historical Volatility",
        "fields": ["hv", "hv_ma", "hv_squeeze", "hv_percentile"],
        "default_params": {"period": 20, "ma_period": 50},
    },
    "rsi": {
        "name": "RSI",
        "fields": ["rsi", "rsi_oversold", "rsi_overbought"],
        "default_params": {"period": 14, "oversold": 30, "overbought": 70},
    },
    "macd": {
        "name": "MACD",
        "fields": ["macd", "macd_signal", "macd_histogram", "macd_crossover"],
        "default_params": {"fast": 12, "slow": 26, "signal": 9},
    },
    "stochastic": {
        "name": "Stochastic",
        "fields": ["stoch_k", "stoch_d", "stoch_oversold", "stoch_overbought"],
        "default_params": {"k_period": 14, "d_period": 3, "oversold": 20, "overbought": 80},
    },
    "adx": {
        "name": "ADX",
        "fields": ["adx", "plus_di", "minus_di", "strong_trend"],
        "default_params": {"period": 14, "threshold": 25},
    },
    "price_action": {
        "name": "Price Action",
        "fields": ["close_vs_high_20", "close_vs_low_20", "breakout_up", "breakout_down"],
        "default_params": {"lookback": 20},
    },
    "ichimoku": {
        "name": "Ichimoku Cloud",
        "fields": ["tenkan", "kijun", "senkou_a", "senkou_b",
                    "above_cloud", "below_cloud", "in_cloud",
                    "tk_cross_bull", "tk_cross_bear",
                    "cloud_green", "cloud_red"],
        "default_params": {"tenkan_period": 9, "kijun_period": 26, "senkou_b_period": 52},
    },
    "psar": {
        "name": "Parabolic SAR",
        "fields": ["psar", "psar_bull", "psar_bear", "psar_reversal_bull", "psar_reversal_bear"],
        "default_params": {"af_start": 0.02, "af_step": 0.02, "af_max": 0.2},
    },
    "williams_r": {
        "name": "Williams %R",
        "fields": ["williams_r", "wr_oversold", "wr_overbought",
                    "wr_exit_oversold", "wr_exit_overbought"],
        "default_params": {"period": 14, "oversold": -80, "overbought": -20},
    },
}


def get_available_indicators() -> Dict:
    """Return all available indicators with their fields and default params."""
    return INDICATOR_REGISTRY


def get_required_indicators(conditions: List[dict]) -> Set[str]:
    """Extract which indicators are needed from a list of conditions."""
    needed = set()
    for cond in conditions:
        if "indicator" in cond:
            needed.add(cond["indicator"])
        if "conditions" in cond:  # Nested AND/OR
            needed |= get_required_indicators(cond["conditions"])
    return needed


def compute_indicators(
    df: pd.DataFrame,
    indicators: Set[str],
    params: Optional[Dict[str, dict]] = None,
) -> pd.DataFrame:
    """
    Compute only the requested indicators on OHLCV data.

    Args:
        df: DataFrame with columns: timestamp, open, high, low, close, volume
        indicators: Set of indicator IDs to compute (e.g., {"bb", "ema", "volume"})
        params: Optional per-indicator parameter overrides

    Returns:
        DataFrame with indicator columns added
    """
    df = df.copy()
    params = params or {}

    # Add hour column if not present (for time filter)
    if "hour" not in df.columns and "timestamp" in df.columns:
        df["hour"] = pd.to_datetime(df["timestamp"]).dt.hour

    for ind_id in indicators:
        if ind_id not in INDICATOR_REGISTRY:
            continue
        p = {**INDICATOR_REGISTRY[ind_id]["default_params"], **(params.get(ind_id, {}))}
        _COMPUTE_FUNCS[ind_id](df, p)

    return df


# --- Individual indicator compute functions ---

def _compute_bb(df: pd.DataFrame, p: dict):
    period = p["period"]
    std_mult = p["std"]
    squeeze_lookback = p["squeeze_lookback"]
    threshold = p["squeeze_threshold"]
    expansion_threshold = p.get("expansion_threshold", 0.9)

    df["bb_mid"] = df["close"].rolling(period).mean()
    bb_std = df["close"].rolling(period).std()
    df["bb_upper"] = df["bb_mid"] + std_mult * bb_std
    df["bb_lower"] = df["bb_mid"] - std_mult * bb_std
    df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / df["bb_mid"] * 100
    df["bb_width_ma"] = df["bb_width"].rolling(squeeze_lookback).mean()
    df["bb_width_change"] = df["bb_width"].pct_change() * 100
    df["is_squeeze"] = df["bb_width"] < df["bb_width_ma"] * threshold

    # AutoTrader parity: rolling window squeeze detection
    df["recent_squeeze"] = df["is_squeeze"].rolling(squeeze_lookback).max().astype(bool)
    # AutoTrader parity: band width expanding (curr > prev)
    df["bb_expanding"] = df["bb_width"] > df["bb_width"].shift(1)
    # AutoTrader parity: width above MA threshold
    df["bb_width_above_ma"] = df["bb_width"] > df["bb_width_ma"] * expansion_threshold


def _compute_ema(df: pd.DataFrame, p: dict):
    df["ema_fast"] = df["close"].ewm(span=p["fast"], adjust=False).mean()
    df["ema_slow"] = df["close"].ewm(span=p["slow"], adjust=False).mean()
    df["uptrend"] = df["ema_fast"] > df["ema_slow"]
    df["downtrend"] = df["ema_fast"] < df["ema_slow"]


def _compute_volume(df: pd.DataFrame, p: dict):
    df["vol_ma"] = df["volume"].rolling(p["ma_period"]).mean()
    df["vol_ratio"] = np.where(df["vol_ma"] > 0, df["volume"] / df["vol_ma"], 0)


def _compute_candle(df: pd.DataFrame, p: dict):
    body = abs(df["close"] - df["open"])
    total_range = df["high"] - df["low"]
    df["bullish"] = df["close"] > df["open"]
    df["bearish"] = df["close"] < df["open"]
    df["doji"] = np.where(total_range > 0, body / total_range, 0) < p["doji_threshold"]


def _compute_atr(df: pd.DataFrame, p: dict):
    high = df["high"]
    low = df["low"]
    close = df["close"]
    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low - close.shift(1)).abs(),
    ], axis=1).max(axis=1)
    df["atr"] = tr.rolling(p["period"]).mean()
    df["atr_upper"] = close + df["atr"] * p["multiplier"]
    df["atr_lower"] = close - df["atr"] * p["multiplier"]


def _compute_hv(df: pd.DataFrame, p: dict):
    returns = np.log(df["close"] / df["close"].shift(1))
    df["hv"] = returns.rolling(p["period"]).std() * np.sqrt(24 * 365) * 100
    df["hv_ma"] = df["hv"].rolling(p["ma_period"]).mean()
    df["hv_squeeze"] = df["hv"] < df["hv_ma"] * 0.8
    df["hv_percentile"] = df["hv"].rolling(100).rank(pct=True)


def _compute_rsi(df: pd.DataFrame, p: dict):
    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)
    avg_gain = gain.ewm(alpha=1 / p["period"], min_periods=p["period"]).mean()
    avg_loss = loss.ewm(alpha=1 / p["period"], min_periods=p["period"]).mean()
    rs = avg_gain / avg_loss.replace(0, np.inf)
    df["rsi"] = 100 - (100 / (1 + rs))
    df["rsi_oversold"] = df["rsi"] < p["oversold"]
    df["rsi_overbought"] = df["rsi"] > p["overbought"]


def _compute_macd(df: pd.DataFrame, p: dict):
    ema_fast = df["close"].ewm(span=p["fast"], adjust=False).mean()
    ema_slow = df["close"].ewm(span=p["slow"], adjust=False).mean()
    df["macd"] = ema_fast - ema_slow
    df["macd_signal"] = df["macd"].ewm(span=p["signal"], adjust=False).mean()
    df["macd_histogram"] = df["macd"] - df["macd_signal"]
    df["macd_crossover"] = (df["macd"] > df["macd_signal"]) & (
        df["macd"].shift(1) <= df["macd_signal"].shift(1)
    )


def _compute_stochastic(df: pd.DataFrame, p: dict):
    low_min = df["low"].rolling(p["k_period"]).min()
    high_max = df["high"].rolling(p["k_period"]).max()
    denom = high_max - low_min
    df["stoch_k"] = np.where(denom > 0, (df["close"] - low_min) / denom * 100, 50)
    df["stoch_d"] = pd.Series(df["stoch_k"]).rolling(p["d_period"]).mean()
    df["stoch_oversold"] = df["stoch_k"] < p["oversold"]
    df["stoch_overbought"] = df["stoch_k"] > p["overbought"]


def _compute_adx(df: pd.DataFrame, p: dict):
    period = p["period"]
    high = df["high"]
    low = df["low"]
    close = df["close"]

    plus_dm = high.diff().clip(lower=0)
    minus_dm = (-low.diff()).clip(lower=0)
    plus_dm[plus_dm < minus_dm] = 0
    minus_dm[minus_dm < plus_dm] = 0

    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low - close.shift(1)).abs(),
    ], axis=1).max(axis=1)

    atr = tr.ewm(alpha=1 / period, min_periods=period).mean()
    df["plus_di"] = 100 * plus_dm.ewm(alpha=1 / period, min_periods=period).mean() / atr.replace(0, np.inf)
    df["minus_di"] = 100 * minus_dm.ewm(alpha=1 / period, min_periods=period).mean() / atr.replace(0, np.inf)
    dx = (df["plus_di"] - df["minus_di"]).abs() / (df["plus_di"] + df["minus_di"]).replace(0, np.inf) * 100
    df["adx"] = dx.ewm(alpha=1 / period, min_periods=period).mean()
    df["strong_trend"] = df["adx"] > p["threshold"]


def _compute_price_action(df: pd.DataFrame, p: dict):
    lookback = p["lookback"]
    high_max = df["high"].rolling(lookback).max()
    low_min = df["low"].rolling(lookback).min()
    price_range = high_max - low_min
    df["close_vs_high_20"] = np.where(
        price_range > 0, (df["close"] - low_min) / price_range, 0.5
    )
    df["close_vs_low_20"] = 1 - df["close_vs_high_20"]
    df["breakout_up"] = df["close"] > high_max.shift(1)
    df["breakout_down"] = df["close"] < low_min.shift(1)


def _compute_ichimoku(df: pd.DataFrame, p: dict):
    tenkan_period = p["tenkan_period"]
    kijun_period = p["kijun_period"]
    senkou_b_period = p["senkou_b_period"]

    # Tenkan-sen (Conversion Line): (highest high + lowest low) / 2 over tenkan_period
    tenkan_high = df["high"].rolling(tenkan_period).max()
    tenkan_low = df["low"].rolling(tenkan_period).min()
    df["tenkan"] = (tenkan_high + tenkan_low) / 2

    # Kijun-sen (Base Line): (highest high + lowest low) / 2 over kijun_period
    kijun_high = df["high"].rolling(kijun_period).max()
    kijun_low = df["low"].rolling(kijun_period).min()
    df["kijun"] = (kijun_high + kijun_low) / 2

    # Senkou Span A (Leading Span A): (Tenkan + Kijun) / 2, shifted forward by kijun_period
    # For backtesting we use current values (no forward shift) to avoid look-ahead bias
    df["senkou_a"] = (df["tenkan"] + df["kijun"]) / 2

    # Senkou Span B (Leading Span B): (highest high + lowest low) / 2 over senkou_b_period
    senkou_b_high = df["high"].rolling(senkou_b_period).max()
    senkou_b_low = df["low"].rolling(senkou_b_period).min()
    df["senkou_b"] = (senkou_b_high + senkou_b_low) / 2

    # Cloud boundaries
    cloud_top = df[["senkou_a", "senkou_b"]].max(axis=1)
    cloud_bottom = df[["senkou_a", "senkou_b"]].min(axis=1)

    # Price vs Cloud
    df["above_cloud"] = df["close"] > cloud_top
    df["below_cloud"] = df["close"] < cloud_bottom
    df["in_cloud"] = ~df["above_cloud"] & ~df["below_cloud"]

    # TK Cross (Tenkan crosses Kijun)
    df["tk_cross_bull"] = (df["tenkan"] > df["kijun"]) & (df["tenkan"].shift(1) <= df["kijun"].shift(1))
    df["tk_cross_bear"] = (df["tenkan"] < df["kijun"]) & (df["tenkan"].shift(1) >= df["kijun"].shift(1))

    # Cloud color
    df["cloud_green"] = df["senkou_a"] > df["senkou_b"]
    df["cloud_red"] = df["senkou_a"] < df["senkou_b"]


def _compute_psar(df: pd.DataFrame, p: dict):
    af_start = p["af_start"]
    af_step = p["af_step"]
    af_max = p["af_max"]

    high = df["high"].values
    low = df["low"].values
    close = df["close"].values
    n = len(high)

    psar = np.zeros(n)
    bull = np.ones(n, dtype=bool)  # True = bullish (SAR below price)
    af = np.full(n, af_start)
    ep = np.zeros(n)  # Extreme Point

    # Initialize
    psar[0] = low[0]
    ep[0] = high[0]
    bull[0] = True

    for i in range(1, n):
        prev_psar = psar[i - 1]
        prev_af = af[i - 1]
        prev_ep = ep[i - 1]
        prev_bull = bull[i - 1]

        if prev_bull:
            # Bullish SAR
            psar[i] = prev_psar + prev_af * (prev_ep - prev_psar)
            # SAR cannot be above previous two lows
            if i >= 2:
                psar[i] = min(psar[i], low[i - 1], low[i - 2])
            else:
                psar[i] = min(psar[i], low[i - 1])

            if low[i] < psar[i]:
                # Reversal to bearish
                bull[i] = False
                psar[i] = prev_ep
                ep[i] = low[i]
                af[i] = af_start
            else:
                bull[i] = True
                if high[i] > prev_ep:
                    ep[i] = high[i]
                    af[i] = min(prev_af + af_step, af_max)
                else:
                    ep[i] = prev_ep
                    af[i] = prev_af
        else:
            # Bearish SAR
            psar[i] = prev_psar + prev_af * (prev_ep - prev_psar)
            # SAR cannot be below previous two highs
            if i >= 2:
                psar[i] = max(psar[i], high[i - 1], high[i - 2])
            else:
                psar[i] = max(psar[i], high[i - 1])

            if high[i] > psar[i]:
                # Reversal to bullish
                bull[i] = True
                psar[i] = prev_ep
                ep[i] = high[i]
                af[i] = af_start
            else:
                bull[i] = False
                if low[i] < prev_ep:
                    ep[i] = low[i]
                    af[i] = min(prev_af + af_step, af_max)
                else:
                    ep[i] = prev_ep
                    af[i] = prev_af

    df["psar"] = psar
    df["psar_bull"] = bull  # SAR below price (bullish)
    df["psar_bear"] = ~pd.Series(bull, index=df.index)

    # Reversal signals
    psar_bull_s = pd.Series(bull, index=df.index)
    prev_bull = psar_bull_s.shift(1)
    prev_bull.iloc[0] = True
    df["psar_reversal_bull"] = psar_bull_s & ~prev_bull
    prev_bull2 = psar_bull_s.shift(1)
    prev_bull2.iloc[0] = False
    df["psar_reversal_bear"] = ~psar_bull_s & prev_bull2


def _compute_williams_r(df: pd.DataFrame, p: dict):
    period = p["period"]
    high_max = df["high"].rolling(period).max()
    low_min = df["low"].rolling(period).min()
    denom = high_max - low_min

    # Williams %R: (Highest High - Close) / (Highest High - Lowest Low) * -100
    df["williams_r"] = np.where(denom > 0, (high_max - df["close"]) / denom * -100, -50)
    df["wr_oversold"] = df["williams_r"] < p["oversold"]      # e.g., < -80
    df["wr_overbought"] = df["williams_r"] > p["overbought"]  # e.g., > -20

    # Exit signals (crossing back from extreme zones)
    wr = pd.Series(df["williams_r"], index=df.index)
    df["wr_exit_oversold"] = (wr > p["oversold"]) & (wr.shift(1) <= p["oversold"])
    df["wr_exit_overbought"] = (wr < p["overbought"]) & (wr.shift(1) >= p["overbought"])


# Function dispatch table
_COMPUTE_FUNCS = {
    "bb": _compute_bb,
    "ema": _compute_ema,
    "volume": _compute_volume,
    "candle": _compute_candle,
    "atr": _compute_atr,
    "hv": _compute_hv,
    "rsi": _compute_rsi,
    "macd": _compute_macd,
    "stochastic": _compute_stochastic,
    "adx": _compute_adx,
    "price_action": _compute_price_action,
    "ichimoku": _compute_ichimoku,
    "psar": _compute_psar,
    "williams_r": _compute_williams_r,
}
