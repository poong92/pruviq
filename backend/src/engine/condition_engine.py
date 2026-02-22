"""
PRUVIQ ConditionEngine - JSON-based strategy condition evaluator.

Evaluates user-defined strategy conditions against indicator data.
Supports nested AND/OR logic, comparisons, cross-field references,
and shift (prev candle) operations.

Strategy JSON format:
{
    "name": "My Strategy",
    "direction": "short",
    "indicators": {"bb": {"period": 20}, "ema": {}, "volume": {}},
    "entry": {
        "type": "AND",
        "conditions": [
            {"field": "is_squeeze", "op": "==", "value": true, "shift": 1},
            {"field": "bb_width_change", "op": ">=", "value": 10, "shift": 1},
            {"field": "ema_fast", "op": "<", "field2": "ema_slow", "shift": 1},
            {"field": "vol_ratio", "op": ">=", "value": 2.0, "shift": 1},
            {"field": "bearish", "op": "==", "value": true, "shift": 1},
        ]
    },
    "avoid_hours": [2, 3, 10, 20, 21, 22, 23],
    "sl_pct": 10.0,
    "tp_pct": 8.0,
    "max_bars": 48,
}
"""

import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional, Set, Tuple

from .indicator_pipeline import compute_indicators, get_required_indicators


# Supported comparison operators
_OPS = {
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
    "cross_above": None,  # special handling
    "cross_below": None,  # special handling
}


