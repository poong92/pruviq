"""
PRUVIQ Simulation → OKX Execution bridge.
Converts simulation results to live OKX orders with broker tag.
"""
from __future__ import annotations

import logging
from typing import Optional

from .client import OKXClient
from .models import SimToExecRequest
from .oauth import get_valid_token

logger = logging.getLogger("okx_orders")


def _pruviq_to_okx_inst_id(symbol: str) -> str:
    """Convert PRUVIQ symbol → OKX instId (BTCUSDT → BTC-USDT-SWAP)."""
    if "-" in symbol:
        return symbol if symbol.endswith("-SWAP") else f"{symbol}-SWAP"
    for quote in ("USDT", "USDC", "USD"):
        if symbol.endswith(quote):
            return f"{symbol[:-len(quote)]}-{quote}-SWAP"
    return symbol


def _calc_sl_tp_prices(
    entry_price: float,
    direction: str,
    sl_pct: float,
    tp_pct: float,
) -> tuple[str, str]:
    """Convert simulation SL/TP percentages to absolute prices."""
    if direction == "short":
        sl_price = entry_price * (1 + sl_pct / 100)
        tp_price = entry_price * (1 - tp_pct / 100)
    else:
        sl_price = entry_price * (1 - sl_pct / 100)
        tp_price = entry_price * (1 + tp_pct / 100)
    return f"{sl_price:.2f}", f"{tp_price:.2f}"


async def execute_from_simulation(
    session_id: str,
    req: SimToExecRequest,
    current_price: Optional[float] = None,
) -> dict:
    """
    Execute simulation result as live OKX trade.

    1. Get valid OAuth token
    2. Convert symbol → OKX instId
    3. If current_price not provided (or 0), fetch mark price from OKX
    4. Place market order (with broker tag)
    5. Set SL/TP algo orders
    """
    token = await get_valid_token(session_id)
    inst_id = _pruviq_to_okx_inst_id(req.symbol)
    side = "sell" if req.direction == "short" else "buy"
    td_mode = req.td_mode if req.td_mode in ("isolated", "cross") else "isolated"

    async with OKXClient(token) as client:
        # Auto-fetch mark price if not supplied (or zero)
        if not current_price or current_price <= 0:
            logger.warning(
                "current_price not supplied for %s — fetching mark price", inst_id
            )
            current_price = await client.get_mark_price(inst_id)

        # Position size: USDT × leverage / price
        contract_size = (req.position_size_usdt * req.leverage) / current_price
        sz = f"{contract_size:.4f}"

        logger.warning(
            "→ Execute %s %s sz=%s lever=%d td_mode=%s strategy=%s price=%.4f",
            side, inst_id, sz, req.leverage, td_mode, req.strategy, current_price,
        )

        # Set leverage before placing order
        await client.set_leverage(
            inst_id=inst_id,
            lever=req.leverage,
            mgn_mode=td_mode,
        )

        # Market order
        order = await client.place_order(
            inst_id=inst_id,
            side=side,
            sz=sz,
            td_mode=td_mode,
        )
        logger.info("Order placed: %s", order.get("ordId", ""))

        # SL/TP algo order
        sl_price, tp_price = _calc_sl_tp_prices(
            current_price, req.direction, req.sl_pct, req.tp_pct,
        )
        close_side = "buy" if req.direction == "short" else "sell"

        algo_result = await client.place_algo_order(
            inst_id=inst_id,
            side=close_side,
            sz=sz,
            sl_trigger_px=sl_price,
            tp_trigger_px=tp_price,
            td_mode=td_mode,
        )
        logger.warning("← Order placed ordId=%s SL=%s TP=%s", order.get("ordId"), sl_price, tp_price)

    return {
        "order": order,
        "algo": algo_result,
        "details": {
            "inst_id": inst_id,
            "side": side,
            "size": sz,
            "entry_price": current_price,
            "sl_price": sl_price,
            "tp_price": tp_price,
            "leverage": req.leverage,
            "td_mode": td_mode,
            "strategy": req.strategy,
        },
    }
