"""
PRUVIQ Simulation → OKX Execution bridge.
시뮬레이터 결과를 실거래 주문으로 변환.
"""
from __future__ import annotations

import logging
from typing import Optional

from .client import OKXClient
from .models import PlaceOrderResponse, SimToExecRequest
from .oauth import get_valid_token

logger = logging.getLogger("okx_orders")


def _pruviq_to_okx_inst_id(symbol: str) -> str:
    """PRUVIQ 심볼 → OKX instId 변환 (BTCUSDT → BTC-USDT-SWAP)."""
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
    """시뮬 SL/TP %를 실제 가격으로 변환."""
    if direction == "short":
        sl_price = entry_price * (1 + sl_pct / 100)
        tp_price = entry_price * (1 - tp_pct / 100)
    else:  # long
        sl_price = entry_price * (1 - sl_pct / 100)
        tp_price = entry_price * (1 + tp_pct / 100)
    return f"{sl_price:.2f}", f"{tp_price:.2f}"


async def execute_from_simulation(
    user_id: str,
    req: SimToExecRequest,
    current_price: Optional[float] = None,
) -> dict:
    """
    시뮬레이션 결과를 OKX 실거래로 실행.

    Flow:
      1. OAuth 토큰 확인
      2. 심볼 변환
      3. 포지션 크기 계산
      4. 시장가 주문 실행
      5. SL/TP 알고 주문 설정
    """
    # 1. 토큰
    token = await get_valid_token(user_id)
    inst_id = _pruviq_to_okx_inst_id(req.symbol)
    side = "sell" if req.direction == "short" else "buy"

    # 2. 포지션 크기 (USDT 기준 → 계약 수)
    if not current_price:
        raise ValueError("current_price required for position sizing")

    contract_size = (req.position_size_usdt * req.leverage) / current_price
    sz = f"{contract_size:.4f}"

    async with OKXClient(token) as client:
        # 3. 주문 실행
        logger.info(
            "Executing %s %s %s sz=%s lever=%d (from sim: %s)",
            side, inst_id, req.strategy, sz, req.leverage, req.symbol,
        )
        order = await client.place_order(
            inst_id=inst_id,
            side=side,
            sz=sz,
            td_mode="isolated",
        )
        logger.info("Order placed: %s", order.ord_id)

        # 4. SL/TP 설정
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
        )
        logger.info("SL/TP set: SL=%s TP=%s", sl_price, tp_price)

    return {
        "order": order.model_dump(),
        "algo": algo_result,
        "details": {
            "inst_id": inst_id,
            "side": side,
            "size": sz,
            "sl_price": sl_price,
            "tp_price": tp_price,
            "leverage": req.leverage,
            "strategy": req.strategy,
        },
    }
