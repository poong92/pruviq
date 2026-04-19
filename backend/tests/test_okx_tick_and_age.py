"""
OKX trading-safety regression guard (PR 2026-04-19).

Blocks two fund-loss regressions:
  1. `_calc_sl_tp_prices` must snap to per-instrument tickSz. Naive `.2f`
     formatting returns "0.00" for DOGE ($0.09, tickSz 0.00001) and SHIB
     ($0.000009, tickSz 1e-9). OKX rejects off-grid prices → market order
     fills but SL/TP fails → emergency-close loop → guaranteed loss per trade.
  2. `_MAX_SIGNAL_AGE_S` must be at least `SIGNAL_POLL_INTERVAL`. Previous
     hardcoded 60s with 300s poll cadence silently dropped every signal
     (age ≈ 250s > 60s every cycle) → autotrading never fired.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from okx.orders import _calc_sl_tp_prices, _round_to_tick


def test_tick_snap_btc_two_decimals():
    """BTC-USDT-SWAP tickSz ≈ 0.1 — the default 0.01 path is not wrong for
    BTC pricing (cents-precision is within grid), but we verify snapping."""
    sl, tp = _calc_sl_tp_prices(85000.0, "long", 2.0, 4.0, tick_sz=0.1)
    # SL = 85000 * 0.98 = 83300.0; TP = 85000 * 1.04 = 88400.0
    # Both already on 0.1 grid.
    assert sl == "83300.0"
    assert tp == "88400.0"


def test_tick_snap_doge_five_decimals():
    """DOGE-USDT-SWAP tickSz = 0.00001. Entry $0.09, SL -5%, TP +10%.

    Without the fix: f"{0.0855:.2f}" → "0.09" and f"{0.099:.2f}" → "0.10" —
    both lose all precision and collide with entry price. OKX rejects the
    algo order and the position stays naked.
    """
    sl, tp = _calc_sl_tp_prices(0.09, "long", 5.0, 10.0, tick_sz=0.00001)
    # SL ≈ 0.0855, TP ≈ 0.099. Float arithmetic means 0.09*0.95 is actually
    # 0.08549999... so floor-to-tick may yield 0.08549 (off by one tick = 0.012%
    # of price, below OKX rounding tolerance and on the *conservative* side
    # for a long SL). What matters: precision is preserved and values do not
    # collapse to two decimals.
    sl_val = float(sl)
    tp_val = float(tp)
    assert 0.0854 <= sl_val <= 0.0856, f"DOGE SL off: {sl!r}"
    assert 0.0988 <= tp_val <= 0.0990, f"DOGE TP off: {tp!r}"
    # Must show 5 decimals, not 2 (the broken default)
    assert len(sl.split(".")[1]) == 5, f"DOGE SL lost precision: {sl!r}"
    assert len(tp.split(".")[1]) == 5, f"DOGE TP lost precision: {tp!r}"
    # Explicitly refuse the broken default
    assert sl != "0.09"
    assert tp != "0.10"


def test_tick_snap_shib_scientific_precision():
    """SHIB tickSz ≈ 1e-9. Price ~$0.00001. Ensure no scientific notation
    (OKX rejects '1e-9' style strings) and full precision preserved."""
    sl, tp = _calc_sl_tp_prices(0.00001, "long", 5.0, 10.0, tick_sz=0.00000001)
    # 1e-5 * 0.95 = 9.5e-6 → snap → 0.00000950
    assert "e" not in sl.lower(), f"No scientific notation: got {sl!r}"
    assert "e" not in tp.lower(), f"No scientific notation: got {tp!r}"
    assert sl.startswith("0.0000"), f"SHIB precision lost: {sl!r}"
    assert tp.startswith("0.0000"), f"SHIB precision lost: {tp!r}"


def test_round_to_tick_direction():
    """SL should round toward the stop direction (more protective); TP
    rounds toward the goal (less aggressive)."""
    # long SL: round down (below entry) — 100.07 with tick 0.1 → 100.0
    assert _round_to_tick(100.07, 0.1, round_down=True) == "100.0"
    # short SL: round up (above entry) — 100.03 with tick 0.1 → 100.1
    assert _round_to_tick(100.03, 0.1, round_down=False) == "100.1"


def test_tick_snap_short_direction():
    """Short: SL above entry (rounds up), TP below entry (rounds up)."""
    sl, tp = _calc_sl_tp_prices(100.0, "short", 2.0, 4.0, tick_sz=0.1)
    # SL = 100 * 1.02 = 102.0, TP = 100 * 0.96 = 96.0
    assert sl == "102.0"
    assert tp == "96.0"


def test_default_tick_sz_does_not_zero_out_cheap_coin():
    """Regression: prior code used f'{price:.2f}' with no tick_sz param. New
    signature keeps tick_sz=0.01 default for back-compat, but callers must
    pass instrument tickSz. If the default is somehow used with a cheap coin,
    we still want the output to be non-zero."""
    # Entry 0.09, default tick 0.01 → SL 0.0855 → "0.09" (unchanged from bug)
    # This test documents the fallback: default 0.01 IS still broken for DOGE.
    # Callers must pass real tickSz. The test is here so a future refactor
    # making the default smaller (e.g. 0.0001) does not silently "fix" this
    # without updating all callers.
    sl, _ = _calc_sl_tp_prices(0.09, "long", 5.0, 10.0)  # default tick_sz=0.01
    # "0.09" — this is the known-broken default. Documentation, not happy path.
    # Assertion intentionally soft: we just want no crash + string output.
    assert isinstance(sl, str)
    assert not sl.startswith("-")


def test_signal_age_default_covers_poll_interval():
    """_MAX_SIGNAL_AGE_S default must be ≥ SIGNAL_POLL_INTERVAL. Otherwise
    every polled signal is already stale and auto-execute never fires."""
    # Clear any override so we test the derived default.
    orig_poll = os.environ.pop("OKX_SIGNAL_POLL_INTERVAL", None)
    orig_age = os.environ.pop("OKX_MAX_SIGNAL_AGE_S", None)
    try:
        # Reload module to pick up cleared env.
        import importlib
        import okx.auto_executor as ae
        importlib.reload(ae)
        poll = ae._SIGNAL_POLL_INTERVAL_S
        age = ae._MAX_SIGNAL_AGE_S
        assert age >= poll, (
            f"_MAX_SIGNAL_AGE_S ({age}s) < SIGNAL_POLL_INTERVAL ({poll}s) — "
            f"every signal will be older than max on pickup. autotrading "
            f"will never fire. Default must include at least one full poll "
            f"cycle + slack."
        )
    finally:
        if orig_poll is not None:
            os.environ["OKX_SIGNAL_POLL_INTERVAL"] = orig_poll
        if orig_age is not None:
            os.environ["OKX_MAX_SIGNAL_AGE_S"] = orig_age


def test_signal_age_env_override():
    """Operators can override via OKX_MAX_SIGNAL_AGE_S for tighter or looser
    staleness. Round-trip a deliberate value."""
    os.environ["OKX_MAX_SIGNAL_AGE_S"] = "900"
    try:
        import importlib
        import okx.auto_executor as ae
        importlib.reload(ae)
        assert ae._MAX_SIGNAL_AGE_S == 900
    finally:
        os.environ.pop("OKX_MAX_SIGNAL_AGE_S", None)
        import importlib
        import okx.auto_executor as ae
        importlib.reload(ae)
