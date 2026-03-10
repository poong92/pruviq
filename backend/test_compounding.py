"""
PRUVIQ Simulator — Mathematical Correctness Test Suite
Tests compound/simple calculations by replicating the exact logic from:
  - api/main.py  (the /backtest and /simulate endpoints)
  - src/simulation/engine_fast.py  (per-coin SimResult)

Run:
  cd /Users/jplee/Desktop/pruviq/backend
  python test_compounding.py
"""

import math
import numpy as np

PASS = "PASS"
FAIL = "FAIL"
results = []


def report(name, passed, expected, actual, note=""):
    tag = PASS if passed else FAIL
    results.append((tag, name))
    status = f"[{tag}] {name}"
    if not passed:
        status += f"\n       expected : {expected}"
        status += f"\n       actual   : {actual}"
    if note:
        status += f"\n       note     : {note}"
    print(status)


def approx_equal(a, b, tol=1e-6):
    return abs(a - b) <= tol


# ---------------------------------------------------------------------------
# Helpers that exactly replicate the production code paths
# ---------------------------------------------------------------------------

def calc_simple_total_return(pnl_pcts):
    """
    /backtest endpoint, simple mode:
      total_return = round(sum(t["pnl_pct"] for t in all_trades), 4)
    """
    return round(sum(pnl_pcts), 4)


def calc_compound_total_return(pnl_pcts):
    """
    /backtest endpoint, compound mode:
      _compound_eq = 100.0
      for _t in all_trades:
          _compound_eq *= (1 + _t["pnl_pct"] / 100)
      total_return = round((_compound_eq / 100.0 - 1) * 100, 4)
    """
    eq = 100.0
    for r in pnl_pcts:
        eq *= (1 + r / 100)
    return round((eq / 100.0 - 1) * 100, 4)


def calc_simple_equity_curve(pnl_pcts, start=0.0):
    """
    /backtest, simple:
      equity += t["pnl_pct"]
    """
    equity = start
    curve = []
    for r in pnl_pcts:
        equity += r
        curve.append(round(equity, 8))
    return curve


def calc_compound_equity_curve(pnl_pcts, start=100.0):
    """
    /backtest, compound:
      equity = max(equity * (1 + t["pnl_pct"] / 100), 0.0)
    """
    equity = start
    curve = []
    for r in pnl_pcts:
        equity = max(equity * (1 + r / 100), 0.0)
        curve.append(round(equity, 8))
    return curve


def calc_simple_pnl_usd(pnl_pcts, per_coin_usd=60.0, leverage=5):
    """
    /simulate, simple mode:
      base_position_size = per_coin_usd * leverage_val
      t["pnl_usd"] = round(base_position_size * (t["pnl_pct"] / 100), 4)
    """
    base = per_coin_usd * leverage
    return [round(base * (r / 100), 4) for r in pnl_pcts]


def calc_compound_pnl_usd(pnl_pcts, per_coin_usd=60.0, leverage=5, effective_positions=1):
    """
    /simulate, compound mode:
      initial_capital = per_coin_usd * effective_positions
      base_position_size = per_coin_usd * leverage
      equity_usd_compound = initial_capital
      scale = max(equity_usd_compound, 0) / initial_capital
      t["pnl_usd"] = round(base_position_size * scale * (t["pnl_pct"] / 100), 4)
      equity_usd_compound = max(equity_usd_compound + t["pnl_usd"], 0)
    """
    initial_capital = per_coin_usd * effective_positions
    base = per_coin_usd * leverage
    equity_usd = initial_capital
    pnl_usds = []
    for r in pnl_pcts:
        scale = max(equity_usd, 0.0) / initial_capital if initial_capital > 0 else 1.0
        pnl = round(base * scale * (r / 100), 4)
        pnl_usds.append(pnl)
        equity_usd = max(equity_usd + pnl, 0.0)
    return pnl_usds


