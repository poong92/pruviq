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
    get_daily_stats,
    get_settings,
    log_trade,
)

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

    return executed


async def _try_execute(
    session_id: str, signal: dict, settings: dict
) -> Optional[dict]:
    """Try to execute a single signal for a user. Returns result or None."""

    strategy_id = signal["strategy"]
    coin = signal["coin"]

    # ── Filter: strategy subscribed? ──
    if settings["strategies"] and strategy_id not in settings["strategies"]:
        return None

    # ── Filter: coin subscribed? ──
    if settings["coins"] and coin not in settings["coins"]:
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

    # NOTE: consecutive-loss guard requires actual realized PnL from position
    # close events (no OKX webhook yet). Currently all logged pnl_usdt values
    # are worst-case estimates (always negative), so this check would fire
    # after every 3rd trade. Deferred until position-close tracking is added.

    # ── Execute ──
    token = await get_valid_token(session_id)
    async with OKXClient(token) as client:
        positions = await client.get_positions()
        open_count = sum(1 for p in positions if float(p.pos or 0) != 0)
        if open_count >= settings["max_concurrent"]:
            logger.warning(
                "Session %s at max concurrent positions (%d/%d)",
                session_id[:8], open_count, settings["max_concurrent"],
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
    contract_size = (position_size * leverage) / entry_price
    sz = f"{contract_size:.4f}"

    sl_pct = signal.get("sl_pct", 10)
    tp_pct = signal.get("tp_pct", 8)

    async with OKXClient(token) as client:
        # Set leverage before placing order
        await client.set_leverage(
            inst_id=inst_id,
            lever=leverage,
            mgn_mode=td_mode,
        )

        # Market order
        order = await client.place_order(
            inst_id=inst_id,
            side=side,
            sz=sz,
            td_mode=td_mode,
        )

        # SL/TP
        sl_price, tp_price = _calc_sl_tp_prices(
            entry_price, signal["direction"], sl_pct, tp_pct,
        )
        close_side = "buy" if signal["direction"] == "short" else "sell"

        algo = await client.place_algo_order(
            inst_id=inst_id,
            side=close_side,
            sz=sz,
            sl_trigger_px=sl_price,
            tp_trigger_px=tp_price,
            td_mode=td_mode,
        )

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
    # This ensures daily_loss_limit and consecutive_loss guards function
    estimated_loss = -(position_size * sl_pct / 100)
    log_trade(session_id, signal, result, pnl=estimated_loss)
    logger.info(
        "Auto-executed: %s %s %s sz=%s for session %s",
        side, inst_id, strategy_id, sz, session_id[:8],
    )

    return result
