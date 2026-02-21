"""
PRUVIQ IndicatorPipeline - Dynamic indicator computation.

Computes only the indicators requested by user strategy JSON.
Supports: BB, EMA, ATR, HV, Volume, Candle, RSI, MACD, Stochastic, ADX, Price Action.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Set


# Registry of available indicators and their computed fields
INDICATOR_REGISTRY = {
    "bb": {
        "name": "Bollinger Bands",
        "fields": ["bb_upper", "bb_lower", "bb_mid", "bb_width", "bb_width_ma",
                    "bb_width_change", "is_squeeze"],
        "default_params": {"period": 20, "std": 2.0, "squeeze_lookback": 10, "squeeze_threshold": 0.8},
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

    df["bb_mid"] = df["close"].rolling(period).mean()
    bb_std = df["close"].rolling(period).std()
    df["bb_upper"] = df["bb_mid"] + std_mult * bb_std
    df["bb_lower"] = df["bb_mid"] - std_mult * bb_std
    df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / df["bb_mid"] * 100
    df["bb_width_ma"] = df["bb_width"].rolling(squeeze_lookback).mean()
    df["bb_width_change"] = df["bb_width"].pct_change() * 100
    df["is_squeeze"] = df["bb_width"] < df["bb_width_ma"] * threshold


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
}