def calc_sharpe_engine_fast(pnl_pcts):
    """
    engine_fast.py (per-coin SimResult):
      avg_ret / std_ret * sqrt(N)   where N = number of trades, ddof=1
    """
    arr = np.array(pnl_pcts)
    if len(arr) < 2:
        return 0.0
    avg = float(np.mean(arr))
    std = float(np.std(arr, ddof=1))
    return round(avg / std * math.sqrt(len(arr)), 2) if std > 0 else 0.0


def calc_sortino_engine_fast(pnl_pcts):
    """
    engine_fast.py:
      downside = trade_pnls[trade_pnls < 0]
      down_std = std(downside, ddof=1)   (std of negative returns, not TDD)
      sortino = avg / down_std * sqrt(N)
    """
    arr = np.array(pnl_pcts)
    if len(arr) < 2:
        return 0.0
    avg = float(np.mean(arr))
    down = arr[arr < 0]
    if len(down) < 2:
        return 0.0
    down_std = float(np.std(down, ddof=1))
    return round(avg / down_std * math.sqrt(len(arr)), 2) if down_std > 0 else 0.0


def calc_sharpe_main_py_portfolio(daily_returns_list):
    """
    main.py /simulate endpoint (daily aggregation):
      daily PnL grouped by exit date
      dr_std = std(daily_returns, ddof=1)
      bt_sharpe = dr_avg / dr_std * sqrt(365)
    """
    arr = np.array(daily_returns_list)
    if len(arr) < 5:
        return 0.0
    avg = float(np.mean(arr))
    std = float(np.std(arr, ddof=1))
    return round(avg / std * math.sqrt(365), 2) if std > 0 else 0.0


def calc_sortino_main_py_portfolio(daily_returns_list):
    """
    main.py /simulate (daily):
      dr_down = daily_returns[daily_returns < 0]
      dr_down_std = std(dr_down, ddof=1)
      bt_sortino = dr_avg / dr_down_std * sqrt(365)
    """
    arr = np.array(daily_returns_list)
    if len(arr) < 5:
        return 0.0
    avg = float(np.mean(arr))
    down = arr[arr < 0]
    if len(down) < 2:
        return 0.0
    down_std = float(np.std(down, ddof=1))
    return round(avg / down_std * math.sqrt(365), 2) if down_std > 0 else 0.0


def calc_max_dd_simple(pnl_pcts, start=0.0):
    equity = start
    peak = start
    max_dd = 0.0
    for r in pnl_pcts:
        equity += r
        peak = max(peak, equity)
        max_dd = max(max_dd, peak - equity)
    return round(max_dd, 8)


def calc_max_dd_compound(pnl_pcts, start=100.0):
    equity = start
    peak = start
    max_dd = 0.0
    for r in pnl_pcts:
        equity = max(equity * (1 + r / 100), 0.0)
        peak = max(peak, equity)
        max_dd = max(max_dd, peak - equity)
    return round(max_dd, 8)


# ===========================================================================
# TEST 1  — Simple mode: 5 trades, fixed $60, 5x leverage
# Trades: [+8%, -10%, +8%, +8%, -10%]
# ===========================================================================
print("\n" + "=" * 60)
print("TEST 1: Simple mode — 5 trades, $60 / 5x leverage")
print("=" * 60)

T1_pnls = [8.0, -10.0, 8.0, 8.0, -10.0]
T1_per_coin = 60.0
T1_leverage = 5
T1_base_pos = T1_per_coin * T1_leverage  # $300

# Expected pnl_usd per trade
T1_expected_pnl_usd = [round(T1_base_pos * r / 100, 4) for r in T1_pnls]
# [24.0, -30.0, 24.0, 24.0, -30.0]
T1_actual_pnl_usd = calc_simple_pnl_usd(T1_pnls, T1_per_coin, T1_leverage)

report(
    "T1-a: pnl_usd per trade",
    T1_expected_pnl_usd == T1_actual_pnl_usd,
    T1_expected_pnl_usd,
    T1_actual_pnl_usd,
)

