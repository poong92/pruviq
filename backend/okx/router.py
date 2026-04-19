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
import time

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse

from .config import COOKIE_DOMAIN, FRONTEND_URL, OKX_CLIENT_ID

ADMIN_KEY = os.environ.get("ADMIN_API_KEY", "")

# ── Rate limiting for /execute/order ─────────────────────
# {session_id: last_call_timestamp} — prevents accidental double-fire
_order_rate_limit: dict[str, float] = {}
ORDER_RATE_LIMIT_SECONDS = 10
from .models import SimToExecRequest
from .oauth import (
    disconnect,
    exchange_code,
    generate_auth_url,
    generate_oauth_params,
    get_api_credentials,
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

# 2026-04-19: GET + HEAD 둘 다 허용 — 브라우저 prefetch, SNS 크롤러(Twitter/OG),
# Cloudflare 헬스체크가 HEAD 먼저 보내는데 FastAPI @router.get 은 HEAD 자동 허용
# 안 해서 405 반환 → 일부 client가 "링크 깨짐"으로 판단. OAuth 유입 손실 원인.
@router.api_route("/auth/okx/init", methods=["GET", "HEAD"])
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


@router.api_route("/auth/okx/start", methods=["GET", "HEAD"])
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
    request: Request,
    code: str = Query("", description="OKX authorization code"),
    state: str = Query("", description="CSRF state token"),
    domain: str = Query("", description="OKX SDK domain parameter"),
    error: str = Query("", description="OKX returned error code"),
    error_description: str = Query("", description="OKX returned error description"),
):
    """Step 2: Exchange code for tokens, set session cookie, redirect to frontend.
    2026-04-19: OAuth flow 디버깅용 에러 파라미터 로깅 추가 (OKX가 error query로
    돌려보내는 경우 callback 0 호출 원인 추적 가능)."""
    # OKX가 에러를 쿼리로 돌려보내는 경로 (scope 거부, redirect_uri mismatch 등)
    if error or not code:
        logger.warning(
            "OAuth callback error-return: error=%s desc=%s code_present=%s state_present=%s qs=%s",
            error[:100], error_description[:200], bool(code), bool(state),
            str(request.url.query)[:300],
        )
        err_param = error or "no_code"
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard?okx=error&reason={err_param[:50]}",
            status_code=302,
        )
    try:
        session_id, redirect_url, lang = await exchange_code(code, state, domain)
    except ValueError as e:
        logger.warning("OAuth callback rejected: %s", e)
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard?okx=error&reason=invalid_state",
            status_code=302,
        )
    except Exception as e:
        logger.error("OAuth callback failed: %s: %s", e.__class__.__name__, e)
        return RedirectResponse(
            url=f"{FRONTEND_URL}/dashboard?okx=error&reason=exchange_failed",
            status_code=302,
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


@router.api_route("/auth/okx/status", methods=["GET", "HEAD"])
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
    current_price: float = Query(None, description="Current market price (auto-fetched if omitted)"),
    idempotency_key: Optional[str] = Header(
        None,
        alias="Idempotency-Key",
        description=(
            "Optional caller-supplied key (RFC-style) for safe retries. "
            "If present, it is hashed into the OKX clOrdId so a retried POST "
            "cannot place a duplicate order."
        ),
    ),
):
    """Execute trade from simulation results. Requires OKX connection."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX. Connect first.")

    # Rate limit: 10 seconds between orders per session
    now = time.time()
    last_call = _order_rate_limit.get(session_id, 0)
    if now - last_call < ORDER_RATE_LIMIT_SECONDS:
        wait = int(ORDER_RATE_LIMIT_SECONDS - (now - last_call))
        raise HTTPException(429, f"Rate limit: wait {wait}s before next order")
    _order_rate_limit[session_id] = now

    # 🔴 2026-04-19: 서버측 position cap. auto_executor 에는 있었으나 수동 POST 경로는 우회됨.
    # settings.max_per_trade_usdt (default 200) 로 강제 캡.
    from .settings import get_settings
    _settings = get_settings(session_id)
    _cap = float(_settings.get("max_per_trade_usdt", 200.0))
    if req.position_size_usdt > _cap:
        _order_rate_limit.pop(session_id, None)
        raise HTTPException(
            400,
            f"Position size ${req.position_size_usdt:.2f} exceeds max_per_trade_usdt cap ${_cap:.2f}. "
            f"Adjust in settings or reduce size.",
        )

    # Idempotency: if the caller supplied Idempotency-Key, derive a
    # deterministic OKX clOrdId from it. OKX rejects a second POST with the
    # same clOrdId (code 51020), so the retry is safe even if the first
    # request silently succeeded on OKX but failed to return to the client.
    # Format: [A-Za-z0-9_]{1,32}. We hash + truncate to stay in spec and
    # prefix with session_id[:4] to make debug logs traceable.
    #
    # 2026-04-19: reject header-present-but-empty rather than silently
    # skipping. Empty header is a client bug (sent `Idempotency-Key:` with
    # no value) — silently ignoring gives the caller NO replay protection
    # when they thought they had it.
    cl_ord_id: Optional[str] = None
    if idempotency_key is not None:
        stripped = idempotency_key.strip()
        if not stripped:
            _order_rate_limit.pop(session_id, None)
            raise HTTPException(
                400,
                "Idempotency-Key header present but empty. Either omit the "
                "header or supply a non-whitespace value (recommended: a "
                "stable hash of the source signal).",
            )
        if len(stripped) > 256:
            _order_rate_limit.pop(session_id, None)
            raise HTTPException(
                400,
                f"Idempotency-Key too long ({len(stripped)}); max 256 chars.",
            )
        import hashlib as _hashlib
        raw = f"{session_id}:{stripped}".encode()
        cl_ord_id = _hashlib.sha1(raw).hexdigest()[:32]

    try:
        result = await execute_from_simulation(
            session_id, req, current_price, cl_ord_id=cl_ord_id,
        )
        return {"status": "executed", **result}
    except ValueError as e:
        _order_rate_limit.pop(session_id, None)  # release rate limit on error
        raise HTTPException(400, str(e))
    except Exception as e:
        _order_rate_limit.pop(session_id, None)
        logger.error("Order execution failed for session %s: %s", session_id[:8], e)
        raise HTTPException(500, f"Execution failed: {e}")


def _pos_to_camel(p) -> dict:
    """Convert PositionInfo to camelCase dict matching LivePositions.tsx interface."""
    return {
        "instId": p.inst_id,
        "pos": p.pos,
        "avgPx": p.avg_px,
        "markPx": p.mark_px,
        "upl": p.pnl,
        "uplRatio": p.upl_ratio,
        "liqPx": p.liq_px,
        "lever": p.lever,
        "mgnMode": p.mgn_mode,
        "posSide": p.pos_side,
    }


@router.get("/execute/positions")
async def get_positions(request: Request, symbol: str = Query(None)):
    """Get current open positions. Returns {data: [...]} matching LivePositions.tsx."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .client import OKXClient
    from .orders import _pruviq_to_okx_inst_id

    creds = get_api_credentials(session_id)
    inst_id = _pruviq_to_okx_inst_id(symbol) if symbol else None

    async with OKXClient(**creds) as client:
        positions = await client.get_positions(inst_id)
        return {"data": [_pos_to_camel(p) for p in positions]}


