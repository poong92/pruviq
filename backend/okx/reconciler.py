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
from typing import Optional

from .client import OKXClient
from .oauth import get_valid_token, is_authenticated
from .orders import _pruviq_to_okx_inst_id
from .settings import get_auto_sessions, get_settings, get_trade_log, save_settings
from .storage import _get_conn
from .strategies import get_active_strategy

logger = logging.getLogger("okx_reconciler")

RECONCILE_INTERVAL = 300  # 5 minutes
_TRADE_LOOKBACK_S = 24 * 3600  # treat last 24h of trade_log as expected positions
_TRADE_LOG_LIMIT = 10000  # pull enough history to cover the session's lifetime


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

    expected = await asyncio.to_thread(_expected_inst_ids, session_id)
    orphans = okx_inst_ids - expected
    if not orphans:
        return

    settings = await asyncio.to_thread(get_settings, session_id)
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


async def _send_mdd_halt_alert(
    chat_id: str, session_id: str, cum_loss: float, threshold: float, max_dd_pct: float
) -> None:
    """Notify the user that their session was auto-halted due to MDD breach.
    Fire-and-forget; an alert failure must not stop the reconcile loop."""
    from .notifications import _send  # lazy to avoid cycle
    try:
        await _send(
            chat_id,
            (
                "🛑 <b>PRUVIQ MDD 한도 도달 — 세션 자동 중지</b>\n"
                f"session: <code>{session_id[:8]}</code>\n"
                f"누적 손실: <b>${cum_loss:.2f}</b> "
                f"> 한도 <b>${threshold:.2f}</b> ({max_dd_pct:.1f}%)\n\n"
                "자동매매가 꺼졌습니다. 원인 확인 후 다시 활성화하세요."
            ),
        )
    except Exception as e:
        logger.warning("MDD halt alert failed for session %s: %s", session_id[:8], e)


async def check_mdd_and_halt(session_id: str) -> bool:
    """autotrader lesson R4 (20% hard cap), adapted for PRUVIQ's per-user model.

    Computes lifetime realized cum-PnL from trade_log and compares against the
    active strategy's `max_drawdown_pct` threshold, expressed as a fraction of
    the theoretical position budget (position_size × max_concurrent_pos). This
    budget-relative sizing is an approximation — we don't own the user's OKX
    equity number — but it's the most honest bound we can enforce without
    reading their whole account.

    On breach: disable the session's autotrade (settings.enabled=False), log at
    CRITICAL, send a Telegram alert if configured. User must re-enable manually
    after reviewing the loss cause.

    Returns True if a halt was triggered, else False.
    """
    active = await asyncio.to_thread(get_active_strategy, session_id)
    if not active:
        return False
    max_dd_pct = float(active.get("max_drawdown_pct") or 0)
    if max_dd_pct <= 0:
        return False

    budget = float(active.get("position_size_usdt") or 0) * int(active.get("max_concurrent_pos") or 1)
    if budget <= 0:
        return False
    threshold_usd = budget * max_dd_pct / 100.0

    try:
        trades = await asyncio.to_thread(get_trade_log, session_id, _TRADE_LOG_LIMIT)
    except Exception as e:
        logger.warning("MDD check: get_trade_log failed for %s: %s", session_id[:8], e)
        return False
    cum_pnl = sum(float(t.get("pnl") or 0) for t in trades)
    cum_loss = max(0.0, -cum_pnl)
    if cum_loss <= threshold_usd:
        return False

    logger.critical(
        "MDD halt: session=%s cum_loss=$%.2f > threshold=$%.2f "
        "(%.1f%% of budget=$%.0f, trades=%d)",
        session_id[:8], cum_loss, threshold_usd, max_dd_pct, budget, len(trades),
    )

    def _disable() -> Optional[str]:
        current = get_settings(session_id)
        chat_id = current.get("alert_telegram_chat_id") or ""
        current["enabled"] = False
        save_settings(session_id, current)
        return str(chat_id) if chat_id else None

    chat_id = None
    try:
        chat_id = await asyncio.to_thread(_disable)
    except Exception as e:
        logger.error("MDD halt: failed to disable session %s: %s", session_id[:8], e)
        # Not returning False — we still want to attempt the alert since the
        # user should know their strategy crossed the threshold even if we
        # couldn't flip the bit.

    if chat_id:
        await _send_mdd_halt_alert(chat_id, session_id, cum_loss, threshold_usd, max_dd_pct)

    return True


async def reconcile_all_sessions() -> None:
    """Reconcile every auto-enabled session in turn."""
    try:
        sessions = await asyncio.to_thread(get_auto_sessions)
    except Exception as e:
        logger.error("Reconcile: get_auto_sessions failed: %s", e)
        return

    for session_id in sessions:
        try:
            await reconcile_positions(session_id)
        except Exception as e:
            logger.error("Reconcile: session %s failed: %s", session_id[:8], e)
        # MDD check runs even if reconcile raised — a loss threshold breach
        # should not be silent just because OKX position-fetch had a blip.
        try:
            await check_mdd_and_halt(session_id)
        except Exception as e:
            logger.error("MDD check: session %s failed: %s", session_id[:8], e)


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
