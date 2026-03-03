"""
Strategy Registry — Single source of truth for all available strategies.

Maps strategy IDs to their class, default direction, and default SL/TP.
"""

from typing import Tuple

from src.strategies.bb_squeeze import BBSqueezeStrategy
from src.strategies.momentum_long import MomentumLongStrategy
from src.strategies.atr_breakout import ATRBreakoutStrategy
from src.strategies.hv_squeeze import HVSqueezeStrategy


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
