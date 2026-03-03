"""
Monte Carlo simulation for trade validation.

Bootstrap resampling of trade PnL to estimate confidence intervals,
worst-case drawdowns, and strategy robustness.
"""

import numpy as np
from typing import List, Dict, Tuple


def bootstrap_trades(
    trade_pnls: List[float],
    n_simulations: int = 1000,
    seed: int = 42,
) -> Dict:
    """
    Bootstrap resample trade PnL sequence to estimate return distribution.

    Args:
        trade_pnls: List of per-trade PnL percentages
        n_simulations: Number of Monte Carlo runs
        seed: Random seed for reproducibility

    Returns:
        Dict with percentiles, confidence intervals, and simulation data
    """
    if len(trade_pnls) < 5:
        return {
            "mean_return": 0.0,
            "median_return": 0.0,
            "std_return": 0.0,
            "percentile_5": 0.0,
            "percentile_25": 0.0,
            "percentile_75": 0.0,
            "percentile_95": 0.0,
            "worst_case_return": 0.0,
            "best_case_return": 0.0,
            "worst_case_mdd": 0.0,
            "positive_pct": 0.0,
            "n_simulations": 0,
            "n_trades": len(trade_pnls),
            "equity_bands": [],
        }

    rng = np.random.default_rng(seed)
    pnls = np.array(trade_pnls, dtype=float)
    n_trades = len(pnls)

    # Run simulations: resample with replacement
    final_returns = np.zeros(n_simulations)
    max_drawdowns = np.zeros(n_simulations)

    # For equity bands: sample at 10 evenly-spaced points
    n_band_points = min(n_trades, 20)
    band_indices = np.linspace(0, n_trades - 1, n_band_points, dtype=int)
    equity_samples = np.zeros((n_simulations, n_band_points))

    for i in range(n_simulations):
        # Bootstrap: sample n_trades with replacement
        sampled = rng.choice(pnls, size=n_trades, replace=True)
        cum = np.cumsum(sampled)

        final_returns[i] = cum[-1]

        # Max drawdown
        peak = np.maximum.accumulate(cum)
        dd = peak - cum
        max_drawdowns[i] = np.max(dd) if len(dd) > 0 else 0.0

        # Sample equity at band points
        equity_samples[i] = cum[band_indices]

    # Compute equity bands (percentiles at each point)
    bands = []
    for j in range(n_band_points):
        col = equity_samples[:, j]
        bands.append({
            "trade_idx": int(band_indices[j]),
            "p5": round(float(np.percentile(col, 5)), 2),
            "p25": round(float(np.percentile(col, 25)), 2),
            "p50": round(float(np.percentile(col, 50)), 2),
            "p75": round(float(np.percentile(col, 75)), 2),
            "p95": round(float(np.percentile(col, 95)), 2),
        })

    return {
        "mean_return": round(float(np.mean(final_returns)), 2),
        "median_return": round(float(np.median(final_returns)), 2),
        "std_return": round(float(np.std(final_returns)), 2),
        "percentile_5": round(float(np.percentile(final_returns, 5)), 2),
        "percentile_25": round(float(np.percentile(final_returns, 25)), 2),
        "percentile_75": round(float(np.percentile(final_returns, 75)), 2),
        "percentile_95": round(float(np.percentile(final_returns, 95)), 2),
        "worst_case_return": round(float(np.min(final_returns)), 2),
        "best_case_return": round(float(np.max(final_returns)), 2),
        "worst_case_mdd": round(float(np.percentile(max_drawdowns, 95)), 2),
        "positive_pct": round(float(np.mean(final_returns > 0) * 100), 1),
        "n_simulations": n_simulations,
        "n_trades": n_trades,
        "equity_bands": bands,
    }


def compute_oos_metrics(
    is_trades: List[float],
    oos_trades: List[float],
) -> Dict:
    """
    Compare In-Sample vs Out-of-Sample performance.

    Args:
        is_trades: PnL percentages from IS period
        oos_trades: PnL percentages from OOS period

    Returns:
        Dict with IS/OOS metrics and degradation assessment
    """
    def _metrics(pnls: List[float]) -> Dict:
        if not pnls:
            return {
                "trades": 0, "win_rate": 0.0, "total_return": 0.0,
                "profit_factor": 0.0, "max_dd": 0.0, "avg_win": 0.0, "avg_loss": 0.0,
            }
        arr = np.array(pnls)
        wins = arr[arr > 0]
        losses = arr[arr <= 0]
        gross_profit = float(np.sum(wins)) if len(wins) > 0 else 0.0
        gross_loss = abs(float(np.sum(losses))) if len(losses) > 0 else 0.001

        # MDD
        cum = np.cumsum(arr)
        peak = np.maximum.accumulate(cum)
        dd = peak - cum
        max_dd = float(np.max(dd)) if len(dd) > 0 else 0.0

        return {
            "trades": len(pnls),
            "win_rate": round(len(wins) / len(pnls) * 100, 2) if pnls else 0.0,
            "total_return": round(float(np.sum(arr)), 2),
            "profit_factor": round(gross_profit / gross_loss, 2),
            "max_dd": round(max_dd, 2),
            "avg_win": round(float(np.mean(wins)), 4) if len(wins) > 0 else 0.0,
            "avg_loss": round(float(np.mean(losses)), 4) if len(losses) > 0 else 0.0,
        }

    is_m = _metrics(is_trades)
    oos_m = _metrics(oos_trades)

    # Degradation assessment
    if is_m["total_return"] > 0 and oos_m["total_return"] > 0:
        ratio = oos_m["total_return"] / is_m["total_return"]
    elif is_m["total_return"] > 0:
        ratio = 0.0
    else:
        ratio = 1.0  # Both negative or IS zero — can't measure degradation

    if ratio >= 0.7:
        risk = "LOW"
    elif ratio >= 0.4:
        risk = "MEDIUM"
    else:
        risk = "HIGH"

    return {
        "is_metrics": is_m,
        "oos_metrics": oos_m,
        "degradation_ratio": round(ratio, 2),
        "overfit_risk": risk,
    }
