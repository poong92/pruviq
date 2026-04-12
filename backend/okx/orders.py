"""
PRUVIQ Simulation → OKX Execution bridge.
Converts simulation results to live OKX orders with broker tag.
"""
from __future__ import annotations

import logging
import math
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


async def _calc_contract_sz(
    client: OKXClient,
    inst_id: str,
    position_usdt: float,
    leverage: int,
    price: float,
) -> str:
    """
    Calculate correct OKX SWAP contract size (integer contracts).

    OKX SWAP sz = number of contracts (must be integer ≥ minSz).
    Each contract = ctVal base currency.
    Example: BTC-USDT-SWAP ctVal=0.01 BTC
      $100 × 5x / (0.01 BTC × $85,000) = 0.58 → floor → 0 contracts → raise ValueError
      $500 × 5x / (0.01 BTC × $85,000) = 2.94 → floor → 2 contracts ✓
    """
    info = await client.get_instrument_info(inst_id)
    ct_val = info["ctVal"]
    min_sz = info["minSz"]
    lot_sz = info["lotSz"]

    notional = position_usdt * leverage
    raw_contracts = notional / (ct_val * price)
    # Round down to lot_sz boundary
    contracts = math.floor(raw_contracts / lot_sz) * lot_sz

    if contracts < min_sz:
        raise ValueError(
            f"Position too small for {inst_id}: "
            f"${position_usdt:.0f} × {leverage}x = ${notional:.0f} notional "
            f"= {raw_contracts:.3f} contracts (min {min_sz}). "
            f"Need at least ${ct_val * price * min_sz:.0f} notional."
        )

    return str(int(contracts))


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

    async with OKXClient(token, session_id=session_id) as client:
        # Auto-fetch mark price if not supplied (or zero)
        if not current_price or current_price <= 0:
            logger.warning(
                "current_price not supplied for %s — fetching mark price", inst_id
            )
            current_price = await client.get_mark_price(inst_id)

        # Correct OKX SWAP contract size (integer, uses ctVal)
        sz = await _calc_contract_sz(client, inst_id, req.position_size_usdt, req.leverage, current_price)

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
        ord_id = order.get("ordId", "")
        logger.warning("← Market order placed ordId=%s", ord_id)

        # SL/TP algo order — if this fails, immediately close the naked position
        sl_price, tp_price = _calc_sl_tp_prices(
            current_price, req.direction, req.sl_pct, req.tp_pct,
        )
        close_side = "buy" if req.direction == "short" else "sell"

        try:
            algo_result = await client.place_algo_order(
                inst_id=inst_id,
                side=close_side,
                sz=sz,
                sl_trigger_px=sl_price,
                tp_trigger_px=tp_price,
                td_mode=td_mode,
            )
            logger.warning("← SL/TP set: SL=%s TP=%s ordId=%s", sl_price, tp_price, ord_id)
        except Exception as algo_err:
            logger.error(
                "CRITICAL: SL/TP failed after order %s (%s) — closing naked position: %s",
                ord_id, inst_id, algo_err,
            )
            try:
                await client.close_position(inst_id, mgn_mode=td_mode)
                logger.warning("Emergency close executed for %s", inst_id)
            except Exception as close_err:
                logger.error("EMERGENCY CLOSE FAILED for %s: %s", inst_id, close_err)
            raise ValueError(
                f"SL/TP placement failed for {inst_id} (ordId={ord_id}), "
                f"position closed as safety measure. Error: {algo_err}"
            )

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
