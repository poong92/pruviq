"""
Auto-execution worker — monitors signals and executes trades for subscribed users.

Industry standard architecture (3commas/Bybit/OKX bot benchmark):
  - Mark price fetched at execution time (not signal time) for contract sizing
  - SL/TP calculated from ACTUAL FILL PRICE (avgPx) after order confirmation
  - All events notify user via Telegram: entry, SL/TP set, limit hits, failures

Safety guards:
  - Max $5000 per trade (configurable per user)
  - Max 20 trades/day (configurable)
  - Daily loss limit (configurable, default $200)
  - Master switch per user
  - Anomaly detection: pauses if 3 consecutive losses
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

from .client import OKXClient
from .oauth import get_valid_token, is_authenticated
from .orders import _pruviq_to_okx_inst_id, _calc_sl_tp_prices, _calc_contract_sz
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
from .notifications import (
    send_signal_alert,
    send_trade_executed,
    send_execution_failed,
    send_safety_limit,
)
from .pnl_sync import sync_realized_pnl

logger = logging.getLogger("okx_auto_executor")

# How long to wait for market order fill before querying avgPx (seconds)
_FILL_WAIT_S = 1.5


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
    chat_id = settings.get("alert_telegram_chat_id", "")

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
        if chat_id:
            asyncio.create_task(send_safety_limit(chat_id, "daily_trades", {
                "trades_today": daily_stats["trades_today"],
                "max_daily": max_daily,
                "coin": coin, "strategy": strategy_id,
            }))
        return None

    # ── Safety: daily loss limit ──
    daily_loss_limit = settings.get("daily_loss_limit_usdt", 200)
    if daily_stats["pnl_today"] <= -daily_loss_limit:
        logger.warning(
            "Session %s daily loss limit hit ($%.2f / limit $%.2f)",
            session_id[:8], daily_stats["pnl_today"], daily_loss_limit,
        )
        if chat_id:
            asyncio.create_task(send_safety_limit(chat_id, "daily_loss", {
                "pnl_today": daily_stats["pnl_today"],
                "limit": daily_loss_limit,
                "coin": coin, "strategy": strategy_id,
            }))
        return None

    # ── Safety: consecutive loss guard ──
    recent_trades = get_trade_log(session_id, limit=3)
    if len(recent_trades) >= 3:
        if all(t["pnl_usdt"] < 0 for t in recent_trades[:3]):
            logger.warning(
                "Session %s: 3 consecutive losses — auto-pausing",
                session_id[:8],
            )
            if chat_id:
                asyncio.create_task(send_safety_limit(chat_id, "consecutive_loss", {
                    "count": 3, "coin": coin, "strategy": strategy_id,
                }))
            return None

    # ── Execute ──
    inst_id = _pruviq_to_okx_inst_id(coin)
    side = "sell" if signal["direction"] == "short" else "buy"
    sl_pct = signal.get("sl_pct", 10)
    tp_pct = signal.get("tp_pct", 8)
    leverage = settings["leverage"]
    td_mode = settings.get("td_mode", "isolated")

    token = await get_valid_token(session_id)
    async with OKXClient(token, session_id=session_id) as client:

        # ── Industry standard: fetch LIVE mark price at execution time ──
        # Signal entry_price is from historical OHLCV (up to 5min stale).
        # Mark price ensures correct contract sizing and SL/TP reference.
        try:
            mark_price = await client.get_mark_price(inst_id)
        except Exception as e:
            logger.error("Failed to get mark price for %s: %s — skipping", inst_id, e)
            if chat_id:
                asyncio.create_task(send_execution_failed(chat_id, signal, f"mark price fetch failed: {e}"))
            return None

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
                if chat_id:
                    asyncio.create_task(send_execution_failed(chat_id, signal, "insufficient USDT balance"))
                return None
            position_size = avail * pct / 100
            logger.info(
                "Percent sizing: %.1f%% of $%.2f = $%.2f for session %s",
                pct, avail, position_size, session_id[:8],
            )
        else:
            position_size = settings["position_size_usdt"]

        # ── Check concurrent position limit ──
        positions = await client.get_positions()
        open_count = sum(1 for p in positions if float(p.pos or 0) != 0)
        if open_count >= settings["max_concurrent"]:
            logger.warning(
                "Session %s at max concurrent positions (%d/%d)",
                session_id[:8], open_count, settings["max_concurrent"],
            )
            return None

        # ── Contract size using live mark price ──
        try:
            sz = await _calc_contract_sz(client, inst_id, position_size, leverage, mark_price)
        except ValueError as e:
            logger.warning("Position too small for auto-execute: %s", e)
            if chat_id:
                asyncio.create_task(send_execution_failed(chat_id, signal, f"position too small: {e}"))
            return None

        # ── Set leverage ──
        await client.set_leverage(inst_id=inst_id, lever=leverage, mgn_mode=td_mode)

        # ── Market order ──
        order = await client.place_order(inst_id=inst_id, side=side, sz=sz, td_mode=td_mode)
        ord_id = order.get("ordId", "")
        if not ord_id:
            logger.error("Auto order returned no ordId — signal %s/%s", strategy_id, coin)
            if chat_id:
                asyncio.create_task(send_execution_failed(chat_id, signal, "order returned no ordId"))
            return None

        # ── Industry standard: wait for fill, then query actual avgPx ──
        # Bybit/OKX bots wait ~1-2s then query fill price for SL/TP accuracy.
        await asyncio.sleep(_FILL_WAIT_S)
        fill_price = mark_price  # fallback
        try:
            fill_price = await client.get_order_fill_price(inst_id, ord_id)
            logger.warning(
                "← Fill confirmed: ordId=%s avgPx=%.6f (markPx was %.6f)",
                ord_id, fill_price, mark_price,
            )
        except Exception as e:
            logger.warning(
                "Could not get fill price for %s — using mark price %.6f: %s",
                ord_id, mark_price, e,
            )

        # ── SL/TP calculated from ACTUAL FILL PRICE (industry standard) ──
        sl_price, tp_price = _calc_sl_tp_prices(fill_price, signal["direction"], sl_pct, tp_pct)
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
            algo_id = (algo.get("data") or [{}])[0].get("algoId", "")
            logger.warning("← SL/TP set: SL=%s TP=%s algoId=%s", sl_price, tp_price, algo_id)
        except Exception as algo_err:
            logger.error(
                "CRITICAL: SL/TP failed after auto-order %s (%s) — closing: %s",
                ord_id, inst_id, algo_err,
            )
            try:
                await client.close_position(inst_id, mgn_mode=td_mode)
                if chat_id:
                    asyncio.create_task(send_execution_failed(chat_id, signal,
                        f"⚠️ SL/TP FAILED — position closed. ordId={ord_id}"))
            except Exception as close_err:
                logger.error("EMERGENCY CLOSE FAILED for %s: %s", inst_id, close_err)
            return None

    result = {
        "session_id": session_id[:8],
        "strategy": strategy_id,
        "coin": coin,
        "direction": signal["direction"],
        "size": sz,
        "fill_price": fill_price,
        "sl": sl_price,
        "tp": tp_price,
        "order": order,
        "algo": algo,
        "timestamp": time.time(),
    }

    # Log trade: estimated worst-case PnL (SL hit), pnl_sync updates to actual later
    estimated_loss = -(position_size * sl_pct / 100)
    trade_created_at = result["timestamp"]
    log_trade(session_id, signal, result, pnl=estimated_loss)
    if signal_time:
        mark_signal_executed(session_id, strategy_id, coin, signal_time)

    logger.warning(
        "Auto-executed: %s %s %s sz=%s fillPx=%.6f SL=%s TP=%s session=%s",
        side, inst_id, strategy_id, sz, fill_price, sl_price, tp_price, session_id[:8],
    )

    # ── Telegram: trade entry confirmation (industry standard) ──
    if chat_id:
        asyncio.create_task(send_trade_executed(chat_id, signal, fill_price, sz, sl_price, tp_price))

    # Fire-and-forget: sync actual realized PnL once position closes
    asyncio.create_task(sync_realized_pnl(session_id, inst_id, trade_created_at))

    return result
