"""
Strategy Registry — Single source of truth for all available strategies.

Maps strategy IDs to their class, default direction, and default SL/TP.
"""

from typing import Tuple

from src.strategies.bb_squeeze import BBSqueezeStrategy
from src.strategies.momentum_long import MomentumLongStrategy
from src.strategies.atr_breakout import ATRBreakoutStrategy
from src.strategies.hv_squeeze import HVSqueezeStrategy
from src.strategies.rsi_divergence import RSIDivergenceStrategy
from src.strategies.macd_cross import MACDCrossStrategy
from src.strategies.donchian_breakout import DonchianBreakoutStrategy
from src.strategies.mean_reversion import MeanReversionStrategy
from src.strategies.supertrend import SuperTrendStrategy
from src.strategies.keltner_squeeze import KeltnerSqueezeStrategy
from src.strategies.stochastic_rsi import StochasticRSIStrategy
from src.strategies.ma_cross import MACrossStrategy
from src.strategies.adx_trend import ADXTrendStrategy
from src.strategies.ichimoku import IchimokuStrategy
from src.strategies.heikin_ashi import HeikinAshiStrategy


AVOID_HOURS_BB = [2, 3, 10, 20, 21, 22, 23]
AVOID_HOURS_MOMENTUM = [1, 2, 3, 8, 9, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23]

STRATEGY_REGISTRY = {
    "bb-squeeze-short": {
        "class": BBSqueezeStrategy,
        "init_kwargs": {"avoid_hours": AVOID_HOURS_BB},
        "direction": "short",
        "defaults": {"sl": 10, "tp": 8},
        "name": "BB Squeeze SHORT",
        "description": "Bollinger Band squeeze breakout. Enters short on volatility expansion after contraction.",
        "status": "verified",
    },
    "bb-squeeze-long": {
        "class": BBSqueezeStrategy,
        "init_kwargs": {"avoid_hours": AVOID_HOURS_BB},
        "direction": "long",
        "defaults": {"sl": 7, "tp": 6},
        "name": "BB Squeeze LONG",
        "description": "Bollinger Band squeeze breakout. Enters long on volatility expansion after contraction.",
        "status": "killed",
    },
    "momentum-long": {
        "class": MomentumLongStrategy,
        "init_kwargs": {"avoid_hours": AVOID_HOURS_MOMENTUM},
        "direction": "long",
        "defaults": {"sl": 5, "tp": 10},
        "name": "Momentum Breakout LONG",
        "description": "20-candle high breakout with volume and trend confirmation.",
        "status": "killed",
    },
    "atr-breakout": {
        "class": ATRBreakoutStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "long",
        "defaults": {"sl": 7, "tp": 10},
        "name": "ATR Breakout",
        "description": "ATR band breakout with EMA trend filter. Enters on volatility expansion.",
        "status": "shelved",
    },
    "hv-squeeze": {
        "class": HVSqueezeStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "short",
        "defaults": {"sl": 10, "tp": 6},
        "name": "HV Squeeze",
        "description": "Historical volatility squeeze with candle color direction filter.",
        "status": "shelved",
    },
    "rsi-divergence": {
        "class": RSIDivergenceStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 7, "tp": 5},
        "name": "RSI Divergence",
        "description": "Bullish/bearish RSI divergence. Enters when price makes new extreme but RSI disagrees.",
        "status": "research",
    },
    "macd-cross": {
        "class": MACDCrossStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 8, "tp": 6},
        "name": "MACD Cross",
        "description": "MACD line crosses signal line with zero-line filter (cross below zero = long, above = short).",
        "status": "research",
    },
    "donchian-breakout": {
        "class": DonchianBreakoutStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 8, "tp": 10},
        "name": "Donchian Breakout",
        "description": "Turtle Trading channel breakout. Enters on 20-period high/low breakout.",
        "status": "research",
    },
    "mean-reversion": {
        "class": MeanReversionStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 5, "tp": 4},
        "name": "Mean Reversion",
        "description": "Price reverts to 20-period SMA after extreme deviation (2σ) confirmed by RSI.",
        "status": "research",
    },
    "supertrend": {
        "class": SuperTrendStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 8, "tp": 8},
        "name": "SuperTrend",
        "description": "ATR-based dynamic support/resistance. Enters on SuperTrend direction flip.",
        "status": "research",
    },
    "keltner-squeeze": {
        "class": KeltnerSqueezeStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 7, "tp": 6},
        "name": "Keltner Squeeze",
        "description": "Enters when BB exits Keltner Channel (squeeze release) with directional breakout.",
        "status": "research",
    },
    "stochastic-rsi": {
        "class": StochasticRSIStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 7, "tp": 5},
        "name": "Stochastic RSI",
        "description": "Stochastic oscillator applied to RSI. Enters on golden/death cross in oversold/overbought zones.",
        "status": "research",
    },
    "ma-cross": {
        "class": MACrossStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 8, "tp": 10},
        "name": "MA Cross",
        "description": "EMA golden/death cross (50/200). Classic trend-following entry on moving average crossover.",
        "status": "research",
    },
    "adx-trend": {
        "class": ADXTrendStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 8, "tp": 10},
        "name": "ADX Trend",
        "description": "ADX + DMI directional crossover. Enters only when trend strength (ADX > 25) is confirmed.",
        "status": "research",
    },
    "ichimoku": {
        "class": IchimokuStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 8, "tp": 10},
        "name": "Ichimoku Cloud",
        "description": "Ichimoku Kinko Hyo. Enters when price is above/below cloud and Tenkan crosses Kijun.",
        "status": "research",
    },
    "heikin-ashi": {
        "class": HeikinAshiStrategy,
        "init_kwargs": {"avoid_hours": []},
        "direction": "both",
        "defaults": {"sl": 7, "tp": 8},
        "name": "Heikin Ashi Trend",
        "description": "Heikin Ashi candle trend detection. Enters on N consecutive HA candles with no opposing wick.",
        "status": "research",
    },
}


def get_strategy(strategy_id: str) -> Tuple[object, str, dict]:
    """
    Get strategy instance, direction, and defaults from registry.

    Returns:
        (strategy_instance, direction, defaults_dict)
    """
    entry = STRATEGY_REGISTRY.get(strategy_id)
    if not entry:
        raise ValueError(f"Unknown strategy: {strategy_id}")

    kwargs = entry.get("init_kwargs", {})
    instance = entry["class"](**kwargs)
    return instance, entry["direction"], entry["defaults"]


def get_all_strategies() -> dict:
    """Get all strategy instances keyed by strategy_id."""
    result = {}
    for strategy_id, entry in STRATEGY_REGISTRY.items():
        kwargs = entry.get("init_kwargs", {})
        result[strategy_id] = entry["class"](**kwargs)
    return result
