"""
PnL sync — update estimated trade PnL with actual realized PnL from OKX.

When a trade is logged, pnl_usdt is an estimated worst-case (SL hit scenario).
This module polls /account/positions-history to find the actual realized PnL
once a position closes, then updates the trade_log record.

This enables:
  1. Accurate daily P&L reporting
  2. Correct consecutive-loss guard behavior

Failure handling (P0-3, 2026-04-16):
  - After 3 failed poll attempts, the row is flagged `pnl_synced=0` and the
    estimated pnl_usdt is left UNCHANGED. Previously this path reset pnl to 0,
    which corrupted the consecutive-loss guard (zeros no longer count as losses)
    and silently inflated daily P&L reporting.
  - A background task (`retry_failed_pnl_sync`) re-attempts every 30 minutes so
    pnl_synced=0 rows eventually converge to truth without dropping bars.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time

from .client import OKXClient
from .oauth import get_valid_token, is_authenticated
from .storage import _get_conn

logger = logging.getLogger("okx_pnl_sync")

# Retry interval for sessions/trades whose realized PnL could not be confirmed
# within the initial 3-attempt window (30s/60s/120s). Runs in main.py lifespan.
_RETRY_INTERVAL_S = 30 * 60  # 30 minutes
_RETRY_LOOKBACK_S = 7 * 24 * 3600  # only retry rows from last 7 days
_RETRY_HISTORY_LIMIT = "50"


async def sync_realized_pnl(session_id: str, inst_id: str, trade_created_at: float) -> None:
    """
    Poll positions-history to find actual realized PnL for a recently closed trade.
    Updates trade_log.pnl_usdt with the real value and sets pnl_synced=1 on success.

    Called asynchronously after a trade is logged (fire-and-forget).
    Polls up to 3 times (at 30s, 60s, 120s); on failure leaves pnl_usdt untouched
    and sets pnl_synced=0 for the retry loop to pick up.
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
            async with OKXClient(token, session_id=session_id) as client:
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

    # P0-3 fix (2026-04-16): do NOT reset pnl_usdt to 0 — that corrupted the
    # consecutive-loss guard. Flag the row and let retry_failed_pnl_sync()
    # converge it later. The estimated worst-case pnl remains in place until
    # we get ground truth from OKX.
    logger.warning(
        "pnl_sync 실패 3회, 추정값 유지: session=%s inst=%s trade_id=? flagging pnl_synced=0",
        session_id[:8], inst_id,
    )
    _flag_pnl_unsynced(session_id, inst_id, trade_created_at)


def _update_trade_pnl(
    session_id: str,
    inst_id: str,
    trade_created_at: float,
    realized_pnl: float,
) -> None:
    """Update trade_log.pnl_usdt + mark pnl_synced=1 for the trade closest to trade_created_at."""
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
            "UPDATE trade_log SET pnl_usdt = ?, pnl_synced = 1 WHERE id = ?",
            (realized_pnl, row[0]),
        )
        logger.info("PnL sync: updated trade_log id=%d pnl=%.4f pnl_synced=1", row[0], realized_pnl)


def _flag_pnl_unsynced(
    session_id: str,
    inst_id: str,
    trade_created_at: float,
) -> None:
    """
    Mark trade_log.pnl_synced=0 for the trade closest to trade_created_at.
    Leaves pnl_usdt (the estimated worst-case) untouched so the consecutive-loss
    guard still treats the trade as a loss until actual PnL is confirmed.
    """
    with _get_conn() as conn:
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
            logger.warning("pnl_sync 실패 3회: no matching trade_log row for inst=%s", inst_id)
            return

        conn.execute(
            "UPDATE trade_log SET pnl_synced = 0 WHERE id = ?",
            (row[0],),
        )
        logger.warning("pnl_sync 실패 3회, 추정값 유지: trade_id=%s inst=%s", row[0], inst_id)


# ── Retry loop ─────────────────────────────────────────────

async def retry_failed_pnl_sync() -> None:
    """
    Re-attempt PnL sync for all trade_log rows where pnl_synced=0.

    A single pass iterates recent (<7 days) unsynced rows, groups by session,
    fetches positions-history per session once, then matches each unsynced row
    against the history. Successful matches update both pnl_usdt and pnl_synced=1.
    """
    from .orders import _pruviq_to_okx_inst_id

    cutoff = time.time() - _RETRY_LOOKBACK_S
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, session_id, signal, created_at
            FROM trade_log
            WHERE pnl_synced = 0 AND created_at >= ?
            ORDER BY created_at ASC
            """,
            (cutoff,),
        ).fetchall()

    if not rows:
        return

    # Group by session_id so we only call positions-history once per session
    by_session: dict[str, list[tuple]] = {}
    for row in rows:
        by_session.setdefault(row[1], []).append(row)

    logger.warning(
        "pnl_sync retry: %d unsynced rows across %d sessions",
        len(rows), len(by_session),
    )

    for session_id, session_rows in by_session.items():
        if not is_authenticated(session_id):
            continue
        try:
            token = await get_valid_token(session_id)
            async with OKXClient(token, session_id=session_id) as client:
                history = await client.get_positions_history(limit=_RETRY_HISTORY_LIMIT)
        except Exception as e:
            logger.error("pnl_sync retry: fetch history failed for %s: %s", session_id[:8], e)
            continue

        for row_id, _, signal_json, created_at in session_rows:
            try:
                signal = json.loads(signal_json)
            except Exception:
                continue
            coin = signal.get("coin", "")
            if not coin:
                continue
            inst_id = _pruviq_to_okx_inst_id(coin)

            matched = False
            for pos in history:
                if pos.get("instId", "") != inst_id:
                    continue
                u_time_ms = int(pos.get("uTime", "0"))
                u_time_s = u_time_ms / 1000
                if u_time_s < created_at:
                    continue
                realized_pnl = float(pos.get("realizedPnl", "0"))
                with _get_conn() as conn:
                    conn.execute(
                        "UPDATE trade_log SET pnl_usdt = ?, pnl_synced = 1 WHERE id = ?",
                        (realized_pnl, row_id),
                    )
                logger.warning(
                    "pnl_sync retry: id=%d session=%s inst=%s realized=%.4f OK",
                    row_id, session_id[:8], inst_id, realized_pnl,
                )
                matched = True
                break

            if not matched:
                logger.info(
                    "pnl_sync retry: id=%d session=%s inst=%s still unsynced",
                    row_id, session_id[:8], inst_id,
                )


async def retry_failed_pnl_sync_loop() -> None:
    """Background loop: re-run pnl_sync every 30 minutes for pnl_synced=0 rows."""
    logger.info("pnl_sync retry loop started (interval=%ds)", _RETRY_INTERVAL_S)
    while True:
        await asyncio.sleep(_RETRY_INTERVAL_S)
        try:
            await retry_failed_pnl_sync()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("pnl_sync retry loop error: %s", e)
