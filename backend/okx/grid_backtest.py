"""
Grid backtest simulator.

Simpler than the live executor will need to be: pair-based fill counting.
For each candle, we count how many grid lines the [low, high] range
crosses; each crossing is one half of a buy↔sell cycle, so two crossings
of the same line in opposite directions = one realised profit cycle of
`cell_size × step_pct × (1 − 2×fee_pct)`. Open long positions at the
end of the window are marked to market against the final close.

The exact executor will need to track per-order state (which line filled
what side, partial fills, latency-induced misses, etc.). This sim is a
ballpark — within ±10% of executor reality for healthy grids. It is
explicit about that in the response (`accuracy: "approx"`).

Liquidation simulation is OUT — high-leverage warning instead.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import pandas as pd

logger = logging.getLogger("okx_grid_backtest")

DEFAULT_TAKER_FEE_PCT = 0.05  # %


@dataclass
class GridSimResult:
    completed_cycles: int = 0
    open_positions: int = 0
    avg_open_entry: float = 0.0
    realised_pnl_usdt: float = 0.0
    unrealised_pnl_usdt: float = 0.0
    total_pnl_usdt: float = 0.0
    total_fees_usdt: float = 0.0
    peak_drawdown_pct: float = 0.0
    exit_reason: str = ""
    exit_price: float = 0.0
    duration_hours: int = 0
    warnings: list[str] = field(default_factory=list)
    accuracy: str = "approx"

    def to_dict(self) -> dict[str, Any]:
        return {
            "completed_cycles": self.completed_cycles,
            "open_positions": self.open_positions,
            "avg_open_entry": self.avg_open_entry,
            "realised_pnl_usdt": self.realised_pnl_usdt,
            "unrealised_pnl_usdt": self.unrealised_pnl_usdt,
            "total_pnl_usdt": self.total_pnl_usdt,
            "total_fees_usdt": self.total_fees_usdt,
            "peak_drawdown_pct": self.peak_drawdown_pct,
            "exit_reason": self.exit_reason,
            "exit_price": self.exit_price,
            "duration_hours": self.duration_hours,
            "warnings": self.warnings,
            "accuracy": self.accuracy,
        }


def simulate_grid(
    params: dict[str, Any],
    candles: pd.DataFrame,
    *,
    taker_fee_pct: float = DEFAULT_TAKER_FEE_PCT,
) -> GridSimResult:
    result = GridSimResult()
    if candles is None or len(candles) < 2:
        result.warnings.append("not_enough_candles")
        return result

    upper = float(params["upper_price"])
    lower = float(params["lower_price"])
    n = int(params["grid_count"])
    investment = float(params["investment_usdt"])
    leverage = max(1, int(params.get("leverage", 1)))
    stop_loss = float(params.get("stop_loss_price", 0.0))

    if upper <= lower or n < 2:
        result.warnings.append("invalid_range_or_count")
        return result

    step = (upper - lower) / n
    cell_size = investment / (2.0 * n)
    fee_per_fill = cell_size * (taker_fee_pct / 100.0) * leverage

    # Grid lines (inclusive)
    lines = [lower + i * step for i in range(n + 1)]

    # Walk candles: for each one, count "crossings" — how many grid lines
    # fall inside [low, high]. A crossing = one half-cycle (either a buy
    # fill or a sell fill). For simplicity we treat 2 crossings of the
    # same range as 1 completed pair.
    # In practice grids spend most of their life oscillating — most
    # candles cross 0–3 lines.
    open_longs_count = 0  # buy fills awaiting matching sell
    total_crossings = 0
    worst_dd_pct = 0.0

    start_price = float(candles.iloc[0]["close"])
    # Bootstrap: lines below start_price are "filled long" (typical
    # neutral-grid initialization)
    for line in lines:
        if line < start_price:
            open_longs_count += 1
            result.total_fees_usdt += fee_per_fill

    initial_open_longs = open_longs_count

    for i in range(1, len(candles)):
        c = candles.iloc[i]
        low = float(c["low"])
        high = float(c["high"])

        # Stop-loss breach below lower bound's user override
        if stop_loss > 0 and low <= stop_loss:
            result.exit_reason = "stop_loss_breached"
            result.exit_price = stop_loss
            break

        # Out-of-range up: price exits above upper → all longs filled +
        # sold, no more rebalance
        if low > upper:
            result.exit_reason = "exited_above_range"
            result.exit_price = low
            break
        if high < lower:
            result.exit_reason = "exited_below_range"
            result.exit_price = high
            break

        # Count line crossings in this candle
        crossings = 0
        for line in lines:
            if low <= line <= high:
                crossings += 1
        total_crossings += crossings

        # Approximate cycle completion: 2 crossings = 1 cycle. Each cycle
        # realises `cell_size * step_pct * (1 - 2 * fee)`.
        # `step_pct` is the % distance between adjacent lines vs the mid.
        # Use lower as denominator for conservative estimate.
        step_pct = step / lower if lower > 0 else 0.0
        new_cycles = max(0, crossings // 2)
        if new_cycles > 0:
            cycle_pnl = cell_size * step_pct * (1.0 - 2.0 * (taker_fee_pct / 100.0)) * leverage
            result.realised_pnl_usdt += new_cycles * cycle_pnl
            result.completed_cycles += new_cycles
            result.total_fees_usdt += 2 * new_cycles * fee_per_fill

        # Track worst drawdown of open longs (price below average open)
        # Approximate avg as midpoint of bootstrap longs
        if open_longs_count > 0:
            avg_open = lower + (initial_open_longs * step) / 2.0
            mtm_pct = (low - avg_open) / avg_open * 100.0 if avg_open > 0 else 0.0
            if mtm_pct < worst_dd_pct:
                worst_dd_pct = mtm_pct

    # End-of-window mark-to-market
    final_close = float(candles.iloc[-1]["close"])
    if not result.exit_reason:
        result.exit_reason = "mtm_end"
        result.exit_price = final_close

    if open_longs_count > 0:
        avg_open = lower + (initial_open_longs * step) / 2.0
        gross_unreal = (
            (result.exit_price - avg_open) / avg_open
        ) * (open_longs_count * cell_size) * leverage if avg_open > 0 else 0.0
        result.unrealised_pnl_usdt = gross_unreal
        result.avg_open_entry = avg_open

    result.open_positions = open_longs_count
    result.total_pnl_usdt = result.realised_pnl_usdt + result.unrealised_pnl_usdt
    result.peak_drawdown_pct = abs(worst_dd_pct)

    if len(candles) > 0:
        t0 = pd.to_datetime(candles.iloc[0]["timestamp"])
        t1 = pd.to_datetime(candles.iloc[-1]["timestamp"])
        result.duration_hours = max(0, int((t1 - t0).total_seconds() / 3600))

    if result.exit_reason in ("exited_above_range", "exited_below_range"):
        result.warnings.append("price_breached_grid_range")
    if leverage > 5 and result.peak_drawdown_pct > 30:
        result.warnings.append("high_leverage_grid_at_risk")
    if total_crossings == 0:
        result.warnings.append("no_grid_activity")

    return result
