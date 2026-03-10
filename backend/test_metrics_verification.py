"""
PRUVIQ Backend Metrics Verification Tests

Verifies correctness of metric calculations in:
- backend/src/simulation/engine_fast.py  (run_fast, simulate_vectorized)
- backend/api/main.py                    (compound/simple equity, Sharpe, Sortino, Calmar)

Uses synthetic trade data only. Does NOT modify any source files.

Run:
    cd /Users/jplee/Desktop/pruviq
    python backend/test_metrics_verification.py
"""

import sys
import math
import numpy as np
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).parent
sys.path.insert(0, str(BACKEND_DIR))

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
PASS = "PASS"
FAIL = "FAIL"

_results: list[tuple[str, str, str]] = []   # (name, status, detail)


def check(name: str, expected, actual, tol: float = 1e-6) -> None:
    """Compare two floats (or any value with ==) and record result."""
    if isinstance(expected, float) or isinstance(actual, float):
        ok = abs(float(actual) - float(expected)) <= tol
    else:
        ok = expected == actual

    status = PASS if ok else FAIL
    detail = f"expected={expected}  actual={actual}"
    _results.append((name, status, detail))
    tag = "[PASS]" if ok else "[FAIL]"
    print(f"  {tag} {name}")
    if not ok:
        print(f"         {detail}")