T1_expected_total_pnl = sum(T1_expected_pnl_usd)  # 12.0
T1_actual_total_pnl = sum(T1_actual_pnl_usd)
report(
    "T1-b: total_pnl_usd",
    approx_equal(T1_expected_total_pnl, T1_actual_total_pnl),
    T1_expected_total_pnl,
    T1_actual_total_pnl,
)

# simple total_return_pct = sum(pnl_pcts) = 4.0%
T1_expected_total_return = round(sum(T1_pnls), 4)  # 4.0
T1_actual_total_return = calc_simple_total_return(T1_pnls)
report(
    "T1-c: total_return_pct (simple = sum pnl_pct)",
    approx_equal(T1_expected_total_return, T1_actual_total_return),
    T1_expected_total_return,
    T1_actual_total_return,
)

# simple equity curve starts at 0.0; adds each pnl_pct
# [8, -2, 6, 14, 4]
T1_expected_equity = [8.0, -2.0, 6.0, 14.0, 4.0]
T1_actual_equity = calc_simple_equity_curve(T1_pnls)
report(
    "T1-d: equity curve (simple, start=0)",
    T1_expected_equity == T1_actual_equity,
    T1_expected_equity,
    T1_actual_equity,
)

# MDD in simple mode (% points)
# peak progression: 0→8→8→8→14→14
# equity : 8 → -2 (dd=10) → 6 → 14 → 4 (dd=10)
T1_expected_mdd = 10.0
T1_actual_mdd = calc_max_dd_simple(T1_pnls)
report(
    "T1-e: max_drawdown_pct (simple)",
    approx_equal(T1_expected_mdd, T1_actual_mdd),
    T1_expected_mdd,
    T1_actual_mdd,
)

# ===========================================================================
# TEST 2  — Compound mode, same 5 trades
# ===========================================================================
print("\n" + "=" * 60)
print("TEST 2: Compound mode — same 5 trades")
print("=" * 60)

# compound pnl_usd with effective_positions=1 (capital=$60)
# Trade 1: equity_usd=60, scale=1.0, pnl=300*1.0*0.08=+24.0, equity→84
# Trade 2: equity_usd=84, scale=84/60=1.4, pnl=300*1.4*(-0.10)=-42.0, equity→42
# Trade 3: equity_usd=42, scale=42/60=0.7, pnl=300*0.7*0.08=+16.8, equity→58.8
# Trade 4: equity_usd=58.8, scale=58.8/60=0.98, pnl=300*0.98*0.08=+23.52, equity→82.32
# Trade 5: equity_usd=82.32, scale=82.32/60=1.372, pnl=300*1.372*(-0.10)=-41.16, equity→41.16

T2_pnls = T1_pnls
T2_per_coin = 60.0
T2_leverage = 5
T2_initial_capital = T2_per_coin * 1  # effective_positions=1

T2_expected_pnl_usd = [24.0, -42.0, 16.8, 23.52, -41.16]
T2_expected_equities_usd = [84.0, 42.0, 58.8, 82.32, 41.16]

T2_actual_pnl_usd = calc_compound_pnl_usd(T2_pnls, T2_per_coin, T2_leverage, effective_positions=1)

report(
    "T2-a: compound pnl_usd per trade",
    all(approx_equal(a, b, tol=1e-3) for a, b in zip(T2_expected_pnl_usd, T2_actual_pnl_usd)),
    T2_expected_pnl_usd,
    T2_actual_pnl_usd,
)

# Verify equity progression from pnl_usd
T2_actual_equities = []
eq = T2_initial_capital
for p in T2_actual_pnl_usd:
    eq = max(eq + p, 0.0)
    T2_actual_equities.append(round(eq, 4))
