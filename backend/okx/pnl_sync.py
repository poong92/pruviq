"""
PnL sync — update estimated trade PnL with actual realized PnL from OKX.

When a trade is logged, pnl_usdt is an estimated worst-case (SL hit scenario).
This module polls /account/positions-history to find the actual realized PnL
once a position closes, then updates the trade_log record.

This enables:
  1. Accurate daily P&L reporting
  2. Correct consecutive-loss guard behavior
"""
from __future__ import annotations

import asyncio
import logging
import time

from .client import OKXClient
from .oauth import get_valid_token, is_authenticated
from .storage import _get_conn

logger = logging.getLogger("okx_pnl_sync")


async def sync_realized_pnl(session_id: str, inst_id: str, trade_created_at: float) -> None:
    """
    Poll positions-history to find actual realized PnL for a recently closed trade.
    Updates trade_log.pnl_usdt with the real value.

    Called asynchronously after a trade is logged (fire-and-forget).
    Polls up to 3 times (at 30s, 60s, 120s) then gives up.
    """
    if not is_authenticated(session_id):
        return

    # Give the exchange time to process the close (check at 30s, 60s, 120s)
    delays = [30, 30, 60]

    for i, delay in enumerate(delays):
        await asyncio.sleep(delay)

        try:
            if not is_authenticated(session_id):
                return

            token = await get_valid_token(session_id)
            async with OKXClient(token) as client:
                history = await client.get_positions_history(limit="20")

            # Find matching closed position by instId and close time after trade creation
            for pos in history:
                if pos.get("instId", "") != inst_id:
                    continue
                # uTime = update time (close time) in milliseconds
                u_time_ms = int(pos.get("uTime", "0"))
                u_time_s = u_time_ms / 1000
                if u_time_s < trade_created_at:
                    continue

                realized_pnl = float(pos.get("realizedPnl", "0"))
                logger.warning(
                    "PnL sync: session=%s inst=%s realized=%.4f",
                    session_id[:8], inst_id, realized_pnl,
                )
                _update_trade_pnl(session_id, inst_id, trade_created_at, realized_pnl)
                return

        except Exception as e:
            logger.error("PnL sync attempt %d failed: %s", i + 1, e)

    # Reset estimated PnL to 0 — consecutive-loss guard should not fire on stale estimates
    logger.warning(
        "PnL sync: no closed position found for session=%s inst=%s after 3 attempts — resetting pnl to 0",
        session_id[:8], inst_id,
    )
    _update_trade_pnl(session_id, inst_id, trade_created_at, 0.0)


def _update_trade_pnl(
    session_id: str,
    inst_id: str,
    trade_created_at: float,
    realized_pnl: float,
) -> None:
    """Update trade_log.pnl_usdt for the trade closest to trade_created_at."""
    with _get_conn() as conn:
        # Find the trade log entry closest to trade_created_at (within 60s window)
        row = conn.execute(
            """
            SELECT id FROM trade_log
            WHERE session_id = ?
              AND created_at >= ?
              AND created_at <= ?
              AND json_extract(signal, '$.coin') LIKE ?
            ORDER BY ABS(created_at - ?) ASC
            LIMIT 1
            """,
            (
                session_id,
                trade_created_at - 10,
                trade_created_at + 60,
                f"%{inst_id.split('-')[0]}%",
                trade_created_at,
            ),
        ).fetchone()

        if not row:
            logger.warning("PnL sync: no matching trade_log row found for inst=%s", inst_id)
            return

        conn.execute(
            "UPDATE trade_log SET pnl_usdt = ? WHERE id = ?",
            (realized_pnl, row[0]),
        )
        logger.info("PnL sync: updated trade_log id=%d pnl=%.4f", row[0], realized_pnl)
