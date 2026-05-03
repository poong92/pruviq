"""
Trade Aggregator — SSoT for portfolio-level metrics.

Used by:
  - api/main.py  (/simulate endpoint)
  - scripts/daily_strategy_ranking.py  (direct-import mode)

Never import FastAPI/HTTP types here — this module must stay framework-free.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import List

import numpy as np


def aggregate_trades(
    all_trades: List[dict],
    n_coins: int,
    is_compounding: bool = False,
) -> dict:
    """Compute portfolio-level metrics from a flat list of trade dicts.

    Each trade dict must have: pnl_pct (float), exit_reason (str),
    time (str YYYY-MM-DD...), exit_time (str YYYY-MM-DD...).

    Returns a dict with keys:
      total_trades, wins, losses, win_rate, profit_factor,
      total_return_pct, avg_win_pct, avg_loss_pct,
      max_drawdown_pct, max_consecutive_losses,
      tp_count, sl_count, timeout_count,
      sharpe_ratio, sortino_ratio, calmar_ratio,
      equity (final equity value, 100-based)
    """
    if not all_trades:
        return {
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "total_return_pct": 0.0,
            "avg_win_pct": 0.0,
            "avg_loss_pct": 0.0,
            "max_drawdown_pct": 0.0,
            "max_consecutive_losses": 0,
            "tp_count": 0,
            "sl_count": 0,
            "timeout_count": 0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "calmar_ratio": 0.0,
            "equity": 100.0,
        }

    n = n_coins if n_coins > 0 else 1
    wins = [t for t in all_trades if t["pnl_pct"] > 0]
    losses = [t for t in all_trades if t["pnl_pct"] <= 0]

    gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0.0
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.0
    profit_factor = round(gross_profit / gross_loss, 4) if gross_loss > 0 else (999.99 if gross_profit > 0 else 0.0)
    win_rate = round(len(wins) / len(all_trades) * 100, 2)
    avg_win = (sum(t["pnl_pct"] for t in wins) / len(wins)) if wins else 0.0
    avg_loss = (sum(t["pnl_pct"] for t in losses) / len(losses)) if losses else 0.0

    # Total return (simple or compounding, normalized by coin count)
    if is_compounding:
        eq = 100.0
        for t in all_trades:
            eq *= (1 + t["pnl_pct"] / (100 * n))
        total_return = round((eq / 100.0 - 1) * 100, 4)
    else:
        total_return = round(sum(t["pnl_pct"] for t in all_trades) / n, 4)

    # Equity curve + MDD
    equity = 100.0
    peak = equity
    max_dd = 0.0
    max_consec = 0
    cur_consec = 0

    for t in all_trades:
        if is_compounding:
            equity = max(equity * (1 + t["pnl_pct"] / (100 * n)), 0.0)
        else:
            equity += t["pnl_pct"] / n
        peak = max(peak, equity)
        dd = (peak - equity) / peak * 100 if peak > 0 else 0.0
        max_dd = max(max_dd, min(dd, 100.0))
        if t["pnl_pct"] <= 0:
            cur_consec += 1
            max_consec = max(max_consec, cur_consec)
        else:
            cur_consec = 0

    # Exit reason counts
    tp_count = sum(1 for t in all_trades if t.get("exit_reason") == "tp")
    sl_count = sum(1 for t in all_trades if t.get("exit_reason") == "sl")
    timeout_count = sum(1 for t in all_trades if t.get("exit_reason") == "timeout")

    # Daily returns for Sharpe/Sortino (zero-fill non-trading days)
    daily_pnl: dict[str, float] = defaultdict(float)
    for t in all_trades:
        day_key = t.get("exit_time", t.get("time", ""))[:10]
        if day_key and day_key != "NaT" and len(day_key) == 10:
            daily_pnl[day_key] += t["pnl_pct"]

    sharpe = sortino = calmar = 0.0
    if daily_pnl and len(daily_pnl) >= 2:
        sorted_days = sorted(daily_pnl.keys())
        d_start = datetime.strptime(sorted_days[0], "%Y-%m-%d")
        d_end = datetime.strptime(sorted_days[-1], "%Y-%m-%d")
        all_days = [
            (d_start + timedelta(days=i)).strftime("%Y-%m-%d")
            for i in range((d_end - d_start).days + 1)
        ]
        daily_returns = np.array([
            daily_pnl[d] / n if d in daily_pnl else 0.0
            for d in all_days
        ])
    elif daily_pnl:
        daily_returns = np.array([v / n for v in daily_pnl.values()])
    else:
        daily_returns = np.array([])

    if len(daily_returns) >= 5:
        dr_avg = float(np.mean(daily_returns))
        dr_std = float(np.std(daily_returns, ddof=1))
        sharpe = round(dr_avg / dr_std * np.sqrt(365), 2) if dr_std > 0 else 0.0
        # TDD Sortino (Sortino & van der Meer 1991)
        downside = np.minimum(daily_returns, 0)
        tdd = float(np.sqrt(np.mean(downside ** 2)))
        sortino = round(dr_avg / tdd * np.sqrt(365), 2) if tdd > 0 else 0.0
        # Calmar: CAGR / MDD
        n_days = len(daily_returns)
        growth_ratio = equity / 100.0 if equity > 0 else 0.001
        years = max(n_days, 1) / 365
        cagr_pct = (growth_ratio ** (1 / years) - 1) * 100 if years > 0 else 0.0
        calmar = round(cagr_pct / max_dd, 2) if max_dd > 0 else 0.0

    return {
        "total_trades": len(all_trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "total_return_pct": total_return,
        "avg_win_pct": round(avg_win, 4),
        "avg_loss_pct": round(avg_loss, 4),
        "max_drawdown_pct": round(max_dd, 4),
        "max_consecutive_losses": max_consec,
        "tp_count": tp_count,
        "sl_count": sl_count,
        "timeout_count": timeout_count,
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "calmar_ratio": calmar,
        "equity": equity,
    }
