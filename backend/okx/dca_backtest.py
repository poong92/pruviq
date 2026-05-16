"""
DCA backtest simulator.

Walks historical 1H OHLCV candles for a single symbol and simulates the
exact DCA bot logic that the live execution loop will implement (Phase
B2): base order at first candle, safety order whenever price drops
`price_step_pct` below the *next trigger price*, position size scales by
`size_multiplier`, take-profit at `tp_pct` above the volume-weighted
average entry, hard stop at `max_safety_orders` and `stop_scaling_price`.

Returns a summary the UI can render: fills, exit reason, gross/net P&L,
peak drawdown vs avg-entry, safety-orders used, final avg entry.

Lives in its own module so it can be unit-tested without touching
storage.py, and so the executor loop (Phase B2) can call it for
"would-be" replay testing without re-implementing the math.

Fee model: 0.05% (OKX default broker rate, taker side) per fill.
No liquidation simulation in v1 — assumed `leverage * 1.05` worst-case
margin headroom; users with high leverage get a warning at the API
layer.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

import pandas as pd

logger = logging.getLogger("okx_dca_backtest")

DEFAULT_TAKER_FEE_PCT = 0.05  # %, applied on every fill


@dataclass
class SimFill:
    order_num: int
    fill_time_iso: str
    fill_price: float
    size_usdt: float
    fee_usdt: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "order_num": self.order_num,
            "fill_time_iso": self.fill_time_iso,
            "fill_price": self.fill_price,
            "size_usdt": self.size_usdt,
            "fee_usdt": self.fee_usdt,
        }


@dataclass
class SimResult:
    fills: list[SimFill] = field(default_factory=list)
    exit_reason: str = ""         # "tp" | "mtm_end" | "stop_scaling" | "max_safety"
    exit_time_iso: str = ""
    exit_price: float = 0.0
    avg_entry_price: float = 0.0
    total_size_usdt: float = 0.0
    safety_orders_used: int = 0
    gross_pnl_usdt: float = 0.0
    net_pnl_usdt: float = 0.0      # gross - total fees
    total_fees_usdt: float = 0.0
    peak_drawdown_pct: float = 0.0  # worst unrealized loss % vs avg entry (long)
    duration_hours: int = 0
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "fills": [f.to_dict() for f in self.fills],
            "exit_reason": self.exit_reason,
            "exit_time_iso": self.exit_time_iso,
            "exit_price": self.exit_price,
            "avg_entry_price": self.avg_entry_price,
            "total_size_usdt": self.total_size_usdt,
            "safety_orders_used": self.safety_orders_used,
            "gross_pnl_usdt": self.gross_pnl_usdt,
            "net_pnl_usdt": self.net_pnl_usdt,
            "total_fees_usdt": self.total_fees_usdt,
            "peak_drawdown_pct": self.peak_drawdown_pct,
            "duration_hours": self.duration_hours,
            "warnings": self.warnings,
        }


def _weighted_avg(fills: list[SimFill]) -> float:
    total = sum(f.size_usdt for f in fills)
    if total <= 0:
        return 0.0
    return sum(f.fill_price * f.size_usdt for f in fills) / total


def simulate_dca(
    params: dict[str, Any],
    candles: pd.DataFrame,
    *,
    taker_fee_pct: float = DEFAULT_TAKER_FEE_PCT,
) -> SimResult:
    """Run the DCA simulator against a candle window.

    candles: DataFrame with columns timestamp, open, high, low, close, volume
             (matches DataManager.get_df shape; ISO8601 timestamps).
    params: dict matching `dca_bots.DEFAULT_DCA` shape.
    """
    result = SimResult()

    if candles is None or len(candles) < 2:
        result.warnings.append("not_enough_candles")
        return result

    direction = params.get("direction", "long")
    if direction not in ("long", "short"):
        result.warnings.append(f"invalid_direction:{direction}")
        return result

    base_size = float(params.get("position_size_usdt", 50.0))
    leverage = max(1, int(params.get("leverage", 1)))
    price_step_pct = float(params.get("price_step_pct", 2.0)) / 100.0
    size_multiplier = float(params.get("size_multiplier", 1.0))
    max_safety = int(params.get("max_safety_orders", 5))
    tp_pct = float(params.get("tp_pct", 3.0)) / 100.0
    stop_scaling_price = float(params.get("stop_scaling_price", 0.0))

    base_price_override = float(params.get("base_price_usdt", 0.0))

    # Helper: fee per fill given size and fee rate
    def fee_for(size_usdt: float) -> float:
        return size_usdt * (taker_fee_pct / 100.0) * leverage

    # 1) Base order at first candle close (or override if provided & matches)
    first = candles.iloc[0]
    base_price = (
        base_price_override
        if base_price_override > 0
        else float(first["close"])
    )

    base_fill = SimFill(
        order_num=0,
        fill_time_iso=str(first["timestamp"]),
        fill_price=base_price,
        size_usdt=base_size,
        fee_usdt=fee_for(base_size),
    )
    result.fills.append(base_fill)
    result.total_fees_usdt += base_fill.fee_usdt

    next_trigger = (
        base_price * (1.0 - price_step_pct)
        if direction == "long"
        else base_price * (1.0 + price_step_pct)
    )
    next_size = base_size * size_multiplier

    worst_unrealized_pct = 0.0
    exit_reason = ""
    exit_price = float(candles.iloc[-1]["close"])
    exit_time_iso = str(candles.iloc[-1]["timestamp"])

    # 2) Walk subsequent candles
    for i in range(1, len(candles)):
        c = candles.iloc[i]
        low = float(c["low"])
        high = float(c["high"])

        # Stop-scaling guard (operator-set floor — never add below this).
        # For shorts the analogue is "ceiling"; treat stop_scaling_price as
        # a "halt further safety orders" signal regardless of direction.
        scaling_halted = False
        if stop_scaling_price > 0:
            if direction == "long" and low <= stop_scaling_price:
                scaling_halted = True
            elif direction == "short" and high >= stop_scaling_price:
                scaling_halted = True

        # Trigger safety orders while the candle range crosses the next
        # trigger and we still have capacity.
        while (
            len(result.fills) - 1 < max_safety  # safety count
            and not scaling_halted
            and (
                (direction == "long" and low <= next_trigger)
                or (direction == "short" and high >= next_trigger)
            )
        ):
            fill = SimFill(
                order_num=len(result.fills),
                fill_time_iso=str(c["timestamp"]),
                fill_price=next_trigger,
                size_usdt=next_size,
                fee_usdt=fee_for(next_size),
            )
            result.fills.append(fill)
            result.total_fees_usdt += fill.fee_usdt
            # Setup next trigger
            if direction == "long":
                next_trigger = next_trigger * (1.0 - price_step_pct)
            else:
                next_trigger = next_trigger * (1.0 + price_step_pct)
            next_size = next_size * size_multiplier

        # Update worst drawdown
        avg = _weighted_avg(result.fills)
        if direction == "long" and avg > 0:
            mtm_pct = (low - avg) / avg * 100.0  # negative when underwater
            if mtm_pct < worst_unrealized_pct:
                worst_unrealized_pct = mtm_pct
        elif direction == "short" and avg > 0:
            mtm_pct = (avg - high) / avg * 100.0
            if mtm_pct < worst_unrealized_pct:
                worst_unrealized_pct = mtm_pct

        # TP check: candle high (or low for short) reaches TP price?
        if avg > 0:
            tp_price = (
                avg * (1.0 + tp_pct)
                if direction == "long"
                else avg * (1.0 - tp_pct)
            )
            tp_hit = (
                (direction == "long" and high >= tp_price)
                or (direction == "short" and low <= tp_price)
            )
            if tp_hit:
                exit_reason = "tp"
                exit_price = tp_price
                exit_time_iso = str(c["timestamp"])
                # Closing fee
                total_open = sum(f.size_usdt for f in result.fills)
                close_fee = fee_for(total_open)
                result.total_fees_usdt += close_fee
                break

        # Hard halt conditions (continue MTM but no more fills)
        if scaling_halted and not exit_reason:
            exit_reason = "stop_scaling"

    # 3) End of window — mark-to-market if no TP
    if not exit_reason:
        if len(result.fills) - 1 >= max_safety:
            exit_reason = "max_safety"
        else:
            exit_reason = "mtm_end"

    avg = _weighted_avg(result.fills)
    result.avg_entry_price = avg
    result.total_size_usdt = sum(f.size_usdt for f in result.fills)
    result.safety_orders_used = max(0, len(result.fills) - 1)
    result.exit_reason = exit_reason
    result.exit_time_iso = exit_time_iso
    result.exit_price = exit_price

    # P&L: leverage applied to gross move %
    if avg > 0:
        if direction == "long":
            gross_pct = (exit_price - avg) / avg
        else:
            gross_pct = (avg - exit_price) / avg
        result.gross_pnl_usdt = gross_pct * result.total_size_usdt * leverage
    result.net_pnl_usdt = result.gross_pnl_usdt - result.total_fees_usdt
    result.peak_drawdown_pct = abs(worst_unrealized_pct)

    # Duration hours
    if len(candles) > 0:
        t0 = pd.to_datetime(candles.iloc[0]["timestamp"])
        t1 = pd.to_datetime(exit_time_iso) if exit_time_iso else pd.to_datetime(candles.iloc[-1]["timestamp"])
        result.duration_hours = max(0, int((t1 - t0).total_seconds() / 3600))

    # Sanity warnings — surfaced in API response for the UI
    if result.safety_orders_used == max_safety and exit_reason != "tp":
        result.warnings.append("max_safety_orders_hit_without_tp")
    if leverage > 10 and result.peak_drawdown_pct > 30:
        result.warnings.append("high_leverage_high_drawdown")
    if exit_reason == "stop_scaling":
        result.warnings.append("stop_scaling_price_breached")

    return result