@router.get("/execute/bot-status")
async def get_bot_status(request: Request):
    """Bot status overview — running state, today's trades and PnL."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .settings import get_settings, get_daily_stats, get_trade_log

    settings = get_settings(session_id)
    daily_stats = get_daily_stats(session_id)
    trades = get_trade_log(session_id, limit=1)

    enabled = settings.get("enabled", False)
    mode = settings.get("execution_mode", "manual")
    loss_limit = settings.get("daily_loss_limit_usdt", 200)
    pnl_today = daily_stats["pnl_today"]
    limit_reached = pnl_today <= -loss_limit

    if not enabled:
        status = "stopped"
    elif limit_reached:
        status = "paused"
    else:
        status = "running"

    return {
        "status": status,               # running | stopped | paused
        "execution_mode": mode,          # manual | alert | auto
        "enabled": enabled,
        "trades_today": daily_stats["trades_today"],
        "pnl_today": pnl_today,
        "daily_loss_limit": loss_limit,
        "limit_reached": limit_reached,
        "last_trade": trades[0] if trades else None,
    }


@router.get("/execute/positions-history")
async def get_positions_history(request: Request, limit: int = Query(20, le=100)):
    """Closed position history — realized PnL per trade."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .client import OKXClient

    creds = get_api_credentials(session_id)

    async with OKXClient(**creds) as client:
        raw = await client.get_positions_history(limit=str(limit))

    return {"data": [
        {
            "instId": p.get("instId"),
            "direction": p.get("direction"),
            "realizedPnl": p.get("realizedPnl"),
            "fee": p.get("fee"),
            "fundingFee": p.get("fundingFee"),
            "closingTime": p.get("uTime"),
        }
        for p in raw
    ]}


@router.get("/execute/balance")
async def get_balance(request: Request, ccy: str = Query("USDT")):
    """Get account balance."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .client import OKXClient

    creds = get_api_credentials(session_id)

    async with OKXClient(**creds) as client:
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


# ── User Strategies (saved auto-trading configs) ───────────

@router.post("/strategies")
async def create_user_strategy(request: Request):
    """Create a new saved strategy for the current session."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import create_strategy

    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "body must be a JSON object")
    try:
        strategy = create_strategy(session_id, body)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"strategy": strategy}


