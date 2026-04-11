"""
OKX Broker FastAPI router.

Endpoints:
  /auth/okx/*    — OAuth flow (start, callback, status, disconnect)
  /execute/*     — Trade execution (order, positions, balance)

Register in main.py:
  from okx.router import router as okx_router
  app.include_router(okx_router)
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse

from .config import COOKIE_DOMAIN, FRONTEND_URL, OKX_CLIENT_ID

ADMIN_KEY = os.environ.get("ADMIN_API_KEY", "")
from .models import SimToExecRequest
from .oauth import (
    disconnect,
    exchange_code,
    generate_auth_url,
    generate_oauth_params,
    get_valid_token,
    is_authenticated,
)
from .orders import execute_from_simulation

logger = logging.getLogger("okx_router")

router = APIRouter(tags=["OKX Broker"])

SESSION_COOKIE = "pruviq_okx_session"
COOKIE_MAX_AGE = 3 * 24 * 3600  # 3 days (match refresh_token TTL)


def _get_session(request: Request) -> str:
    return request.cookies.get(SESSION_COOKIE, "")


def _set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=session_id,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        domain=COOKIE_DOMAIN,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE, domain=COOKIE_DOMAIN, path="/")


# ── OAuth Flow ─────────────────────────────────────────────

@router.get("/auth/okx/init")
async def oauth_init(
    redirect: str = Query("", description="Post-OAuth redirect URL"),
    lang: str = Query("en", description="Language for redirect"),
):
    """
    Step 1 (JS SDK flow): Returns OAuth params for OKEXOAuthSDK.authorize().
    client_id is not secret — safe to return to frontend.
    Generates and stores CSRF state for callback validation.
    """
    if not OKX_CLIENT_ID:
        raise HTTPException(503, "OKX Broker not configured")
    return generate_oauth_params(redirect_after=redirect, lang=lang)


@router.get("/auth/okx/start")
async def oauth_start(
    redirect: str = Query("", description="Post-OAuth redirect URL"),
    lang: str = Query("en", description="Language for redirect"),
):
    """Step 1 (legacy redirect flow): Redirect user to OKX OAuth login page."""
    if not OKX_CLIENT_ID:
        raise HTTPException(503, "OKX Broker not configured")
    url = generate_auth_url(redirect_after=redirect, lang=lang)
    return RedirectResponse(url=url, status_code=302)


@router.get("/auth/okx/callback")
async def oauth_callback(
    code: str = Query(..., description="OKX authorization code"),
    state: str = Query(..., description="CSRF state token"),
    domain: str = Query("", description="OKX SDK domain parameter"),
):
    """Step 2: Exchange code for tokens, set session cookie, redirect to frontend."""
    try:
        session_id, redirect_url, lang = await exchange_code(code, state, domain)
    except ValueError as e:
        logger.warning("OAuth callback rejected: %s", e)
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard?okx=error", status_code=302
        )
    except Exception as e:
        logger.error("OAuth callback failed: %s", e)
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard?okx=error", status_code=302
        )

    if redirect_url:
        target = redirect_url
    elif lang == "ko":
        target = f"{FRONTEND_URL}/ko/dashboard?okx=success"
    else:
        target = f"{FRONTEND_URL}/dashboard?okx=success"

    response = RedirectResponse(url=target, status_code=302)
    _set_session_cookie(response, session_id)
    return response


@router.get("/auth/okx/status")
async def oauth_status(request: Request):
    """Check if user has an active OKX connection + admin status."""
    session_id = _get_session(request)
    admin_header = request.headers.get("x-admin-key", "")
    is_admin = bool(ADMIN_KEY and admin_header == ADMIN_KEY)
    return {"connected": is_authenticated(session_id), "admin": is_admin}


@router.post("/auth/okx/disconnect")
async def oauth_disconnect(request: Request):
    """Disconnect OKX account, clear session."""
    session_id = _get_session(request)
    if session_id:
        disconnect(session_id)
    response = Response(
        content='{"status":"disconnected"}', media_type="application/json"
    )
    _clear_session_cookie(response)
    return response


# ── Trade Execution ────────────────────────────────────────

@router.post("/execute/order")
async def execute_order(
    req: SimToExecRequest,
    request: Request,
    current_price: float = Query(..., description="Current market price"),
):
    """Execute trade from simulation results. Requires OKX connection."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX. Connect first.")

    try:
        result = await execute_from_simulation(session_id, req, current_price)
        return {"status": "executed", **result}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("Order execution failed for session %s: %s", session_id[:8], e)
        raise HTTPException(500, f"Execution failed: {e}")


@router.get("/execute/positions")
async def get_positions(request: Request, symbol: str = Query(None)):
    """Get current open positions."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .client import OKXClient
    from .orders import _pruviq_to_okx_inst_id

    token = await get_valid_token(session_id)
    inst_id = _pruviq_to_okx_inst_id(symbol) if symbol else None

    async with OKXClient(token) as client:
        positions = await client.get_positions(inst_id)
        return {"positions": [p.model_dump() for p in positions]}


@router.get("/execute/balance")
async def get_balance(request: Request, ccy: str = Query("USDT")):
    """Get account balance."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .client import OKXClient

    token = await get_valid_token(session_id)

    async with OKXClient(token) as client:
        balances = await client.get_balance(ccy)
        return {"balances": [b.model_dump() for b in balances]}


# ── Trading Settings ───────────────────────────────────

@router.get("/settings/trading")
async def get_trading_settings(request: Request):
    """Get user's auto-trading configuration."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .settings import get_settings, get_daily_stats

    return {
        "settings": get_settings(session_id),
        "daily_stats": get_daily_stats(session_id),
    }


@router.post("/settings/trading")
async def save_trading_settings(request: Request):
    """Save user's auto-trading configuration."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .settings import save_settings

    body = await request.json()
    saved = save_settings(session_id, body)
    return {"settings": saved, "status": "saved"}


@router.get("/settings/trades")
async def get_trade_history(request: Request, limit: int = Query(50, le=200)):
    """Get user's trade execution history."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .settings import get_trade_log

    return {"trades": get_trade_log(session_id, limit)}
