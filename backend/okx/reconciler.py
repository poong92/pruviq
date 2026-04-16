"""
Position reconciliation loop.

Every 5 minutes, compare OKX-side open positions (pos != 0) against the recent
trade_log for each auto-enabled session. Flag "orphan" positions — live on OKX
but absent from our records — because those are the scariest class of bug
before live money: a stop-loss we never tracked, a trade from a stale deploy,
or a manual OKX action the bot is unaware of.

Design decisions (P0-2, 2026-04-16):
  - trade_log has no `status` column, so we treat recent trades (last 24h) as
    the "expected" set. This avoids an invasive schema change pre-live-money.
  - We only ALERT (log + Telegram). We do NOT auto-disable, auto-close, or
    auto-reconcile — those require more testing than a P0 hotfix deserves.
  - "Closed in OKX but open in DB" is intentionally NOT handled here: pnl_sync
    already covers that path, and without a status column we'd produce false
    positives (e.g. successful trade + realized pnl already recorded).
"""
from __future__ import annotations

import asyncio
import json
import logging
import time

from .client import OKXClient
from .oauth import get_valid_token, is_authenticated
from .orders import _pruviq_to_okx_inst_id
from .settings import get_auto_sessions, get_settings
from .storage import _get_conn

logger = logging.getLogger("okx_reconciler")

RECONCILE_INTERVAL = 300  # 5 minutes
_TRADE_LOOKBACK_S = 24 * 3600  # treat last 24h of trade_log as expected positions


def _expected_inst_ids(session_id: str) -> set[str]:
    """Derive the set of inst_ids this session should plausibly have open."""
    cutoff = time.time() - _TRADE_LOOKBACK_S
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT signal FROM trade_log WHERE session_id = ? AND created_at >= ?",
            (session_id, cutoff),
        ).fetchall()

    inst_ids: set[str] = set()
    for (signal_json,) in rows:
        try:
            signal = json.loads(signal_json)
        except Exception:
            continue
        coin = signal.get("coin", "")
        if not coin:
            continue
        try:
            inst_ids.add(_pruviq_to_okx_inst_id(coin))
        except Exception:
            continue
    return inst_ids


async def _send_orphan_alert(chat_id: str, session_id: str, inst_id: str) -> None:
    """Notify user via Telegram about an orphan position. Fire-and-forget."""
    if not chat_id:
        return
    try:
        # Build a synthetic signal dict so send_execution_failed can render cleanly.
        synthetic_signal = {
            "coin": inst_id,
            "strategy": "reconciler",
            "direction": "",
        }
        from .notifications import send_execution_failed
        reason = (
            f"Orphan position detected: {inst_id} live on OKX but not tracked in "
            f"trade_log (session {session_id[:8]}). Manual review required."
        )
        await send_execution_failed(chat_id, synthetic_signal, reason)
    except Exception as e:
        logger.error("Orphan alert Telegram send failed for %s: %s", session_id[:8], e)


async def reconcile_positions(session_id: str) -> None:
    """Reconcile a single session's OKX positions vs recent trade_log."""
    if not is_authenticated(session_id):
        return

    try:
        token = await get_valid_token(session_id)
        async with OKXClient(token, session_id=session_id) as client:
            okx_positions = await client.get_positions()
    except Exception as e:
        logger.error("Reconcile: fetch positions failed for %s: %s", session_id[:8], e)
        return

    okx_inst_ids = {
        p.inst_id for p in okx_positions if _has_position(p.pos)
    }
    if not okx_inst_ids:
        return

    expected = _expected_inst_ids(session_id)
    orphans = okx_inst_ids - expected
    if not orphans:
        return

    settings = get_settings(session_id)
    chat_id = settings.get("alert_telegram_chat_id", "")
    for inst_id in orphans:
        logger.error(
            "Reconcile: ORPHAN POSITION %s on OKX not in DB (session=%s)",
            inst_id, session_id[:8],
        )
        await _send_orphan_alert(chat_id, session_id, inst_id)


def _has_position(pos_str: str) -> bool:
    """OKX returns pos as a string; treat '0', '', None as no-position."""
    if not pos_str:
        return False
    try:
        return float(pos_str) != 0
    except (ValueError, TypeError):
        return False


async def reconcile_all_sessions() -> None:
    """Reconcile every auto-enabled session in turn."""
    try:
        sessions = get_auto_sessions()  # list[str] of session_ids
    except Exception as e:
        logger.error("Reconcile: get_auto_sessions failed: %s", e)
        return

    for session_id in sessions:
        try:
            await reconcile_positions(session_id)
        except Exception as e:
            logger.error("Reconcile: session %s failed: %s", session_id[:8], e)


async def reconcile_loop() -> None:
    """Background loop: reconcile every RECONCILE_INTERVAL seconds."""
    logger.info(
        "Position reconcile loop started (interval=%ds, lookback=%ds)",
        RECONCILE_INTERVAL, _TRADE_LOOKBACK_S,
    )
    # Defer first pass so startup completes before we hit OKX APIs.
    await asyncio.sleep(60)
    while True:
        try:
            await reconcile_all_sessions()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("Reconcile loop error: %s", e)
        await asyncio.sleep(RECONCILE_INTERVAL)
