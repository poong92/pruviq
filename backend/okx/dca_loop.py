"""
DCA execution loop — paper-mode default.

Polls every 60 s, walks active DCA bots, and writes simulated fills to
the `dca_fills` table. **No real OKX orders are placed in this PR** —
`paper_mode=0` bots are skipped with a warning log. Real-mode placement
is intentionally a separate future PR so this one can be safely deployed
+ dog-fooded.

Per-tick logic for each active paper bot:
  1. Fetch current mark price from OKX public `/api/v5/market/ticker`.
  2. Read existing open `dca_fills`.
  3. If none: write a "base" fill at the mark price (order_num=0).
  4. Else: compute `next_trigger_price` = avg(last fill price) drifted
     by `price_step_pct`. If mark crossed and we still have safety
     capacity → write the next safety fill at the trigger price.
  5. Compute weighted avg entry across open fills. If mark reached the
     TP price → mark every open fill as `tp_closed`, log the result.
  6. `stop_scaling_price` halts new fills (existing remain open).

Math mirrors `simulate_dca` in dca_backtest.py so live behaviour will
agree with the user's backtest results.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any, Optional

import httpx

from .config import OKX_BASE_URL
from .dca_bots import _ensure_tables, _row_to_dca, _DCA_COLUMNS
from .storage import _get_conn

logger = logging.getLogger("okx_dca_loop")

# Heartbeat for /dca-bots/loop-health. In-memory by design: a missing
# value means the loop has not started since the last process boot,
# which is exactly what we want owners to see during dog-foot.
_LAST_TICK_AT: float = 0.0
_LAST_TICK_BOTS: int = 0


def loop_heartbeat() -> dict[str, float | int | bool]:
    """Public read for the loop-health endpoint."""
    now = time.time()
    return {
        "last_tick_at": _LAST_TICK_AT,
        "seconds_ago": (now - _LAST_TICK_AT) if _LAST_TICK_AT else -1,
        "interval_s": 60,
        "bots_last_tick": _LAST_TICK_BOTS,
        # Healthy = ticked within the last 2 intervals
        "healthy": bool(_LAST_TICK_AT and (now - _LAST_TICK_AT) < 130),
    }


async def _fetch_mark_price(symbol: str) -> float:
    """Fetch last trade price from OKX public ticker. Returns 0 on failure."""
    if "-" not in symbol:
        # PRUVIQ-style BTCUSDT → OKX swap form
        if symbol.endswith("USDT"):
            symbol = symbol[:-4] + "-USDT-SWAP"
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            resp = await client.get(
                f"{OKX_BASE_URL}/api/v5/market/ticker",
                params={"instId": symbol},
            )
            if resp.status_code != 200:
                return 0.0
            body = resp.json()
            if body.get("code") != "0" or not body.get("data"):
                return 0.0
            return float(body["data"][0].get("last") or 0.0)
    except Exception as e:
        logger.warning("ticker fetch failed for %s: %s", symbol, e)
        return 0.0


def _list_active_bots() -> list[dict[str, Any]]:
    """All bots with is_active=1 across all sessions."""
    _ensure_tables()
    with _get_conn() as conn:
        rows = conn.execute(
            f"SELECT {', '.join(_DCA_COLUMNS)} FROM dca_bots WHERE is_active = 1"
        ).fetchall()
    return [_row_to_dca(r) for r in rows]


def _list_open_fills(bot_id: str) -> list[dict[str, Any]]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT id, order_num, fill_price, fill_size_usdt, status "
            "FROM dca_fills WHERE bot_id = ? AND status = 'open' "
            "ORDER BY order_num",
            (bot_id,),
        ).fetchall()
    return [
        {"id": r[0], "order_num": r[1], "fill_price": r[2],
         "fill_size_usdt": r[3], "status": r[4]}
        for r in rows
    ]


def _write_paper_fill(
    bot_id: str, order_num: int, price: float, size_usdt: float
) -> None:
    okx_order_id = f"paper-{uuid.uuid4().hex[:12]}"
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO dca_fills "
            "(bot_id, order_num, fill_price, fill_size_usdt, okx_order_id, "
            "filled_at, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
            (bot_id, order_num, price, size_usdt, okx_order_id, time.time()),
        )


def _close_all_open_fills(bot_id: str, reason: str = "tp_closed") -> int:
    with _get_conn() as conn:
        cur = conn.execute(
            "UPDATE dca_fills SET status = ? "
            "WHERE bot_id = ? AND status = 'open'",
            (reason, bot_id),
        )
        return cur.rowcount


def _weighted_avg(fills: list[dict[str, Any]]) -> float:
    total = sum(f["fill_size_usdt"] for f in fills)
    if total <= 0:
        return 0.0
    return sum(f["fill_price"] * f["fill_size_usdt"] for f in fills) / total


async def _tick_bot(bot: dict[str, Any]) -> None:
    """One pass for one bot. Paper mode only — real mode is skipped."""
    bot_id = bot["id"]
    if not bot.get("paper_mode", 1):
        logger.warning(
            "dca_loop skip bot=%s — paper_mode=0 not yet implemented",
            bot_id[:8],
        )
        return

    mark = await _fetch_mark_price(bot["symbol"])
    if mark <= 0:
        return

    direction = bot.get("direction", "long")
    step_pct = float(bot["price_step_pct"]) / 100.0
    multiplier = float(bot.get("size_multiplier", 1.0))
    max_safety = int(bot["max_safety_orders"])
    tp_pct = float(bot["tp_pct"]) / 100.0
    stop = float(bot.get("stop_scaling_price", 0.0))
    base_size = float(bot["position_size_usdt"])
    base_override = float(bot.get("base_price_usdt", 0.0))

    fills = _list_open_fills(bot_id)

    # Stop scaling guard
    scaling_halted = False
    if stop > 0:
        if direction == "long" and mark <= stop:
            scaling_halted = True
        elif direction == "short" and mark >= stop:
            scaling_halted = True

    # 1) No fills yet → base order
    if not fills:
        base_price = base_override if base_override > 0 else mark
        _write_paper_fill(bot_id, 0, base_price, base_size)
        logger.info(
            "dca paper base fill bot=%s price=%.6f size=%.2f",
            bot_id[:8], base_price, base_size,
        )
        return

    # 2) Compute next trigger off last fill — multi-fire loop so a single
    # 60s tick mirrors dca_backtest.simulate_dca's `while` behaviour. When
    # mark moves through several step%s between ticks (gap-down / fast
    # selloff), live and backtest should produce the SAME number of fills.
    # Without this loop, live would only place one safety per tick → user
    # backtests show e.g. 5 fills while live shows 1, breaking the parity
    # rule (rules/feedback_engine_parity.md).
    last_fill = fills[-1]
    last_price = float(last_fill["fill_price"])
    last_size = float(last_fill["fill_size_usdt"])
    next_order_num = last_fill["order_num"] + 1

    while not scaling_halted and next_order_num <= max_safety:
        if direction == "long":
            next_trigger = last_price * (1.0 - step_pct)
            should_fire = mark <= next_trigger
        else:
            next_trigger = last_price * (1.0 + step_pct)
            should_fire = mark >= next_trigger
        if not should_fire:
            break
        next_size = last_size * multiplier
        _write_paper_fill(bot_id, next_order_num, next_trigger, next_size)
        logger.info(
            "dca paper safety #%d bot=%s price=%.6f size=%.2f",
            next_order_num, bot_id[:8], next_trigger, next_size,
        )
        # Update for next iteration
        last_price = next_trigger
        last_size = next_size
        next_order_num += 1

    # Refresh fills view if any safeties fired
    fills = _list_open_fills(bot_id)

    # 4) TP check
    avg = _weighted_avg(fills)
    if avg > 0:
        if direction == "long":
            tp_price = avg * (1.0 + tp_pct)
            tp_hit = mark >= tp_price
        else:
            tp_price = avg * (1.0 - tp_pct)
            tp_hit = mark <= tp_price
        if tp_hit:
            closed = _close_all_open_fills(bot_id, "tp_closed")
            logger.info(
                "dca paper TP hit bot=%s avg=%.6f tp=%.6f mark=%.6f closed=%d",
                bot_id[:8], avg, tp_price, mark, closed,
            )


async def dca_loop() -> None:
    """Main background loop. Lives inside uvicorn process — restarts on
    each app boot.  60 s tick is conservative; users polling /dca-bots/:id/
    preview see fresher numbers between ticks."""
    interval = 60
    logger.info("dca_loop started interval=%ds (paper-mode only)", interval)
    global _LAST_TICK_AT, _LAST_TICK_BOTS
    while True:
        try:
            bots = await asyncio.to_thread(_list_active_bots)
            for bot in bots:
                try:
                    await _tick_bot(bot)
                except Exception as e:
                    logger.error(
                        "dca tick failed bot=%s: %s",
                        bot["id"][:8], e,
                    )
            _LAST_TICK_AT = time.time()
            _LAST_TICK_BOTS = len(bots)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("dca_loop iteration failed: %s", e)
        await asyncio.sleep(interval)