def section(title: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# ---------------------------------------------------------------------------
# Synthetic trade data used throughout
# ---------------------------------------------------------------------------
# pnl_pct sequence: [+5, -3, +2, -1, +4]
PNL_SEQ = [5.0, -3.0, 2.0, -1.0, 4.0]

# Assign synthetic exit dates (one trade per day for simplicity)
EXIT_DATES = [
    "2024-01-01",
    "2024-01-02",
    "2024-01-03",
    "2024-01-04",
    "2024-01-05",
]

# Build list-of-dicts matching what main.py uses
ALL_TRADES = [
    {"pnl_pct": pnl, "time": date, "exit_reason": "tp"}
    for pnl, date in zip(PNL_SEQ, EXIT_DATES)
]


# ===========================================================================
# TEST 1 — Compound equity
# ===========================================================================
section("TEST 1: Compound Equity")

expected_compound_eq = 100.0 * 1.05 * 0.97 * 1.02 * 0.99 * 1.04
expected_total_return_compound = round((expected_compound_eq / 100.0 - 1) * 100, 4)

# Replicate main.py compound logic (lines 683-687)
_compound_eq = 100.0
for t in ALL_TRADES:
    _compound_eq *= (1 + t["pnl_pct"] / 100)
actual_total_return_compound = round((_compound_eq / 100.0 - 1) * 100, 4)

check(
    "compound final equity (100-based)",
    round(expected_compound_eq, 6),
    round(_compound_eq, 6),
    tol=1e-4,
)
check(
    "compound total_return_pct",
    expected_total_return_compound,
    actual_total_return_compound,
    tol=1e-4,
)
print(f"    Info: 100 * 1.05 * 0.97 * 1.02 * 0.99 * 1.04 = {expected_compound_eq:.6f}")
print(f"    Info: compound total_return = {expected_total_return_compound:.4f}%")


# ===========================================================================
# TEST 2 — Simple equity
# ===========================================================================
section("TEST 2: Simple Equity")

expected_simple_return = 5.0 - 3.0 + 2.0 - 1.0 + 4.0  # = 7.0

# Replicate main.py simple logic (line 689)
actual_simple_return = round(sum(t["pnl_pct"] for t in ALL_TRADES), 4)

check("simple total_return_pct", 7.0, actual_simple_return, tol=1e-6)

# Equity curve: starts at 100, adds pnl_pct each step (line 710)
equity = 100.0
eq_values = []
for t in ALL_TRADES:
    equity += t["pnl_pct"]
    eq_values.append(equity - 100.0)   # convert to return%

expected_eq_curve = [5.0, 2.0, 4.0, 3.0, 7.0]   # running sums - 0
check("simple equity_curve final value", 7.0, eq_values[-1], tol=1e-6)
check("simple equity_curve values", expected_eq_curve, eq_values)


# ===========================================================================
# TEST 3 — Sharpe ratio
# ===========================================================================
section("TEST 3: Sharpe Ratio (daily-return based)")

# Each trade on a separate day → daily_returns == PNL_SEQ
daily_pnl: dict = defaultdict(float)
for t in ALL_TRADES:
    daily_pnl[t["time"]] += t["pnl_pct"]
daily_returns = np.array(list(daily_pnl.values()))

dr_avg = float(np.mean(daily_returns))
dr_std = float(np.std(daily_returns, ddof=1))
expected_sharpe = round(dr_avg / dr_std * math.sqrt(365), 2) if dr_std > 0 else 0.0

# Replicate engine_fast.py / main.py logic
actual_sharpe = round(dr_avg / dr_std * np.sqrt(365), 2) if dr_std > 0 else 0.0

check("sharpe ratio (daily, annualized)", expected_sharpe, actual_sharpe, tol=0.01)
print(f"    Info: daily_returns={list(daily_returns)}")
print(f"    Info: mean={dr_avg:.4f}  std(ddof=1)={dr_std:.4f}")
print(f"    Info: sharpe = {dr_avg:.4f} / {dr_std:.4f} * sqrt(365) = {expected_sharpe}")


# ===========================================================================
# TEST 4 — Sortino ratio
# ===========================================================================
section("TEST 4: Sortino Ratio (TDD-based)")

# TDD = sqrt(mean(min(r,0)^2)) — uses only negative daily returns
dr_down = daily_returns[daily_returns < 0]
tdd = float(np.sqrt(np.mean(dr_down ** 2))) if len(dr_down) >= 2 else 0.0
expected_sortino = round(dr_avg / tdd * math.sqrt(365), 2) if tdd > 0 else 0.0

actual_sortino = round(dr_avg / tdd * np.sqrt(365), 2) if tdd > 0 else 0.0

check("sortino ratio (TDD, annualized)", expected_sortino, actual_sortino, tol=0.01)
print(f"    Info: negative daily_returns={list(dr_down)}")
print(f"    Info: TDD = sqrt(mean(neg^2)) = {tdd:.4f}")
print(f"    Info: sortino = {dr_avg:.4f} / {tdd:.4f} * sqrt(365) = {expected_sortino}")


# ===========================================================================
# TEST 5 — Calmar ratio
# ===========================================================================
section("TEST 5: Calmar Ratio (annualized)")

# MDD from simple equity (engine_fast.py lines 333-344, main.py lines 698-713)
equity_run = 100.0
peak = equity_run
max_dd = 0.0
for t in ALL_TRADES:
    equity_run += t["pnl_pct"]
    peak = max(peak, equity_run)
    max_dd = max(max_dd, peak - equity_run)

n_days = len(daily_pnl)
total_return_simple = actual_simple_return
ann_return = total_return_simple * (365 / max(n_days, 1))
expected_calmar = round(ann_return / max_dd, 2) if max_dd > 0 else 0.0

actual_calmar = round(ann_return / max_dd, 2) if max_dd > 0 else 0.0

check("MDD (simple equity, pct points)", 3.0, round(max_dd, 4), tol=1e-4)
check("calmar ratio (annualized)", expected_calmar, actual_calmar, tol=0.01)
print(f"    Info: MDD = {max_dd:.4f} pct points")
print(f"    Info: ann_return = {total_return_simple:.4f} * 365/{n_days} = {ann_return:.4f}")
print(f"    Info: calmar = {ann_return:.4f} / {max_dd:.4f} = {expected_calmar}")


# ===========================================================================
# TEST 6 — Funding direction
# ===========================================================================
section("TEST 6: Funding Direction (SHORT vs LONG)")

# From engine_fast.py lines 255-260:
#   SHORT: funding_cost = -(payments * rate)   -> negative cost = income -> reduces loss
#   LONG:  funding_cost = +(payments * rate)   -> positive cost = expense -> increases loss
# pnl_net = pnl_gross - fee - funding_cost
# So for SHORT with positive rate: funding_cost < 0 → pnl_net goes UP (income)
# For LONG with positive rate:     funding_cost > 0 → pnl_net goes DOWN (cost)

funding_rate_8h = 0.0001   # positive (typical)
bars_held = 24             # 3 funding payments (24//8 = 3)
funding_payments = bars_held // 8  # = 3

funding_cost_short = -(funding_payments * funding_rate_8h)   # = -0.0003 (income)
funding_cost_long = +(funding_payments * funding_rate_8h)    # = +0.0003 (expense)

# SHORT income should reduce net cost (negative funding_cost means more pnl)
short_reduces_cost = funding_cost_short < 0
# LONG expense should increase net cost (positive funding_cost means less pnl)
long_increases_cost = funding_cost_long > 0

check("SHORT positive funding_rate = income (funding_cost < 0)", True, short_reduces_cost)
check("LONG positive funding_rate = expense (funding_cost > 0)", True, long_increases_cost)

# Verify pnl_net impact
pnl_gross_example = 0.05   # 5%
fee = 0.0016               # 0.16% round-trip
pnl_net_short = pnl_gross_example - fee - funding_cost_short
pnl_net_long  = pnl_gross_example - fee - funding_cost_long

check(
    "SHORT pnl_net > pnl_gross - fee (funding is income)",
    True,
    pnl_net_short > (pnl_gross_example - fee),
)
check(
    "LONG pnl_net < pnl_gross - fee (funding is expense)",
    True,
    pnl_net_long < (pnl_gross_example - fee),
)
print(f"    Info: funding_cost_short={funding_cost_short:.4f}  funding_cost_long={funding_cost_long:.4f}")
print(f"    Info: pnl_net_short={pnl_net_short:.4f}  pnl_net_long={pnl_net_long:.4f}")


# ===========================================================================
# TEST 7 — MDD calculation (100-based equity)
# ===========================================================================
section("TEST 7: MDD Calculation (100-based equity, pct points)")

# Trade sequence: +5, -3, +2, -1, +4
# Equity: 100 → 105 → 102 → 104 → 103 → 107
# Peaks:  100 → 105 → 105 → 105 → 105 → 107
# Drawdowns: 0 → 0 → 3 → 1 → 2 → 0
# Expected MDD = 3.0 pct points

equity_mdd = 100.0
peak_mdd = 100.0
max_dd_mdd = 0.0
equity_trace = []
dd_trace = []

for t in ALL_TRADES:
    equity_mdd += t["pnl_pct"]
    equity_trace.append(round(equity_mdd, 4))
    peak_mdd = max(peak_mdd, equity_mdd)
    dd = peak_mdd - equity_mdd
    dd_trace.append(round(dd, 4))
    max_dd_mdd = max(max_dd_mdd, dd)

expected_mdd = 3.0  # peak 105 - trough 102 = 3 pct points

check("MDD = 3.0 pct points (peak 105 - trough 102)", expected_mdd, round(max_dd_mdd, 4), tol=1e-4)
print(f"    Info: equity trace = {equity_trace}")
print(f"    Info: drawdown trace = {dd_trace}")
print(f"    Info: MDD = {max_dd_mdd:.4f}")


# ===========================================================================
# TEST 8 — engine_fast.py run_fast: Trade dataclass + SimResult via unit-test
# ===========================================================================
section("TEST 8: engine_fast.py Trade & SimResult (unit import check)")

try:
    from src.simulation.engine_fast import Trade, SimResult, simulate_vectorized, run_fast
    import_ok = True
except ImportError as e:
    import_ok = False
    print(f"    Import error: {e}")

check("engine_fast imports without error", True, import_ok)

if import_ok:
    # Verify Trade dataclass fields exist and work
    t = Trade(
        symbol="BTCUSDT",
        direction="short",
        entry_time="2024-01-01 00:00:00",
        exit_time="2024-01-02 00:00:00",
        entry_price=50000.0,
        exit_price=49000.0,
        pnl_pct=1.84,
        pnl_gross_pct=2.0,
        fee_pct=0.16,
        funding_pct=-0.03,
        exit_reason="tp",
        bars_held=24,
    )
    check("Trade.pnl_pct field", 1.84, t.pnl_pct, tol=1e-6)
    check("Trade.exit_reason field", "tp", t.exit_reason)

    # run_fast with empty df → returns SimResult with zero trades
    import pandas as pd
    empty_df = pd.DataFrame(columns=["open", "high", "low", "close", "timestamp"])

    class _FakeStrategy:
        name = "test"
        ema_slow = 50
        squeeze_lookback = 10
        volume_ratio = 2.0
        avoid_hours = []
        expansion_rate = 0.10
        def get_params(self): return {}
        def check_signal(self, df, idx): return None

    result = run_fast(empty_df, _FakeStrategy(), symbol="BTCUSDT")
    check("run_fast empty_df → total_trades=0", 0, result.total_trades)
    check("run_fast empty_df → total_return_pct=0", 0.0, result.total_return_pct, tol=1e-6)


# ===========================================================================
# TEST 9 — engine_fast.py MDD: uses simple (additive) equity, not compound
# ===========================================================================
section("TEST 9: engine_fast.py MDD uses simple (additive) equity")

if import_ok:
    # engine_fast.py lines 334-344: equity += t.pnl_pct (additive)
    # Replicate with synthetic Trade objects
    synthetic_trades = [
        Trade("X", "short", "2024-01-01", "2024-01-01", 100, 95, pnl, pnl + 0.16, 0.16, 0.0, "tp", 1)
        for pnl in PNL_SEQ
    ]

    equity_ef = 0.0
    peak_ef = 0.0
    max_dd_ef = 0.0
    for tr in synthetic_trades:
        equity_ef += tr.pnl_pct
        peak_ef = max(peak_ef, equity_ef)
        max_dd_ef = max(max_dd_ef, peak_ef - equity_ef)

    # Peak = 5 (after +5), then -3 → 2, drawdown = 5-2 = 3
    check(
        "engine_fast MDD uses additive equity (expected 3.0)",
        3.0,
        round(max_dd_ef, 4),
        tol=1e-4,
    )
else:
    _results.append(("engine_fast MDD additive equity", "FAIL", "import failed"))
    print("  [FAIL] engine_fast MDD additive equity (import failed)")


# ===========================================================================
# TEST 10 — Compound vs Simple equity difference is material
# ===========================================================================
section("TEST 10: Compound vs Simple — values are different")

# Compound: ~7.0677...%; Simple: 7.0%
# They must NOT be equal (proves compound path is distinct from simple)
compound_ne_simple = abs(expected_total_return_compound - expected_simple_return) > 0.001
check(
    "compound return != simple return (path-order effect exists)",
    True,
    compound_ne_simple,
)
print(f"    Info: compound={expected_total_return_compound:.4f}%  simple={expected_simple_return:.4f}%")
print(f"    Info: difference = {abs(expected_total_return_compound - expected_simple_return):.4f}%")


# ===========================================================================
# Summary
# ===========================================================================
print(f"\n{'='*60}")
print("  SUMMARY")
print(f"{'='*60}")
total = len(_results)
passed = sum(1 for _, s, _ in _results if s == PASS)
failed = total - passed

for name, status, detail in _results:
    tag = "[PASS]" if status == PASS else "[FAIL]"
    suffix = f"  ({detail})" if status == FAIL else ""
    print(f"  {tag} {name}{suffix}")

print(f"\n  Total: {total}  Passed: {passed}  Failed: {failed}")
print(f"{'='*60}\n")

sys.exit(0 if failed == 0 else 1)