@router.get("/strategies")
async def list_user_strategies(request: Request):
    """List all strategies owned by the current session."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import get_strategies

    return {"strategies": get_strategies(session_id)}


@router.put("/strategies/{strategy_id}")
async def update_user_strategy(strategy_id: str, request: Request):
    """Update selected fields of a strategy (partial update)."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import update_strategy

    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "body must be a JSON object")
    try:
        strategy = update_strategy(strategy_id, session_id, body)
    except ValueError as e:
        # "strategy not found" → 404, everything else → 400
        if str(e) == "strategy not found":
            raise HTTPException(404, str(e))
        raise HTTPException(400, str(e))
    return {"strategy": strategy}


@router.delete("/strategies/{strategy_id}")
async def delete_user_strategy(strategy_id: str, request: Request):
    """Delete a strategy owned by the current session."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import delete_strategy

    if not delete_strategy(strategy_id, session_id):
        raise HTTPException(404, "strategy not found")
    return {"status": "deleted", "id": strategy_id}


@router.post("/strategies/{strategy_id}/activate")
async def activate_user_strategy(strategy_id: str, request: Request):
    """Activate a strategy (deactivates all others for this session)."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import activate_strategy

    try:
        strategy = activate_strategy(strategy_id, session_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"strategy": strategy}


@router.post("/strategies/validate")
async def validate_strategy_params(request: Request):
    """
    Run the constraint engine against proposed params + live context.
    Body: {params: {...}, context: {available_margin, symbol_min_order, ...}}
    Returns ConstraintResult (valid, hard_errors, warnings, disabled_fields, calculator).
    """
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .constraints import validate as _validate

    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "body must be a JSON object")
    params = body.get("params") or {}
    context = body.get("context") or {}
    if not isinstance(params, dict) or not isinstance(context, dict):
        raise HTTPException(400, "params and context must be JSON objects")

    try:
        result = _validate(params, context)
    except (TypeError, ValueError) as e:
        raise HTTPException(400, f"invalid input: {e}")

    return {
        "valid": result.valid,
        "hard_errors": result.hard_errors,
        "warnings": result.warnings,
        "disabled_fields": result.disabled_fields,
        "calculator": result.calculator,
    }


# ── Pending Signal Queue (manual approval) ─────────────────

@router.get("/signals/pending")
async def list_pending_signals(request: Request):
    """Return all still-pending signals for the current session."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import get_pending_signals

    return {"signals": get_pending_signals(session_id)}


@router.post("/signals/{signal_id}/approve")
async def approve_pending_signal(signal_id: str, request: Request):
    """
    Approve a pending signal. Optional body: {override_params: {...}}.
    Approved signals become eligible for execution on the next auto-executor tick.
    """
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import approve_signal

    override = None
    try:
        body = await request.json()
        if isinstance(body, dict):
            override = body.get("override_params")
            if override is not None and not isinstance(override, dict):
                raise HTTPException(400, "override_params must be a JSON object")
    except ValueError:
        # No body is fine — approve without overrides
        override = None

    try:
        signal = approve_signal(signal_id, session_id, user_override_params=override)
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(404, str(e))
        raise HTTPException(400, str(e))
    return {"signal": signal}


@router.post("/signals/{signal_id}/reject")
async def reject_pending_signal(signal_id: str, request: Request):
    """Reject a pending signal — it will not be executed."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import reject_signal

    try:
        signal = reject_signal(signal_id, session_id)
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(404, str(e))
        raise HTTPException(400, str(e))
    return {"signal": signal}


# ── Emergency kill-switch (HTTP) ────────────────────────────
# Callable by a Cloudflare Worker or operator script when Telegram is
# unavailable. Disables every enabled trading session in one call.

@router.post("/admin/halt")
async def admin_halt(request: Request):
    """
    Emergency halt via HTTP. Requires X-Admin-Key header.

    Disables every session with `enabled=True` (auto + alert modes).
    Open positions are NOT closed — OKX SL/TP algo orders stay active.
    Returns the same summary message used by the Telegram /halt command.
    """
    if not ADMIN_KEY:
        raise HTTPException(503, "Admin kill-switch disabled (ADMIN_API_KEY unset)")

    provided = request.headers.get("x-admin-key", "")
    # Constant-time comparison; both strings known to be non-empty.
    import hmac
    if not provided or not hmac.compare_digest(provided, ADMIN_KEY):
        raise HTTPException(403, "Invalid admin key")

    from .telegram_halt import execute_halt
    try:
        message = await execute_halt()
    except Exception as e:
        logger.error("admin_halt execute_halt failed: %s", e)
        raise HTTPException(500, f"halt execution failed: {e}")

    return {"status": "halted", "message": message}