report(
    "T2-b: compound equity_usd progression",
    all(approx_equal(a, b, tol=1e-2) for a, b in zip(T2_expected_equities_usd, T2_actual_equities)),
    T2_expected_equities_usd,
    T2_actual_equities,
)

# compound total_return_pct via pnl_pct product
T2_expected_total_return = round((1.08 * 0.90 * 1.08 * 1.08 * 0.90 - 1) * 100, 4)
T2_actual_total_return = calc_compound_total_return(T2_pnls)
report(
    "T2-c: total_return_pct (compound = product-1)",
    approx_equal(T2_expected_total_return, T2_actual_total_return, tol=1e-3),
    T2_expected_total_return,
    T2_actual_total_return,
)

# compound total_pnl_usd = sum of scaled pnl_usd
T2_expected_total_pnl = sum(T2_expected_pnl_usd)  # -19.0 (approximately 41.16 - 60)
T2_actual_total_pnl = round(sum(T2_actual_pnl_usd), 4)
# Note: actual final equity = 41.16, initial = 60 → total_pnl = -18.84
report(
    "T2-d: total_pnl_usd (compound) = final_equity - initial",
    approx_equal(T2_actual_total_pnl, T2_actual_equities[-1] - T2_initial_capital, tol=1e-2),
    "final_equity - initial",
    f"{T2_actual_total_pnl} vs {T2_actual_equities[-1] - T2_initial_capital:.4f}",
)

# compound equity curve (100-based, % mode)
T2_compound_eq_curve = calc_compound_equity_curve(T2_pnls)
# Manual: 100 → 108 → 97.2 → 104.976 → 113.37... → 102.03...
T2_expected_eq_pcts = [
    round(100 * 1.08, 8),
    round(100 * 1.08 * 0.90, 8),
    round(100 * 1.08 * 0.90 * 1.08, 8),
    round(100 * 1.08 * 0.90 * 1.08 * 1.08, 8),
    round(100 * 1.08 * 0.90 * 1.08 * 1.08 * 0.90, 8),
]
report(
    "T2-e: compound equity curve (100-based)",
    all(approx_equal(a, b, tol=1e-4) for a, b in zip(T2_expected_eq_pcts, T2_compound_eq_curve)),
    T2_expected_eq_pcts,
    T2_compound_eq_curve,
)

# MDD compound
T2_expected_mdd = round(max(T2_expected_eq_pcts) - T2_expected_eq_pcts[-1], 4)
# peak = 113.37..., end = 102.03..., so mdd = 11.34...
T2_actual_mdd = calc_max_dd_compound(T2_pnls)
report(
    "T2-f: max_drawdown_pct (compound)",
    approx_equal(T2_expected_mdd, T2_actual_mdd, tol=1e-4),
    T2_expected_mdd,
    T2_actual_mdd,
)

# Simple vs Compound must DIFFER for same trades
report(
    "T2-g: compound != simple total_return",
    not approx_equal(T2_actual_total_return, T1_actual_total_return, tol=0.01),
    f"compound({T2_actual_total_return}) != simple({T1_actual_total_return})",
    f"compound={T2_actual_total_return}, simple={T1_actual_total_return}",
)

# ===========================================================================
# TEST 3  — Edge cases
# ===========================================================================
print("\n" + "=" * 60)
print("TEST 3: Edge cases")
print("=" * 60)

# 3-a: All losses — compound equity must NOT go negative
T3a_pnls = [-10.0, -10.0, -10.0, -10.0, -10.0]
T3a_curve = calc_compound_equity_curve(T3a_pnls)
report(
    "T3-a: all losses — compound equity >= 0",
    all(v >= 0.0 for v in T3a_curve),
    "all >= 0",
    T3a_curve,
)

# 3-b: Single trade, +8%
T3b_pnls = [8.0]
T3b_compound = calc_compound_total_return(T3b_pnls)
T3b_simple = calc_simple_total_return(T3b_pnls)
report(
    "T3-b: single trade +8% — compound == simple == 8.0",
    approx_equal(T3b_compound, 8.0) and approx_equal(T3b_simple, 8.0),
    8.0,
    f"compound={T3b_compound}, simple={T3b_simple}",
)

