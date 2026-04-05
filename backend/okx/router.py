"""
OKX Broker FastAPI router.
/auth/okx/* — OAuth 플로우
/execute/*  — 주문 실행

main.py에서 include:
  from okx.router import router as okx_router
  app.include_router(okx_router)
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from .models import SimToExecRequest
from .oauth import exchange_code, generate_auth_url, is_authenticated
from .orders import execute_from_simulation

logger = logging.getLogger("okx_router")

router = APIRouter(tags=["OKX Broker"])


# ── OAuth Flow ─────────────────────────────────────────

@router.get("/auth/okx/start")
async def oauth_start(user_id: str = Query(..., description="PRUVIQ user identifier")):
    """
    Step 1: OKX OAuth 시작.
    유저를 OKX 로그인 페이지로 redirect.
    """
    url = generate_auth_url(user_id)
    return RedirectResponse(url=url)


@router.get("/auth/okx/callback")
async def oauth_callback(
    code: str = Query(..., description="OKX authorization code"),
    state: str = Query("", description="State containing user_id"),
):
    """
    Step 2: OKX에서 돌아온 callback.
    authorization code → access token 교환.
    """
    # state format: "user_id:random_token"
    user_id = state.split(":")[0] if ":" in state else state
    if not user_id:
        raise HTTPException(400, "Invalid state parameter")

    try:
        token_state = await exchange_code(code, user_id)
        return {
            "status": "connected",
            "user_id": user_id,
            "scope": token_state.scope,
            "message": "OKX account connected successfully. You can now execute trades.",
        }
    except Exception as e:
        logger.error("OAuth callback failed: %s", e)
        raise HTTPException(400, f"OAuth failed: {e}")


@router.get("/auth/okx/status")
async def oauth_status(user_id: str = Query(...)):
    """유저의 OKX 연결 상태 확인."""
    return {
        "connected": is_authenticated(user_id),
        "user_id": user_id,
    }


# ── Trade Execution ────────────────────────────────────

@router.post("/execute/order")
async def execute_order(
    req: SimToExecRequest,
    user_id: str = Query(...),
    current_price: float = Query(..., description="현재 시장가"),
):
    """
    시뮬 결과 → OKX 실거래 실행.

    1. OAuth 토큰 확인
    2. 시장가 주문
    3. SL/TP 알고 주문
    """
    if not is_authenticated(user_id):
        raise HTTPException(401, "Not connected to OKX. Use /auth/okx/start first.")

    try:
        result = await execute_from_simulation(user_id, req, current_price)
        return {"status": "executed", **result}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("Order execution failed: %s", e)
        raise HTTPException(500, f"Execution failed: {e}")


@router.get("/execute/positions")
async def get_positions(user_id: str = Query(...), symbol: str = Query(None)):
    """현재 포지션 조회."""
    if not is_authenticated(user_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .client import OKXClient
    from .oauth import get_valid_token
    from .orders import _pruviq_to_okx_inst_id

    token = await get_valid_token(user_id)
    inst_id = _pruviq_to_okx_inst_id(symbol) if symbol else None

    async with OKXClient(token) as client:
        positions = await client.get_positions(inst_id)
        return {"positions": [p.model_dump() for p in positions]}


@router.get("/execute/balance")
async def get_balance(user_id: str = Query(...), ccy: str = Query("USDT")):
    """잔고 조회."""
    if not is_authenticated(user_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .client import OKXClient
    from .oauth import get_valid_token

    token = await get_valid_token(user_id)

    async with OKXClient(token) as client:
        balances = await client.get_balance(ccy)
        return {"balances": [b.model_dump() for b in balances]}