class ConditionEngine:
    """
    Evaluates JSON-defined trading conditions against indicator DataFrames.

    Two modes:
    1. Vectorized: evaluate all bars at once -> boolean array (fast, for backtest)
    2. Per-bar: evaluate single bar index (for live/generic fallback)
    """

    def __init__(self, strategy_json: dict):
        """
        Args:
            strategy_json: Full strategy definition with indicators, entry, sl/tp, etc.
        """
        self.strategy = strategy_json
        self.name = strategy_json.get("name", "Custom Strategy")
        self.direction = strategy_json.get("direction", "short")
        self.entry_conditions = strategy_json.get("entry", {})
        self.avoid_hours = set(strategy_json.get("avoid_hours", []))
        self.sl_pct = strategy_json.get("sl_pct", 10.0)
        self.tp_pct = strategy_json.get("tp_pct", 8.0)
        self.max_bars = strategy_json.get("max_bars", 48)

        # Extract indicator configs
        self.indicator_configs = strategy_json.get("indicators", {})
        self.required_indicators = set(self.indicator_configs.keys())

        # Also scan conditions for any indicator references not in configs
        if self.entry_conditions:
            cond_list = self.entry_conditions.get("conditions", [])
            from_conds = _extract_indicators_from_conditions(cond_list)
            self.required_indicators |= from_conds

    def prepare_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute all required indicators on raw OHLCV data.

        Args:
            df: Raw OHLCV DataFrame

        Returns:
            DataFrame with all needed indicator columns added
        """
        return compute_indicators(df, self.required_indicators, self.indicator_configs)

    def find_signals_vectorized(self, df: pd.DataFrame) -> np.ndarray:
        """
        Evaluate entry conditions across all bars simultaneously.
        Returns array of bar indices where entry signal fires.

        IMPORTANT: Uses shift to reference prev candle (look-ahead bias prevention).
        Default shift=1 means conditions are checked on the PREVIOUS completed candle,
        and entry happens at the CURRENT bar's close.

        Args:
            df: DataFrame with indicators already computed

        Returns:
            np.ndarray of integer indices where signals fire
        """
        if not self.entry_conditions or "conditions" not in self.entry_conditions:
            return np.array([], dtype=int)

        n = len(df)
        if n < 2:
            return np.array([], dtype=int)

        # Evaluate the root condition tree
        mask = self._eval_group_vectorized(df, self.entry_conditions)

        # Apply time filter on ENTRY bar (next bar after signal)
        # Signal at idx → entry at idx+1 → filter on hour[idx+1]
        if self.avoid_hours and "hour" in df.columns:
            entry_hour = df["hour"].shift(-1)
            hour_ok = ~entry_hour.isin(self.avoid_hours)
            mask = mask & hour_ok.fillna(False).values

        # Never signal on the very last bar (need room for trade)
        mask[-1] = False

        # Never signal on first few bars (indicators need warmup)
        mask[:60] = False

        indices = np.where(mask)[0]
        return indices

    def check_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """
        Check if entry signal fires at a specific bar index.
        Used for per-bar evaluation (generic fallback / live trading).

        Args:
            df: DataFrame with indicators computed
            idx: Bar index to check

        Returns:
            Direction string ("short"/"long") if signal, else None
        """
        if idx < 60 or idx >= len(df) - 1:
            return None

        if not self.entry_conditions or "conditions" not in self.entry_conditions:
            return None

        # Time filter on ENTRY bar (idx+1), matching vectorized path
        if self.avoid_hours and "hour" in df.columns:
            entry_idx = idx + 1
            if entry_idx >= len(df):
                return None
            hour_val = df["hour"].iloc[entry_idx]
            if hour_val in self.avoid_hours:
                return None

        # Evaluate conditions at this bar
        if self._eval_group_at_bar(df, self.entry_conditions, idx):
            return self.direction

        return None

    def get_params(self) -> dict:
        """Return strategy parameters for display/logging."""
        return {
            "name": self.name,
            "direction": self.direction,
            "sl_pct": self.sl_pct,
            "tp_pct": self.tp_pct,
            "max_bars": self.max_bars,
            "avoid_hours": sorted(self.avoid_hours),
            "indicators": list(self.required_indicators),
            "conditions_count": _count_conditions(self.entry_conditions),
        }

    # --- Vectorized evaluation ---

    def _eval_group_vectorized(self, df: pd.DataFrame, group: dict) -> np.ndarray:
        """
        Recursively evaluate AND/OR group of conditions.
        Returns boolean numpy array (length = len(df)).
        """
        group_type = group.get("type", "AND").upper()
        conditions = group.get("conditions", [])

        if not conditions:
            return np.ones(len(df), dtype=bool)

        results = []
        for cond in conditions:
            if "conditions" in cond:
                # Nested group
                results.append(self._eval_group_vectorized(df, cond))
            else:
                # Leaf condition
                results.append(self._eval_condition_vectorized(df, cond))

        if group_type == "AND":
            combined = results[0]
            for r in results[1:]:
                combined = combined & r
            return combined
        else:  # OR
            combined = results[0]
            for r in results[1:]:
                combined = combined | r
            return combined

    def _eval_condition_vectorized(self, df: pd.DataFrame, cond: dict) -> np.ndarray:
        """
        Evaluate a single condition across all bars.

        Condition format:
        {
            "field": "is_squeeze",     # Column name from indicators
            "op": "==",                # Comparison operator
            "value": true,             # Literal value to compare against
            "field2": "ema_slow",      # OR: compare against another column
            "shift": 1,               # Shift for prev candle (default=1)
        }
        """
        field = cond.get("field")
        op = cond.get("op", "==")
        shift = cond.get("shift", 1)  # Default: prev candle

        if field not in df.columns:
            return np.zeros(len(df), dtype=bool)

        # Get the left-hand side (shifted)
        if shift > 0:
            lhs = df[field].shift(shift).values
        else:
            lhs = df[field].values

        # Get the right-hand side
        if "field2" in cond:
            field2 = cond["field2"]
            if field2 not in df.columns:
                return np.zeros(len(df), dtype=bool)
            if shift > 0:
                rhs = df[field2].shift(shift).values
            else:
                rhs = df[field2].values
        else:
            rhs = cond.get("value")

        # Handle special operators
        if op == "cross_above":
            if "field2" in cond:
                prev_lhs = df[field].shift(shift + 1).values
                prev_rhs = df[cond["field2"]].shift(shift + 1).values
            else:
                prev_lhs = df[field].shift(shift + 1).values
                prev_rhs = rhs
            return (lhs > rhs) & (prev_lhs <= prev_rhs)

        if op == "cross_below":
            if "field2" in cond:
                prev_lhs = df[field].shift(shift + 1).values
                prev_rhs = df[cond["field2"]].shift(shift + 1).values
            else:
                prev_lhs = df[field].shift(shift + 1).values
                prev_rhs = rhs
            return (lhs < rhs) & (prev_lhs >= prev_rhs)

        # Standard comparison
        op_func = _OPS.get(op)
        if op_func is None:
            return np.zeros(len(df), dtype=bool)

        # Handle NaN: NaN comparisons return False
        with np.errstate(invalid="ignore"):
            result = op_func(lhs, rhs)

        # Replace NaN with False
        if isinstance(result, np.ndarray):
            result = np.asarray(result, dtype=object)
            # Only check isnan on numeric arrays
            if isinstance(lhs, np.ndarray) and lhs.dtype.kind in ("f", "i", "u"):
                nan_mask = pd.isna(lhs)
                result[nan_mask] = False
            return np.asarray(result, dtype=bool)
        return np.full(len(df), bool(result))

    # --- Per-bar evaluation ---

    def _eval_group_at_bar(self, df: pd.DataFrame, group: dict, idx: int) -> bool:
        """Evaluate AND/OR group at a specific bar index."""
        group_type = group.get("type", "AND").upper()
        conditions = group.get("conditions", [])

        if not conditions:
            return True

        for cond in conditions:
            if "conditions" in cond:
                result = self._eval_group_at_bar(df, cond, idx)
            else:
                result = self._eval_condition_at_bar(df, cond, idx)

            if group_type == "AND" and not result:
                return False  # Short-circuit
            if group_type == "OR" and result:
                return True  # Short-circuit

        return group_type == "AND"  # AND: all passed; OR: none passed

    def _eval_condition_at_bar(self, df: pd.DataFrame, cond: dict, idx: int) -> bool:
        """Evaluate a single condition at a specific bar index."""
        field = cond.get("field")
        op = cond.get("op", "==")
        shift = cond.get("shift", 1)

        bar_idx = idx - shift
        if bar_idx < 0 or field not in df.columns:
            return False

        lhs = df[field].iloc[bar_idx]

        if "field2" in cond:
            field2 = cond["field2"]
            if field2 not in df.columns:
                return False
            rhs = df[field2].iloc[bar_idx]
        else:
            rhs = cond.get("value")

        # Handle NaN
        if pd.isna(lhs):
            return False

        # Cross operators need previous bar
        if op in ("cross_above", "cross_below"):
            prev_idx = bar_idx - 1
            if prev_idx < 0:
                return False
            prev_lhs = df[field].iloc[prev_idx]
            prev_rhs = df[cond["field2"]].iloc[prev_idx] if "field2" in cond else rhs
            if pd.isna(prev_lhs):
                return False
            if op == "cross_above":
                return lhs > rhs and prev_lhs <= prev_rhs
            else:
                return lhs < rhs and prev_lhs >= prev_rhs

        op_func = _OPS.get(op)
        if op_func is None:
            return False

        return bool(op_func(lhs, rhs))


# --- Preset Strategy Templates ---

PRESET_STRATEGIES = {
    "bb-squeeze-short": {
        "name": "BB Squeeze SHORT",
        "direction": "short",
        "indicators": {
            "bb": {"period": 20, "std": 2.0, "squeeze_lookback": 10,
                    "squeeze_threshold": 0.8, "expansion_threshold": 0.9},
            "ema": {"fast": 20, "slow": 50},
            "volume": {"ma_period": 10},
        },
        "entry": {
            "type": "AND",
            "conditions": [
                # AutoTrader v1.7.0 parity — 7 conditions
                # 1. Recent squeeze in past 10 candles (prev bar's window)
                {"field": "recent_squeeze", "op": "==", "value": True, "shift": 1},
                # 2. BB width expanding: curr > prev
                {"field": "bb_expanding", "op": "==", "value": True, "shift": 0},
                # 3. BB width above MA threshold (curr > MA * 0.9)
                {"field": "bb_width_above_ma", "op": "==", "value": True, "shift": 0},
                # 4. Price below BB mid (SHORT direction)
                {"field": "close", "op": "<", "field2": "bb_mid", "shift": 0},
                # 5. Volume spike (prev candle)
                {"field": "vol_ratio", "op": ">=", "value": 2.0, "shift": 1},
                # 6. Downtrend: EMA fast < slow (prev candle, NOT bearish candle)
                {"field": "downtrend", "op": "==", "value": True, "shift": 1},
                # 7. BB expansion speed >= 10% (curr candle)
                {"field": "bb_width_change", "op": ">=", "value": 10, "shift": 0},
            ],
        },
        "avoid_hours": [2, 3, 10, 20, 21, 22, 23],
        "sl_pct": 10.0,
        "tp_pct": 8.0,
        "max_bars": 48,
    },
    "bb-squeeze-long": {
        "name": "BB Squeeze LONG",
        "direction": "long",
        "indicators": {
            "bb": {"period": 20, "std": 2.0, "squeeze_lookback": 10,
                    "squeeze_threshold": 0.8, "expansion_threshold": 0.9},
            "ema": {"fast": 20, "slow": 50},
            "volume": {"ma_period": 10},
        },
        "entry": {
            "type": "AND",
            "conditions": [
                {"field": "recent_squeeze", "op": "==", "value": True, "shift": 1},
                {"field": "bb_expanding", "op": "==", "value": True, "shift": 0},
                {"field": "bb_width_above_ma", "op": "==", "value": True, "shift": 0},
                {"field": "close", "op": ">", "field2": "bb_mid", "shift": 0},
                {"field": "vol_ratio", "op": ">=", "value": 2.0, "shift": 1},
                {"field": "uptrend", "op": "==", "value": True, "shift": 1},
                {"field": "bb_width_change", "op": ">=", "value": 10, "shift": 0},
            ],
        },
        "avoid_hours": [2, 3, 10, 20, 21, 22, 23],
        "sl_pct": 7.0,
        "tp_pct": 6.0,
        "max_bars": 48,
    },
    "rsi-reversal-long": {
        "name": "RSI Reversal LONG",
        "direction": "long",
        "indicators": {
            "rsi": {"period": 14, "oversold": 30},
            "ema": {"fast": 20, "slow": 50},
            "volume": {"ma_period": 10},
        },
        "entry": {
            "type": "AND",
            "conditions": [
                {"field": "rsi_oversold", "op": "==", "value": True, "shift": 1},
                {"field": "uptrend", "op": "==", "value": True, "shift": 1},
                {"field": "vol_ratio", "op": ">=", "value": 1.5, "shift": 1},
            ],
        },
        "avoid_hours": [],
        "sl_pct": 5.0,
        "tp_pct": 10.0,
        "max_bars": 48,
    },
    "macd-momentum-long": {
        "name": "MACD Momentum LONG",
        "direction": "long",
        "indicators": {
            "macd": {"fast": 12, "slow": 26, "signal": 9},
            "adx": {"period": 14, "threshold": 25},
            "volume": {"ma_period": 10},
        },
        "entry": {
            "type": "AND",
            "conditions": [
                {"field": "macd", "op": "cross_above", "field2": "macd_signal", "shift": 1},
                {"field": "strong_trend", "op": "==", "value": True, "shift": 1},
                {"field": "vol_ratio", "op": ">=", "value": 1.5, "shift": 1},
            ],
        },
        "avoid_hours": [],
        "sl_pct": 7.0,
        "tp_pct": 10.0,
        "max_bars": 48,
    },
    "stochastic-oversold-short": {
        "name": "Stochastic Overbought SHORT",
        "direction": "short",
        "indicators": {
            "stochastic": {"k_period": 14, "d_period": 3, "overbought": 80},
            "bb": {"period": 20, "std": 2.0},
            "ema": {"fast": 20, "slow": 50},
        },
        "entry": {
            "type": "AND",
            "conditions": [
                {"field": "stoch_overbought", "op": "==", "value": True, "shift": 1},
                {"field": "downtrend", "op": "==", "value": True, "shift": 1},
                {"field": "close", "op": ">=", "field2": "bb_upper", "shift": 1},
            ],
        },
        "avoid_hours": [],
        "sl_pct": 8.0,
        "tp_pct": 8.0,
        "max_bars": 48,
    },
}


def get_preset_strategies() -> Dict[str, dict]:
    """Return all preset strategy templates."""
    return PRESET_STRATEGIES


def create_engine_from_preset(preset_id: str) -> ConditionEngine:
    """Create a ConditionEngine from a preset strategy template."""
    if preset_id not in PRESET_STRATEGIES:
        raise ValueError(f"Unknown preset: {preset_id}. Available: {list(PRESET_STRATEGIES.keys())}")
    return ConditionEngine(PRESET_STRATEGIES[preset_id])


def validate_strategy_json(strategy_json: dict) -> Tuple[bool, List[str]]:
    """
    Validate a user-submitted strategy JSON.

    Returns:
        (is_valid, list_of_errors)
    """
    errors = []

    # Required fields
    if "direction" not in strategy_json:
        errors.append("Missing 'direction' (must be 'short' or 'long')")
    elif strategy_json["direction"] not in ("short", "long"):
        errors.append(f"Invalid direction: {strategy_json['direction']}")

    if "entry" not in strategy_json:
        errors.append("Missing 'entry' conditions")
    else:
        entry = strategy_json["entry"]
        if "conditions" not in entry:
            errors.append("'entry' must have 'conditions' list")
        elif not entry["conditions"]:
            errors.append("'entry.conditions' cannot be empty")
        else:
            # Validate each condition
            for i, cond in enumerate(entry["conditions"]):
                if "conditions" in cond:
                    continue  # Nested group, skip leaf validation
                if "field" not in cond:
                    errors.append(f"Condition {i}: missing 'field'")
                if "op" not in cond:
                    errors.append(f"Condition {i}: missing 'op'")
                elif cond["op"] not in _OPS:
                    errors.append(f"Condition {i}: unknown op '{cond['op']}'")
                if "value" not in cond and "field2" not in cond:
                    errors.append(f"Condition {i}: must have 'value' or 'field2'")

    # SL/TP range
    sl = strategy_json.get("sl_pct", 10)
    tp = strategy_json.get("tp_pct", 8)
    if not (0.5 <= sl <= 50):
        errors.append(f"sl_pct must be 0.5-50%, got {sl}")
    if not (0.5 <= tp <= 100):
        errors.append(f"tp_pct must be 0.5-100%, got {tp}")

    # avoid_hours
    hours = strategy_json.get("avoid_hours", [])
    if not isinstance(hours, list):
        errors.append("avoid_hours must be a list")
    elif any(h < 0 or h > 23 for h in hours):
        errors.append("avoid_hours must contain values 0-23")

    # max_bars
    max_bars = strategy_json.get("max_bars", 48)
    if not (1 <= max_bars <= 168):
        errors.append(f"max_bars must be 1-168, got {max_bars}")

    return len(errors) == 0, errors


# --- Helper functions ---

def _extract_indicators_from_conditions(conditions: list) -> Set[str]:
    """Extract which indicators are referenced in conditions by field names."""
    from .indicator_pipeline import INDICATOR_REGISTRY

    # Build reverse lookup: field -> indicator
    field_to_ind = {}
    for ind_id, info in INDICATOR_REGISTRY.items():
        for f in info["fields"]:
            field_to_ind[f] = ind_id

    needed = set()
    for cond in conditions:
        if "conditions" in cond:
            needed |= _extract_indicators_from_conditions(cond["conditions"])
        else:
            field = cond.get("field", "")
            if field in field_to_ind:
                needed.add(field_to_ind[field])
            field2 = cond.get("field2", "")
            if field2 in field_to_ind:
                needed.add(field_to_ind[field2])
    return needed


def _count_conditions(group: dict) -> int:
    """Count total leaf conditions in a condition tree."""
    count = 0
    for cond in group.get("conditions", []):
        if "conditions" in cond:
            count += _count_conditions(cond)
        else:
            count += 1
    return count