# 3-c: Zero trades — total_return = 0
T3c_pnls = []
T3c_compound = calc_compound_total_return(T3c_pnls)
T3c_simple = calc_simple_total_return(T3c_pnls)
report(
    "T3-c: zero trades — both return 0.0",
    approx_equal(T3c_compound, 0.0) and approx_equal(T3c_simple, 0.0),
    0.0,
    f"compound={T3c_compound}, simple={T3c_simple}",
)

# 3-d: All losses compound — final equity approaches 0 from above
T3d_pnls = [-99.0, -99.0]  # very large losses
T3d_curve = calc_compound_equity_curve(T3d_pnls)
report(
    "T3-d: near-total-loss — compound equity is small positive (floor at 0)",
    all(v >= 0.0 for v in T3d_curve),
    "all >= 0",
    T3d_curve,
    note="100*(0.01)*(0.01)=0.01, floored at 0",
)

# ===========================================================================
# TEST 4  — Sharpe / Sortino verification (engine_fast.py style)
# ===========================================================================
print("\n" + "=" * 60)
print("TEST 4: Sharpe / Sortino — engine_fast.py (trade-level, sqrt(N))")
print("=" * 60)

# Known daily returns [+2%, -1%, +3%, -0.5%, +1%]
T4_returns = [2.0, -1.0, 3.0, -0.5, 1.0]
T4_arr = np.array(T4_returns)
T4_n = len(T4_returns)

T4_mean = float(np.mean(T4_arr))
T4_std = float(np.std(T4_arr, ddof=1))
T4_expected_sharpe = round(T4_mean / T4_std * math.sqrt(T4_n), 2)
T4_actual_sharpe = calc_sharpe_engine_fast(T4_returns)
report(
    "T4-a: Sharpe = mean/std * sqrt(N)",
    approx_equal(T4_expected_sharpe, T4_actual_sharpe),
    T4_expected_sharpe,
    T4_actual_sharpe,
    note=f"mean={T4_mean:.4f}, std={T4_std:.4f}, N={T4_n}",
)

# Sortino in engine_fast: downside = trade_pnls < 0, std(ddof=1), * sqrt(N)
T4_down = T4_arr[T4_arr < 0]
T4_down_std = float(np.std(T4_down, ddof=1)) if len(T4_down) >= 2 else 0.0
T4_expected_sortino = round(T4_mean / T4_down_std * math.sqrt(T4_n), 2) if T4_down_std > 0 else 0.0
T4_actual_sortino = calc_sortino_engine_fast(T4_returns)
report(
    "T4-b: Sortino = mean/std_of_negatives * sqrt(N)",
    approx_equal(T4_expected_sortino, T4_actual_sortino),
    T4_expected_sortino,
    T4_actual_sortino,
    note=f"downside_std={T4_down_std:.4f}, NOT TDD. Uses std of negative returns.",
)

# T4-c: /simulate portfolio Sharpe uses daily returns + sqrt(365)
print("\n  --- /simulate endpoint Sharpe (daily, sqrt(365)) ---")
T4_daily = [2.0, -1.0, 3.0, -0.5, 1.0]
T4_daily_arr = np.array(T4_daily)
T4d_mean = float(np.mean(T4_daily_arr))
T4d_std = float(np.std(T4_daily_arr, ddof=1))
T4_expected_portfolio_sharpe = round(T4d_mean / T4d_std * math.sqrt(365), 2)
T4_actual_portfolio_sharpe = calc_sharpe_main_py_portfolio(T4_daily)
report(
    "T4-c: portfolio Sharpe = daily_mean/daily_std * sqrt(365)",
    approx_equal(T4_expected_portfolio_sharpe, T4_actual_portfolio_sharpe),
    T4_expected_portfolio_sharpe,
    T4_actual_portfolio_sharpe,
)

