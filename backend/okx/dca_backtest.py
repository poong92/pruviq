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
    #
    # B4 audit (wick parity fix): trigger/TP/stop-scaling decisions use the
    # candle CLOSE, not low/high. The live paper-loop polls a single
    # mark-price every 60s and cannot see an intra-candle wick, so a
    # simulator that fires on wick reports more fills/sooner-TPs than paper
    # ever observes — breaking the dog-foot parity gate (Day 7 PASS hinges
    # on this). Real OKX limit orders also won't reliably fill on a 1-tick
    # wick, so close is also the safer real-mode anchor. Drawdown still
    # tracks the candle low/high since that's an MTM observation, not an
    # order-execution signal.
    for i in range(1, len(candles)):
        c = candles.iloc[i]
        low = float(c["low"])
        high = float(c["high"])
        close = float(c["close"])

        # Stop-scaling guard (operator-set floor — never add below this).
        # For shorts the analogue is "ceiling"; treat stop_scaling_price as
        # a "halt further safety orders" signal regardless of direction.
        scaling_halted = False
        if stop_scaling_price > 0:
            if direction == "long" and close <= stop_scaling_price:
                scaling_halted = True
            elif direction == "short" and close >= stop_scaling_price:
                scaling_halted = True

        # Trigger safety orders while the candle close crosses the next
        # trigger and we still have capacity. Paper-loop polls mark every
        # 60s — close is the nearest in-spirit proxy.
        while (
            len(result.fills) - 1 < max_safety  # safety count
            and not scaling_halted
            and (
                (direction == "long" and close <= next_trigger)
                or (direction == "short" and close >= next_trigger)
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

        # Update worst drawdown — keep low/high here, this is a MTM
        # observation independent of order-trigger semantics.
        avg = _weighted_avg(result.fills)
        if direction == "long" and avg > 0:
            mtm_pct = (low - avg) / avg * 100.0  # negative when underwater
            if mtm_pct < worst_unrealized_pct:
                worst_unrealized_pct = mtm_pct
        elif direction == "short" and avg > 0:
            mtm_pct = (avg - high) / avg * 100.0
            if mtm_pct < worst_unrealized_pct:
                worst_unrealized_pct = mtm_pct

        # TP check: candle CLOSE reaches TP price (was high/low — wick).
        if avg > 0:
            tp_price = (
                avg * (1.0 + tp_pct)
                if direction == "long"
                else avg * (1.0 - tp_pct)
            )
            tp_hit = (
                (direction == "long" and close >= tp_price)
                or (direction == "short" and close <= tp_price)
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


# ── 4-gate parity additions (V1/V2/V3 from audit) ──────────────

def simulate_dca_multi_window(
    params: dict[str, Any],
    candles: pd.DataFrame,
    *,
    n_windows: int = 5,
    window_days: int = 7,
    taker_fee_pct: float = DEFAULT_TAKER_FEE_PCT,
) -> dict[str, Any]:
    """V1 (validation audit): single-trial parity → distribution comparison.

    Slices the candle DataFrame into N disjoint window_days windows ending
    at the latest available timestamp and runs simulate_dca on each. Builds
    mean/std of three metrics (fills_count, avg_entry_price, tp_cycles) so
    Gate 2 of the dogfoot manual can check "paper result ± 2σ" instead of
    one-shot ±10%.

    Returns:
      {
        "n_windows": int (actual count, may be < requested),
        "window_days": int,
        "windows": [{"start_iso", "end_iso", "fills_count",
                     "avg_entry_price", "tp_cycles", "exit_reason"}, ...],
        "stats": {"fills_count": {"mean": .., "std": .., "cv": ..},
                  "avg_entry_price": {...},
                  "tp_cycles": {...}},
      }
    """
    import numpy as np  # local import — keep module import cheap

    if candles is None or len(candles) < 2:
        return {"n_windows": 0, "window_days": window_days, "windows": [],
                "stats": {}, "skipped": "insufficient_candles"}

    # Assume 1-hour candles (matches DataManager). window_days * 24 rows.
    rows_per_window = window_days * 24
    total = len(candles)
    if total < rows_per_window * n_windows:
        # Fall back to as many full windows as fit
        n_windows = max(1, total // rows_per_window)
    if n_windows == 0:
        return {"n_windows": 0, "window_days": window_days, "windows": [],
                "stats": {}, "skipped": "candle_history_too_short"}

    windows_out: list[dict[str, Any]] = []
    end = total
    for _ in range(n_windows):
        start = end - rows_per_window
        if start < 0:
            break
        slice_df = candles.iloc[start:end].reset_index(drop=True)
        # simulate_dca breaks on first TP, but for Gate 2 we count cycles
        # over the window — mirror the loop pattern from router.py
        bt_fills = 0
        bt_avg_entries: list[tuple[float, float]] = []
        bt_tp = 0
        rem = slice_df
        while len(rem) >= 2:
            sim = simulate_dca(params, rem, taker_fee_pct=taker_fee_pct)
            bt_fills += len(sim.fills)
            if sim.avg_entry_price > 0:
                bt_avg_entries.append(
                    (sim.avg_entry_price, sim.total_size_usdt)
                )
            if sim.exit_reason != "tp":
                break
            bt_tp += 1
            # Skip past exit timestamp to start a new cycle
            exit_iso = sim.exit_time_iso
            mask = rem["timestamp"] > exit_iso
            rem = rem[mask].reset_index(drop=True)
        # Aggregate avg entry (size-weighted across cycles)
        wsum = sum(p * s for p, s in bt_avg_entries)
        ssum = sum(s for _, s in bt_avg_entries)
        agg_avg = (wsum / ssum) if ssum > 0 else 0.0
        windows_out.append({
            "start_iso": str(slice_df.iloc[0]["timestamp"]),
            "end_iso": str(slice_df.iloc[-1]["timestamp"]),
            "fills_count": bt_fills,
            "avg_entry_price": agg_avg,
            "tp_cycles": bt_tp,
        })
        end = start  # disjoint windows

    # Stats
    def _stat(values: list[float]) -> dict[str, float]:
        arr = np.array([v for v in values if v > 0], dtype=float)
        if len(arr) == 0:
            return {"mean": 0.0, "std": 0.0, "cv": 0.0, "n": 0}
        mean = float(arr.mean())
        std = float(arr.std(ddof=1)) if len(arr) > 1 else 0.0
        cv = (std / mean) if mean > 0 else 0.0
        return {"mean": mean, "std": std, "cv": cv, "n": len(arr)}

    stats = {
        "fills_count": _stat([w["fills_count"] for w in windows_out]),
        "avg_entry_price": _stat(
            [w["avg_entry_price"] for w in windows_out]
        ),
        "tp_cycles": _stat([w["tp_cycles"] for w in windows_out]),
    }
    return {
        "n_windows": len(windows_out),
        "window_days": window_days,
        "windows": windows_out,
        "stats": stats,
    }


def simulate_dca_sensitivity(
    params: dict[str, Any],
    candles: pd.DataFrame,
    *,
    taker_fee_pct: float = DEFAULT_TAKER_FEE_PCT,
) -> dict[str, Any]:
    """V2 (validation audit): parameter sensitivity sweep.

    Varies price_step_pct (±20%), size_multiplier (±10%), tp_pct (±0.5pp)
    around the bot's current config and reports fill-count CV across the
    grid. Gate 3 of the dogfoot manual requires CV < 0.25 — bots that are
    extremely sensitive to small param tweaks are fragile under live
    stress.

    Returns:
      {
        "grid": [{"step", "m", "tp", "fills_count"}, ...],
        "cv": float, "mean": float, "n": int,
      }
    """
    import numpy as np

    if candles is None or len(candles) < 2:
        return {"grid": [], "cv": 0.0, "mean": 0.0, "n": 0,
                "skipped": "insufficient_candles"}

    base_step = float(params.get("price_step_pct", 2.0))
    base_m = float(params.get("size_multiplier", 1.0))
    base_tp = float(params.get("tp_pct", 3.0))

    step_grid = [base_step * 0.8, base_step, base_step * 1.2]
    m_grid = [base_m * 0.9, base_m, base_m * 1.1]
    tp_grid = [base_tp - 0.5, base_tp, base_tp + 0.5]

    grid_out: list[dict[str, Any]] = []
    counts: list[int] = []
    for step in step_grid:
        for m in m_grid:
            for tp in tp_grid:
                p = dict(params)
                p["price_step_pct"] = step
                p["size_multiplier"] = m
                p["tp_pct"] = tp
                # Run one cycle per param combo — cheaper than full multi-
                # cycle and CV still surfaces the sensitivity signal.
                sim = simulate_dca(
                    p, candles, taker_fee_pct=taker_fee_pct
                )
                fc = len(sim.fills)
                counts.append(fc)
                grid_out.append({
                    "step": round(step, 4),
                    "m": round(m, 4),
                    "tp": round(tp, 4),
                    "fills_count": fc,
                })
    arr = np.array(counts, dtype=float)
    mean = float(arr.mean()) if len(arr) > 0 else 0.0
    std = float(arr.std(ddof=1)) if len(arr) > 1 else 0.0
    cv = (std / mean) if mean > 0 else 0.0
    return {"grid": grid_out, "cv": cv, "mean": mean, "n": len(arr)}
