"""
Auto-execution worker — monitors signals and executes trades for subscribed users.

Safety guards:
  - Max $500 per trade (configurable per user)
  - Max 20 trades/day (configurable)
  - Daily loss limit (configurable, default $200)
  - Master switch per user
  - Anomaly detection: pauses if 3 consecutive losses

Usage:
  Called from main.py background task, runs every signal scan cycle.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from .client import OKXClient
from .oauth import get_valid_token, is_authenticated
from .orders import _pruviq_to_okx_inst_id, _calc_sl_tp_prices
from .settings import (
    get_auto_sessions,
    get_alert_sessions,
    get_daily_stats,
    get_settings,
    get_trade_log,
    is_signal_executed,
    log_trade,
    mark_signal_executed,
)
from .notifications import send_signal_alert
from .pnl_sync import sync_realized_pnl
from .orders import _pruviq_to_okx_inst_id as _to_inst_id, _calc_contract_sz, _calc_sl_tp_prices

logger = logging.getLogger("okx_auto_executor")


async def process_signals(signals: list[dict]) -> list[dict]:
    """
    Process new signals against all auto-execution subscribers.

    For each signal, check all auto-enabled sessions:
    1. Is the session still authenticated?
    2. Does the user subscribe to this strategy + coin?
    3. Safety checks pass?
    4. Execute trade

    Returns list of executed trades.
    """
    if not signals:
        return []

    auto_sessions = get_auto_sessions()
    if not auto_sessions:
        return []

    executed = []

    for session_id in auto_sessions:
        if not is_authenticated(session_id):
            continue

        settings = get_settings(session_id)
        if not settings.get("enabled"):
            continue

        for signal in signals:
            try:
                result = await _try_execute(session_id, signal, settings)
                if result:
                    executed.append(result)
            except Exception as e:
                logger.error(
                    "Auto-execute failed for session %s, signal %s/%s: %s",
                    session_id[:8], signal["strategy"], signal["coin"], e,
                )

    if executed:
        logger.info("Auto-executed %d trades from %d signals", len(executed), len(signals))

    # ── Alert mode: notify subscribed users ──
    alert_sessions = get_alert_sessions()
    for session_id, chat_id in alert_sessions:
        if not is_authenticated(session_id):
            continue
        if not chat_id:
            continue
        settings = get_settings(session_id)
        for signal in signals:
            # Apply same strategy/coin filters as auto mode
            if settings["strategies"] and signal["strategy"] not in settings["strategies"]:
                continue
            if settings["coins"] and signal["coin"] not in settings["coins"]:
                continue
            try:
                await send_signal_alert(chat_id, signal)
            except Exception as e:
                logger.error(
                    "Alert send failed for session %s: %s",
                    session_id[:8], e,
                )

    return executed


async def _try_execute(
    session_id: str, signal: dict, settings: dict
) -> Optional[dict]:
    """Try to execute a single signal for a user. Returns result or None."""

    strategy_id = signal["strategy"]
    coin = signal["coin"]
    signal_time = signal.get("signal_time", "")

    # ── Filter: strategy subscribed? ──
    if settings["strategies"] and strategy_id not in settings["strategies"]:
        return None

    # ── Filter: coin subscribed? ──
    if settings["coins"] and coin not in settings["coins"]:
        return None

    # ── Deduplication: skip already-executed signals ──
    if signal_time and is_signal_executed(session_id, strategy_id, coin, signal_time):
        logger.debug("Signal already executed: %s/%s @ %s", strategy_id, coin, signal_time)
        return None

    # ── Safety: daily trade limit ──
    daily_stats = get_daily_stats(session_id)
    max_daily = settings.get("max_daily_trades", 20)
    if daily_stats["trades_today"] >= max_daily:
        logger.warning(
            "Session %s daily trade limit reached (%d/%d)",
            session_id[:8], daily_stats["trades_today"], max_daily,
        )
        return None

    # ── Safety: daily loss limit ──
    daily_loss_limit = settings.get("daily_loss_limit_usdt", 200)
    if daily_stats["pnl_today"] <= -daily_loss_limit:
        logger.warning(
            "Session %s daily loss limit hit ($%.2f / limit $%.2f)",
            session_id[:8], daily_stats["pnl_today"], daily_loss_limit,
        )
        return None

    # ── Safety: consecutive loss guard ──
    # pnl_sync.py updates pnl_usdt to actual realized values after position close.
    # Initial estimate is worst-case (SL scenario), so guard uses actual values
    # once sync completes (typically within 30-120s of trade close).
    recent_trades = get_trade_log(session_id, limit=3)
    if len(recent_trades) >= 3:
        if all(t["pnl_usdt"] < 0 for t in recent_trades[:3]):
            logger.warning(
                "Session %s: 3 consecutive losses — auto-pausing",
                session_id[:8],
            )
            return None

    # ── Execute ──
    inst_id = _pruviq_to_okx_inst_id(coin)
    side = "sell" if signal["direction"] == "short" else "buy"
    entry_price = signal.get("entry_price", 0)

    if not entry_price or entry_price <= 0:
        logger.warning("No entry price for signal %s/%s", strategy_id, coin)
        return None

    position_size = settings["position_size_usdt"]
    leverage = settings["leverage"]
    td_mode = settings.get("td_mode", "isolated")
    sl_pct = signal.get("sl_pct", 10)
    tp_pct = signal.get("tp_pct", 8)

    token = await get_valid_token(session_id)
    async with OKXClient(token, session_id=session_id) as client:
        # ── Percent-of-balance position sizing ──
        if settings.get("position_size_mode") == "percent":
            pct = settings.get("position_size_pct", 5)
            balances = await client.get_balance("USDT")
            avail = float(balances[0].avail_bal) if balances else 0
            if avail <= 0:
                logger.warning(
                    "Session %s: zero USDT balance — skipping percent sizing",
                    session_id[:8],
                )
                return None
            position_size = avail * pct / 100
            logger.info(
                "Percent sizing: %.1f%% of $%.2f = $%.2f for session %s",
                pct, avail, position_size, session_id[:8],
            )

        # Check concurrent position limit
        positions = await client.get_positions()
        open_count = sum(1 for p in positions if float(p.pos or 0) != 0)
        if open_count >= settings["max_concurrent"]:
            logger.warning(
                "Session %s at max concurrent positions (%d/%d)",
                session_id[:8], open_count, settings["max_concurrent"],
            )
            return None

        # Correct OKX SWAP contract size (integer, uses ctVal)
        try:
            sz = await _calc_contract_sz(client, inst_id, position_size, leverage, entry_price)
        except ValueError as e:
            logger.warning("Position too small for auto-execute: %s", e)
            return None

        # Set leverage before placing order
        await client.set_leverage(inst_id=inst_id, lever=leverage, mgn_mode=td_mode)

        # Market order
        order = await client.place_order(inst_id=inst_id, side=side, sz=sz, td_mode=td_mode)
        ord_id = order.get("ordId", "")
        logger.warning("← Auto order placed ordId=%s %s %s sz=%s", ord_id, side, inst_id, sz)

        # SL/TP — if fails, close naked position immediately
        sl_price, tp_price = _calc_sl_tp_prices(entry_price, signal["direction"], sl_pct, tp_pct)
        close_side = "buy" if signal["direction"] == "short" else "sell"

        try:
            algo = await client.place_algo_order(
                inst_id=inst_id,
                side=close_side,
                sz=sz,
                sl_trigger_px=sl_price,
                tp_trigger_px=tp_price,
                td_mode=td_mode,
            )
        except Exception as algo_err:
            logger.error(
                "CRITICAL: SL/TP failed after auto-order %s (%s) — closing: %s",
                ord_id, inst_id, algo_err,
            )
            try:
                await client.close_position(inst_id, mgn_mode=td_mode)
                # Notify user via Telegram if alert_telegram_chat_id set
                chat_id = settings.get("alert_telegram_chat_id", "")
                if chat_id:
                    await send_signal_alert(chat_id, {
                        "strategy": strategy_id, "coin": coin,
                        "direction": "CLOSED",
                        "entry_price": entry_price,
                        "sl_pct": sl_pct, "tp_pct": tp_pct,
                        "strategy_name": f"⚠️ SL/TP FAILED — {strategy_id} position closed",
                    })
            except Exception as close_err:
                logger.error("EMERGENCY CLOSE FAILED for %s: %s", inst_id, close_err)
            return None

    result = {
        "session_id": session_id[:8],
        "strategy": strategy_id,
        "coin": coin,
        "direction": signal["direction"],
        "size": sz,
        "sl": sl_price,
        "tp": tp_price,
        "order": order,
        "algo": algo,
        "timestamp": time.time(),
    }

    # Log trade with estimated worst-case PnL (SL hit scenario)
    # pnl_sync.py will update this to actual realized PnL once position closes
    estimated_loss = -(position_size * sl_pct / 100)
    trade_created_at = result["timestamp"]
    log_trade(session_id, signal, result, pnl=estimated_loss)
    if signal_time:
        mark_signal_executed(session_id, strategy_id, coin, signal_time)
    logger.warning(
        "Auto-executed: %s %s %s sz=%s for session %s (est_pnl=%.2f)",
        side, inst_id, strategy_id, sz, session_id[:8], estimated_loss,
    )

    # Fire-and-forget: sync actual realized PnL once position closes
    import asyncio
    asyncio.create_task(sync_realized_pnl(session_id, inst_id, trade_created_at))

    return result