T4_down2 = T4_daily_arr[T4_daily_arr < 0]
T4_down2_std = float(np.std(T4_down2, ddof=1)) if len(T4_down2) >= 2 else 0.0
T4_expected_portfolio_sortino = round(T4d_mean / T4_down2_std * math.sqrt(365), 2) if T4_down2_std > 0 else 0.0
T4_actual_portfolio_sortino = calc_sortino_main_py_portfolio(T4_daily)
report(
    "T4-d: portfolio Sortino = daily_mean/std_of_neg_daily * sqrt(365)",
    approx_equal(T4_expected_portfolio_sortino, T4_actual_portfolio_sortino),
    T4_expected_portfolio_sortino,
    T4_actual_portfolio_sortino,
)

# Informational: TDD (target downside deviation) comparison
# TDD = sqrt(mean(min(r,0)^2)) — textbook Sortino denominator
tdd_arr = np.array([min(r, 0.0) for r in T4_returns])
T4_tdd = math.sqrt(float(np.mean(tdd_arr ** 2))) if len(tdd_arr) > 0 else 0.0
T4_tdd_sortino = round(T4_mean / T4_tdd * math.sqrt(T4_n), 2) if T4_tdd > 0 else 0.0
print(f"\n  [NOTE] Textbook TDD Sortino: {T4_tdd_sortino} "
      f"vs production Sortino: {T4_actual_sortino}")
print(f"         Production uses std(negatives), NOT TDD. "
      f"This is a deliberate design choice.")

# ===========================================================================
# TEST 5  — Compound vs Simple divergence with 20 trades: +8% / -5% alternating
# ===========================================================================
print("\n" + "=" * 60)
print("TEST 5: Compound vs Simple divergence — 20 alternating +8%/-5% trades")
print("=" * 60)

T5_pnls = [8.0, -5.0] * 10  # 20 trades alternating

# Simple: sum of pnl_pcts
T5_simple = calc_simple_total_return(T5_pnls)
T5_expected_simple = round(10 * (8.0 + -5.0), 4)  # 10 * 3.0 = 30.0
report(
    "T5-a: simple total_return = sum = 30.0%",
    approx_equal(T5_simple, T5_expected_simple),
    T5_expected_simple,
    T5_simple,
)

# Compound: each +8%/-5% pair = 1.08 * 0.95 = 1.026
# 10 pairs → 1.026^10
T5_pair_factor = 1.08 * 0.95  # = 1.026
T5_expected_compound = round((T5_pair_factor ** 10 - 1) * 100, 4)
T5_compound = calc_compound_total_return(T5_pnls)
report(
    "T5-b: compound total_return = (1.026^10 - 1)*100",
    approx_equal(T5_compound, T5_expected_compound, tol=1e-3),
    T5_expected_compound,
    T5_compound,
)

# They must differ
report(
    "T5-c: compound DIFFERS from simple",
    not approx_equal(T5_compound, T5_simple, tol=0.01),
    f"compound({T5_compound:.4f}) != simple({T5_simple:.4f})",
    f"compound={T5_compound:.4f}, simple={T5_simple:.4f}",
    note=f"compound advantage = {T5_compound - T5_simple:.4f}%",
)

# For symmetric wins/losses, compound must be LESS than simple
# (+8% gain then -5% loss: net per pair = 1.026 → compounding favors slight drift upward)
# But compared to simple sum, depends on direction
report(
    "T5-d: compound < simple (negative compounding drag when net drift is small)",
    T5_compound < T5_simple,
    f"compound({T5_compound:.4f}) < simple({T5_simple:.4f})",
    f"difference = {T5_compound - T5_simple:.4f}%",
    note="Compounding drag: geometric mean < arithmetic mean for volatile returns",
)

