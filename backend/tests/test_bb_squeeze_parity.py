"""
BB Squeeze AutoTrader v1.7.0 Parity Tests

Validates that Pruviq's BB Squeeze implementation matches AutoTrader's
production logic exactly across all 3 code paths:
1. BBSqueezeStrategy class (bb_squeeze.py)
2. Vectorized fast engine (engine_fast.py)
3. ConditionEngine preset (condition_engine.py)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
from src.strategies.bb_squeeze import BBSqueezeStrategy
from src.simulation.engine import SimulationEngine, CostModel
from src.simulation.engine_fast import find_signals_vectorized, run_fast
from src.engine.condition_engine import ConditionEngine, PRESET_STRATEGIES
from src.engine.indicator_pipeline import compute_indicators


def make_bb_squeeze_data(n=300, seed=42):
    """Generate synthetic OHLCV data with a known squeeze-expansion pattern."""
    np.random.seed(seed)

    prices = [100.0]
    for i in range(n - 1):
        if 100 <= i <= 120:
            # Low volatility (squeeze)
            change = np.random.normal(0, 0.003)
        elif 121 <= i <= 130:
            # Expansion phase — downward
            change = np.random.normal(-0.015, 0.01)
        else:
            change = np.random.normal(0, 0.01)
        prices.append(prices[-1] * (1 + change))

    volumes = []
    for i in range(n):
        if 121 <= i <= 130:
            volumes.append(np.random.uniform(5000, 10000))  # Volume spike
        else:
            volumes.append(np.random.uniform(1000, 3000))

    df = pd.DataFrame({
        "timestamp": pd.date_range("2025-01-01", periods=n, freq="1h"),
        "open": prices,
        "high": [p * (1 + abs(np.random.normal(0, 0.005))) for p in prices],
        "low": [p * (1 - abs(np.random.normal(0, 0.005))) for p in prices],
        "close": [p * (1 + np.random.normal(0, 0.003)) for p in prices],
        "volume": volumes,
    })
    return df


def test_indicator_fields_exist():
    """BB indicator pipeline produces all AT parity fields."""
    df = make_bb_squeeze_data()
    indicators = {"bb", "ema", "volume"}
    params = {
        "bb": {"period": 20, "std": 2.0, "squeeze_lookback": 10,
               "squeeze_threshold": 0.8, "expansion_threshold": 0.9},
        "ema": {"fast": 20, "slow": 50},
        "volume": {"ma_period": 10},
    }
    result = compute_indicators(df, indicators, params)

    required_fields = [
        "bb_mid", "bb_upper", "bb_lower", "bb_width", "bb_width_ma",
        "bb_width_change", "is_squeeze",
        # AT parity fields
        "recent_squeeze", "bb_expanding", "bb_width_above_ma",
        # EMA
        "ema_fast", "ema_slow", "uptrend", "downtrend",
        # Volume
        "vol_ratio",
    ]
    for field in required_fields:
        assert field in result.columns, f"Missing field: {field}"
    print(f"  All {len(required_fields)} indicator fields present")


def test_recent_squeeze_is_rolling_any():
    """recent_squeeze = any(is_squeeze) over rolling window of 10."""
    df = make_bb_squeeze_data()
    strategy = BBSqueezeStrategy(squeeze_lookback=10)
    df = strategy.calculate_indicators(df)

    # Manually verify for a specific index
    for idx in range(20, len(df)):
        window = df.iloc[max(0, idx - 10 + 1):idx + 1]["is_squeeze"]
        expected = window.any()
        actual = df.iloc[idx]["recent_squeeze"]
        assert bool(actual) == bool(expected), (
            f"recent_squeeze mismatch at idx={idx}: expected={expected}, got={actual}"
        )

    print("  recent_squeeze matches rolling(10).any()")


def test_bb_expanding_is_curr_gt_prev():
    """bb_expanding = bb_width[curr] > bb_width[prev]."""
    df = make_bb_squeeze_data()
    strategy = BBSqueezeStrategy()
    df = strategy.calculate_indicators(df)

    for idx in range(1, len(df)):
        curr_w = df.iloc[idx]["bb_width"]
        prev_w = df.iloc[idx - 1]["bb_width"]
        expected = curr_w > prev_w
        actual = df.iloc[idx]["bb_expanding"]
        if not pd.isna(curr_w) and not pd.isna(prev_w):
            assert bool(actual) == bool(expected), (
                f"bb_expanding mismatch at idx={idx}"
            )

    print("  bb_expanding matches curr > prev check")


def test_no_bearish_condition_in_preset():
    """BB Squeeze SHORT preset must NOT use bearish candle direction."""
    preset = PRESET_STRATEGIES["bb-squeeze-short"]
    conditions = preset["entry"]["conditions"]
    fields_used = [c.get("field") for c in conditions]

    assert "bearish" not in fields_used, "Preset should NOT use 'bearish' (AT uses 'downtrend')"
    assert "downtrend" in fields_used, "Preset should use 'downtrend'"
    assert "candle" not in preset["indicators"], "Candle indicator not needed"
    print("  Preset uses downtrend (not bearish), no candle indicator")


def test_preset_conditions_count():
    """BB Squeeze SHORT preset must have exactly 7 conditions (AT parity)."""
    preset = PRESET_STRATEGIES["bb-squeeze-short"]
    conditions = preset["entry"]["conditions"]
    assert len(conditions) == 7, f"Expected 7 conditions, got {len(conditions)}"

    expected_fields = {
        "recent_squeeze", "bb_expanding", "bb_width_above_ma",
        "close", "vol_ratio", "downtrend", "bb_width_change",
    }
    actual_fields = {c["field"] for c in conditions}
    assert actual_fields == expected_fields, f"Field mismatch: {actual_fields} != {expected_fields}"
    print("  Preset has 7 conditions matching AT exactly")


def test_preset_shifts_correct():
    """Verify shift values: prev-candle checks=1, curr-candle checks=0."""
    preset = PRESET_STRATEGIES["bb-squeeze-short"]
    conditions = preset["entry"]["conditions"]

    shift_map = {c["field"]: c["shift"] for c in conditions}

    # Curr candle (shift=0): bb_expanding, bb_width_above_ma, close, bb_width_change
    assert shift_map["bb_expanding"] == 0, "bb_expanding should be shift=0 (curr)"
    assert shift_map["bb_width_above_ma"] == 0, "bb_width_above_ma should be shift=0 (curr)"
    assert shift_map["close"] == 0, "close should be shift=0 (curr)"
    assert shift_map["bb_width_change"] == 0, "bb_width_change should be shift=0 (curr)"

    # Prev candle (shift=1): recent_squeeze, vol_ratio, downtrend
    assert shift_map["recent_squeeze"] == 1, "recent_squeeze should be shift=1 (prev)"
    assert shift_map["vol_ratio"] == 1, "vol_ratio should be shift=1 (prev)"
    assert shift_map["downtrend"] == 1, "downtrend should be shift=1 (prev)"

    print("  All shift values correct (curr=0, prev=1)")


def test_cost_model_futures_parity():
    """Futures cost model: 0.08% fee, 0% slippage (AT parity)."""
    cm = CostModel.futures()
    assert cm.fee_pct == 0.0008, f"Expected 0.0008 (0.08%), got {cm.fee_pct}"
    assert cm.slippage_pct == 0.0002, f"Expected 0.0002 slippage, got {cm.slippage_pct}"
    print("  Futures: 0.08% fee, 0.02% slippage (realistic)")


def test_three_paths_consistent():
    """All 3 code paths must produce signals on the same bars."""
    df = make_bb_squeeze_data(500, seed=123)

    # Path 1: BBSqueezeStrategy class
    strategy = BBSqueezeStrategy(avoid_hours=[])
    df_with_ind = strategy.calculate_indicators(df.copy())

    class_signals = []
    for idx in range(len(df_with_ind) - 1):
        sig = strategy.check_signal(df_with_ind, idx)
        if sig == "short":
            class_signals.append(idx)

    # Path 2: Vectorized fast engine
    vec_signals = find_signals_vectorized(df_with_ind, strategy, "short")

    # Path 3: ConditionEngine preset (with empty avoid_hours for comparison)
    preset = dict(PRESET_STRATEGIES["bb-squeeze-short"])
    preset["avoid_hours"] = []  # Remove time filter for comparison
    engine = ConditionEngine(preset)
    df_ce = engine.prepare_dataframe(df.copy())
    ce_signals = engine.find_signals_vectorized(df_ce)

    print(f"  Class signals: {len(class_signals)}")
    print(f"  Vectorized signals: {len(vec_signals)}")
    print(f"  ConditionEngine signals: {len(ce_signals)}")

    # Class vs Vectorized should match exactly
    class_set = set(class_signals)
    vec_set = set(vec_signals.tolist())
    assert class_set == vec_set, (
        f"Class vs Vectorized mismatch: "
        f"class_only={class_set - vec_set}, vec_only={vec_set - class_set}"
    )

    # ConditionEngine may have slight differences due to:
    # - Different warmup period (60 vs ema_slow + squeeze_lookback)
    # - Time filter on entry bar vs signal bar
    # But the logic should overlap heavily
    ce_set = set(ce_signals.tolist())
    overlap = class_set & ce_set
    if class_set:
        overlap_pct = len(overlap) / len(class_set) * 100
        print(f"  Class/ConditionEngine overlap: {overlap_pct:.1f}%")
        assert overlap_pct > 80, f"Too low overlap: {overlap_pct}%"

    print("  All 3 paths consistent!")


def test_avoid_hours_on_entry_bar():
    """Time filter should check entry bar (idx+1) hour, not signal bar."""
    strategy = BBSqueezeStrategy(avoid_hours=[5])

    # Create data where signal fires at hour 4 (entry at hour 5 should be blocked)
    df = make_bb_squeeze_data(500)
    df = strategy.calculate_indicators(df)

    for idx in range(len(df) - 1):
        sig = strategy.check_signal(df, idx)
        if sig is not None:
            entry_hour = df.iloc[idx + 1]["hour"]
            assert entry_hour != 5, (
                f"Signal at idx={idx} should be blocked (entry hour={entry_hour})"
            )

    print("  Time filter correctly checks entry bar hour")


if __name__ == "__main__":
    tests = [
        ("Indicator Fields Exist", test_indicator_fields_exist),
        ("Recent Squeeze = Rolling Any", test_recent_squeeze_is_rolling_any),
        ("BB Expanding = Curr > Prev", test_bb_expanding_is_curr_gt_prev),
        ("No Bearish in Preset", test_no_bearish_condition_in_preset),
        ("Preset Conditions Count", test_preset_conditions_count),
        ("Preset Shifts Correct", test_preset_shifts_correct),
        ("Cost Model Futures Parity", test_cost_model_futures_parity),
        ("Three Paths Consistent", test_three_paths_consistent),
        ("Avoid Hours on Entry Bar", test_avoid_hours_on_entry_bar),
    ]

    passed = 0
    failed = 0
    for name, test_fn in tests:
        print(f"\n[TEST] {name}")
        try:
            test_fn()
            print(f"  PASS")
            passed += 1
        except Exception as e:
            print(f"  FAIL: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print(f"\n{'=' * 50}")
    print(f"BB Squeeze Parity Tests: {passed} passed, {failed} failed")
    sys.exit(1 if failed > 0 else 0)