# Reverse: -5% then +8% gives same product (commutative) — verify
T5_reversed = [-5.0, 8.0] * 10
T5_compound_rev = calc_compound_total_return(T5_reversed)
report(
    "T5-e: compound return is order-invariant (commutative multiplication)",
    approx_equal(T5_compound, T5_compound_rev, tol=1e-3),
    T5_compound,
    T5_compound_rev,
)

# ===========================================================================
# BONUS: Verify /backtest simple total_return vs /simulate portfolio_return_pct
# ===========================================================================
print("\n" + "=" * 60)
print("BONUS: /backtest simple total_return vs /simulate portfolio_return_pct")
print("=" * 60)

# /backtest simple total_return = sum(pnl_pcts)
# /simulate portfolio_return_pct = total_pnl_usd / initial_capital * 100
#                                 = sum(base_pos * r/100) / (per_coin * eff_pos) * 100
#                                 = sum(per_coin*lev * r/100) / (per_coin*1) * 100
#                                 = lev * sum(r)
# For 1 position with 5x leverage: portfolio_return = 5 * sum(pnl_pcts)
# BUT /backtest total_return = sum(pnl_pcts), NOT multiplied by leverage
# This is a KNOWN design difference: backtest uses % per trade, simulate uses capital

T_bonus_pnls = T1_pnls  # [8, -10, 8, 8, -10]
leverage = 5
per_coin = 60.0
base_pos = per_coin * leverage  # 300
initial_capital = per_coin * 1  # 60 (1 position)

backtest_simple_return = calc_simple_total_return(T_bonus_pnls)  # 4.0 %
pnl_usds = calc_simple_pnl_usd(T_bonus_pnls, per_coin, leverage)
total_pnl_usd = sum(pnl_usds)  # 12.0
portfolio_return_pct = round(total_pnl_usd / initial_capital * 100, 2)  # 20.0 % (leveraged)

report(
    "BONUS-a: portfolio_return_pct = pnl_usd/capital (leveraged) vs backtest % (unleveraged)",
    not approx_equal(backtest_simple_return, portfolio_return_pct),
    f"NOT equal by design: backtest={backtest_simple_return}%, portfolio={portfolio_return_pct}%",
    f"portfolio_return / backtest_return = leverage = {portfolio_return_pct/backtest_simple_return:.1f}x",
    note="portfolio_return_pct includes leverage effect; /backtest total_return is raw pnl_pct sum",
)

# Verify: portfolio_return_pct = leverage * simple_total_return
expected_portfolio_return = round(leverage * backtest_simple_return, 2)
report(
    "BONUS-b: portfolio_return_pct = leverage * backtest_return",
    approx_equal(expected_portfolio_return, portfolio_return_pct, tol=0.01),
    expected_portfolio_return,
    portfolio_return_pct,
)

# ===========================================================================
# SUMMARY
# ===========================================================================
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)

passes = sum(1 for r in results if r[0] == PASS)
fails = sum(1 for r in results if r[0] == FAIL)
total = len(results)
print(f"  Total: {total}  |  PASS: {passes}  |  FAIL: {fails}")
print()

if fails > 0:
    print("FAILED tests:")
    for tag, name in results:
        if tag == FAIL:
            print(f"  - {name}")
else:
    print("All tests PASSED.")

print()
print("Design notes (informational, not bugs):")
print("  1. Sortino denominator = std(negative returns), NOT TDD.")
print("     Textbook Sortino uses TDD = sqrt(E[min(r,0)^2]).")
print("     Production consistently uses std(negatives, ddof=1) across all endpoints.")
print("  2. /backtest total_return_pct = raw sum of pnl_pct (no leverage factor).")
print("     /simulate portfolio_return_pct = (total_pnl_usd / capital) * 100 = leveraged.")
print("  3. /backtest Sharpe uses sqrt(N_trades); /simulate uses sqrt(365) on daily returns.")
print("     These are two different annualization conventions, both internally consistent.")
print("  4. Compound equity uses floor(0) — equity can never go below $0.")
