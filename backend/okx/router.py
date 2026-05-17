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
from urllib.parse import quote as urlquote

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse

from .config import (
    COOKIE_DOMAIN,
    FRONTEND_URL,
    OKX_CLIENT_ID,
    OKX_MANUAL_PASTE_ENABLED,
    OKX_OAUTH_EXPERIMENTAL_ENABLED,
)

ADMIN_KEY = os.environ.get("ADMIN_API_KEY", "")

# ── Rate limiting for /execute/order ─────────────────────
# {session_id: last_call_timestamp} — prevents accidental double-fire
_order_rate_limit: dict[str, float] = {}
_simulate_rate_limit: dict[str, float] = {}
SIMULATE_RATE_LIMIT_SECONDS = 5
ORDER_RATE_LIMIT_SECONDS = 10
from .models import SimToExecRequest
from .oauth import (
    disconnect,
    exchange_code,
    generate_auth_url,
    generate_auth_url_experimental,
    generate_oauth_params,
    get_api_credentials,
    is_authenticated,
)
from .storage import validate_csrf_state
from .orders import build_dry_run_payload, execute_from_simulation

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


@router.api_route("/auth/okx/start-experimental", methods=["GET", "HEAD"])
async def oauth_start_experimental(
    variant: str = Query("baseline", description="Param variant for silent-drop debugging"),
    redirect: str = Query("", description="Post-OAuth redirect URL"),
    lang: str = Query("en", description="Language for redirect"),
):
    """Experimental OAuth start — flips ONE parameter vs baseline so the
    owner can A/B test which mutation lifts the /account/users silent drop.
    Activates only when OKX_OAUTH_EXPERIMENTAL_ENABLED=true on DO. Returns
    404 in normal prod state.

    Variants: baseline, read_only_trade, no_channel, no_access_type,
    add_domain, add_platform, read_only_trade_no_channel, no_pkce.
    """
    if not OKX_OAUTH_EXPERIMENTAL_ENABLED:
        raise HTTPException(404, "experimental_disabled")
    if not OKX_CLIENT_ID:
        raise HTTPException(503, "OKX Broker not configured")
    try:
        url = generate_auth_url_experimental(variant, redirect_after=redirect, lang=lang)
    except ValueError as e:
        raise HTTPException(400, str(e))
    logger.warning("oauth-experimental: variant=%s", variant)
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
        # CodeQL js/incomplete-url-substring-sanitization / py/url-redirection:
        # `error` comes from OKX-returned querystring — treat as user input.
        # urllib.parse.quote() percent-encodes characters outside [A-Za-z0-9_.-~]
        # so any control char / CRLF / angle-bracket in the value cannot break
        # out of the querystring (prevents header injection + XSS in any
        # downstream component that happens to render ?reason= unescaped).
        err_param = error or "no_code"
        # Try to recover lang from CSRF state so KO users land on /ko/dashboard
        _err_lang = "en"
        if state:
            _state_result = validate_csrf_state(state)
            if _state_result is not None:
                _err_lang = _state_result[1]  # (redirect_url, lang, code_verifier)
        _err_dash = "/ko/dashboard" if _err_lang == "ko" else "/dashboard"
        return RedirectResponse(
            url=f"{FRONTEND_URL}{_err_dash}?okx=error&reason={urlquote(err_param[:50], safe='')}",
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


@router.post("/auth/okx/manual-connect")
async def oauth_manual_connect(request: Request):
    """Manual API key paste path — alternative to OAuth.

    Body: {api_key, secret_key, passphrase}.
    Validates by calling OKX /api/v5/account/balance with HMAC; on success
    persists via save_session() with the same dict shape OAuth produces, so
    every downstream /execute/* endpoint sees an identical session row.
    """
    if not OKX_MANUAL_PASTE_ENABLED:
        raise HTTPException(503, "manual_paste_disabled")
    try:
        body = await request.json()
    except ValueError:
        raise HTTPException(400, "body must be JSON")
    if not isinstance(body, dict):
        raise HTTPException(400, "body must be JSON object")
    from .manual_auth import validate_and_store
    try:
        session_id = await validate_and_store(
            body.get("api_key", ""),
            body.get("secret_key", ""),
            body.get("passphrase", ""),
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    response = Response(
        content='{"status":"connected"}', media_type="application/json"
    )
    _set_session_cookie(response, session_id)
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


@router.post("/execute/dry-run")
async def execute_dry_run(
    req: SimToExecRequest,
    request: Request,
    current_price: float = Query(
        None, description="Current market price (auto-fetched from OKX mark if omitted)"
    ),
):
    """Phase 2.2 dry-run entrypoint — emits the OKX request bodies that
    /execute/order *would* send for this signal, without firing any POST.
    OKX read endpoints (mark price + instrument info) are still hit because
    tickSz / ctVal are needed to compute the bodies, and they're cheap GETs.

    Use case: 7-day continuous parity check. The Phase 2.2 monitor calls
    this once per simulator-emitted signal and diffs the resulting
    `sl_algo_request` / `trailing_algo_request` against the simulator's
    own ledger. Any drift in callbackRatio mapping, sz rounding, or SL
    price snapping surfaces before Phase 4 production rollout.

    Read-only on OKX side; same auth + position-size cap as /execute/order.
    """
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX. Connect first.")

    # Same server-side position cap as live order path. Dry-run has no money
    # at risk but enforcing the cap keeps "what /execute/order would have
    # done" honest — a signal that would be 400-rejected live should also
    # be rejected here.
    from .settings import get_settings
    _settings = get_settings(session_id)
    _cap = float(_settings.get("max_per_trade_usdt", 200.0))
    if req.position_size_usdt > _cap:
        raise HTTPException(
            400,
            f"Position size ${req.position_size_usdt:.2f} exceeds max_per_trade_usdt cap ${_cap:.2f}.",
        )

    try:
        return await build_dry_run_payload(session_id, req, current_price=current_price)
    except ValueError as ve:
        # _calc_contract_sz raises ValueError when notional too small — same
        # 400-shape as live path so the monitor can compare apples to apples.
        raise HTTPException(400, str(ve))


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


@router.get("/execute/funding-balance")
async def get_funding_balance(request: Request, ccy: str = Query("")):
    """Funding (Wallet) account balance. Separate OKX bucket from
    Trading — surfaces the "$X waiting to transfer" amount that bots
    can't see until owner moves funds via OKX → Assets → Transfer."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .client import OKXClient
    creds = get_api_credentials(session_id)
    async with OKXClient(**creds) as client:
        balances = await client.get_funding_balance(ccy)
        return {"balances": [b.model_dump() for b in balances]}


@router.get("/execute/balance")
async def get_balance(request: Request, ccy: str = Query("")):
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

@router.post("/user-strategies")
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


@router.get("/user-strategies")
async def list_user_strategies(request: Request):
    """List all strategies owned by the current session."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import get_strategies

    return {"strategies": get_strategies(session_id)}


@router.put("/user-strategies/{strategy_id}")
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


@router.delete("/user-strategies/{strategy_id}")
async def delete_user_strategy(strategy_id: str, request: Request):
    """Delete a strategy owned by the current session."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import delete_strategy

    if not delete_strategy(strategy_id, session_id):
        raise HTTPException(404, "strategy not found")
    return {"status": "deleted", "id": strategy_id}


@router.post("/user-strategies/{strategy_id}/activate")
async def activate_user_strategy(
    strategy_id: str,
    request: Request,
    exclusive: bool = Query(
        False,
        description=(
            "true: deactivate all other strategies first (legacy / onboarding). "
            "false (default): activate alongside any other active strategies "
            "— multi-active mode."
        ),
    ),
):
    """Activate a strategy. See `exclusive` query param for single vs multi-active."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import activate_strategy

    try:
        strategy = activate_strategy(strategy_id, session_id, exclusive=exclusive)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"strategy": strategy}


@router.post("/user-strategies/{strategy_id}/deactivate")
async def deactivate_user_strategy(strategy_id: str, request: Request):
    """Deactivate a strategy without touching others (multi-active toggle off)."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    from .strategies import deactivate_strategy

    try:
        strategy = deactivate_strategy(strategy_id, session_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"strategy": strategy}


@router.post("/user-strategies/validate")
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
    lang = str(body.get("lang") or "en")

    try:
        result = _validate(params, context, lang=lang)
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


# ── DCA bots — separate paradigm from signal-based user_strategies ─────────

@router.post("/dca-bots")
async def dca_create(request: Request):
    """Create a DCA bot for this session (starts inactive)."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import create_dca_bot
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "body must be a JSON object")
    try:
        bot = create_dca_bot(session_id, body)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"bot": bot}


@router.get("/dca-bots")
async def dca_list(request: Request):
    """List all DCA bots owned by this session."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import list_dca_bots
    return {"bots": list_dca_bots(session_id)}


@router.post("/dca-bots/pause-all")
async def dca_pause_all(request: Request):
    """User-facing emergency stop — deactivates every active DCA bot
    owned by this session. Returns {paused: N}. Existing fills stay;
    no orders are closed — the loop just stops adding new ones."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import pause_all_dca_bots
    return pause_all_dca_bots(session_id)


@router.get("/dca-bots/previews")
async def dca_previews(request: Request):
    """Cross-bot live previews. For each ACTIVE bot in this session,
    fetch the OKX public ticker for its resolved symbol and compute
    a running preview (next trigger + TP + distances + fire flags).

    Ticker fetches run in parallel via asyncio.gather so 3 bots take
    ~one round-trip instead of three.

    Output: {previews: [{bot_id, symbol_resolved, preview, error?}, ...]}.
    Errors on a per-bot basis don't fail the whole call.
    """
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import list_dca_bots, list_dca_fills, compute_preview
    import asyncio
    import httpx
    from .config import OKX_BASE_URL

    bots = [b for b in list_dca_bots(session_id) if b.get("is_active")]
    if not bots:
        return {"previews": []}

    def _resolve(symbol_raw: str) -> str:
        s = symbol_raw.upper()
        if "-" in s:
            return s
        if s.endswith("USDT"):
            return s[:-4] + "-USDT-SWAP"
        return s

    async def _fetch_one(bot: dict, client: httpx.AsyncClient) -> dict:
        okx_sym = _resolve(str(bot["symbol"]))
        try:
            resp = await client.get(
                f"{OKX_BASE_URL}/api/v5/market/ticker",
                params={"instId": okx_sym},
            )
            body = resp.json() if resp.status_code == 200 else {}
            mark = (
                float(body.get("data", [{}])[0].get("last") or 0.0)
                if body.get("code") == "0" and body.get("data")
                else 0.0
            )
        except Exception as e:
            logger.warning(
                "previews ticker fetch failed bot=%s: %s", bot["id"][:8], e
            )
            mark = 0.0
        if mark <= 0:
            return {
                "bot_id": bot["id"],
                "symbol_resolved": okx_sym,
                "error": "could not fetch mark price",
            }
        fills = list_dca_fills(bot["id"], session_id)
        open_fills = [f for f in fills if f["status"] == "open"]
        preview = compute_preview(bot, mark, open_fills)
        return {
            "bot_id": bot["id"],
            "symbol_resolved": okx_sym,
            "preview": preview,
        }

    async with httpx.AsyncClient(timeout=6) as client:
        results = await asyncio.gather(*[_fetch_one(b, client) for b in bots])
    return {"previews": results}


@router.get("/dca-bots/summary")
async def dca_summary(request: Request, hours: int = Query(24, ge=1, le=168)):
    """Rolling-window activity KPIs across all DCA bots in this session.
    Used by the dashboard summary strip. Session-scoped + auth-gated."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import session_dca_summary
    return session_dca_summary(session_id, hours)


@router.get("/dca-bots/recent-fills")
async def dca_recent_fills(request: Request, limit: int = Query(20, le=100)):
    """Cross-bot recent fills feed for the dashboard. Owner-only —
    session-scoped so a user can never see another session's fills."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import recent_dca_fills
    return {"fills": recent_dca_fills(session_id, limit)}


@router.get("/dca-bots/loop-health")
async def dca_loop_health(request: Request):
    """Owner-facing dca_loop heartbeat. No auth required — read-only and
    only exposes liveness, not user data. Useful during paper-mode
    dog-foot to confirm the loop is actually ticking when a newly
    activated bot has no fills yet."""
    from .dca_loop import loop_heartbeat
    return loop_heartbeat()


@router.get("/dca-bots/fills.csv")
async def dca_fills_csv(request: Request):
    """CSV export of every DCA fill in this session. Replaces the
    `ssh + sqlite3` workflow in the dog-foot manual — owners can pull
    their fills for offline analysis (Excel, pandas, etc.) directly
    from the dashboard.

    Format (UTF-8 BOM for Excel):
      filled_at_iso, bot_name, symbol, direction, order_num,
      kind, fill_price, fill_size_usdt, status, paper_mode

    Auth-gated, session-scoped. Streams in-memory since fill rows are
    small and typical sessions max out at hundreds of rows per week.
    """
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import recent_dca_fills
    # Pull a large window — 5000 is well above typical dog-foot week
    fills = recent_dca_fills(session_id, limit=5000)

    import csv
    import io
    from datetime import datetime, timezone
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerow([
        "filled_at_iso", "bot_name", "symbol", "direction",
        "order_num", "kind", "fill_price", "fill_size_usdt",
        "status", "paper_mode",
    ])
    # Oldest first reads more naturally in spreadsheets even though
    # the API returned newest-first. Reverse in Python is cheap here.
    for f in reversed(fills):
        ts = float(f.get("filled_at") or 0.0)
        iso = (
            datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
            if ts > 0 else ""
        )
        order_num = int(f.get("order_num", 0))
        kind = (
            "TP"
            if f.get("status") == "tp_closed"
            else ("BASE" if order_num == 0 else f"SAFETY_{order_num}")
        )
        writer.writerow([
            iso,
            f.get("bot_name", ""),
            f.get("symbol", ""),
            f.get("direction", ""),
            order_num,
            kind,
            f.get("fill_price", 0),
            f.get("fill_size_usdt", 0),
            f.get("status", ""),
            "1" if f.get("paper_mode", True) else "0",
        ])

    # UTF-8 BOM so Excel auto-detects the encoding
    body = "﻿" + buf.getvalue()
    filename = f"dca-fills-{int(time.time())}.csv"
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/dca-bots/{bot_id}")
async def dca_detail(bot_id: str, request: Request):
    """Bot detail + fills + computed avg entry + safety_orders_used."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import get_dca_bot_with_fills
    bot = get_dca_bot_with_fills(bot_id, session_id)
    if bot is None:
        raise HTTPException(404, "dca bot not found")
    return {"bot": bot}


@router.put("/dca-bots/{bot_id}")
async def dca_update(bot_id: str, request: Request):
    """Partial update. Refused if bot is active (would invalidate fills)."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import update_dca_bot
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "body must be a JSON object")
    try:
        bot = update_dca_bot(bot_id, session_id, body)
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(404, str(e))
        raise HTTPException(400, str(e))
    return {"bot": bot}


@router.delete("/dca-bots/{bot_id}")
async def dca_delete(bot_id: str, request: Request):
    """Delete bot + cascade fills. Refused if bot is active."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import delete_dca_bot
    try:
        ok = delete_dca_bot(bot_id, session_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not ok:
        raise HTTPException(404, "dca bot not found")
    return {"status": "deleted", "id": bot_id}


@router.post("/dca-bots/{bot_id}/activate")
async def dca_activate(bot_id: str, request: Request):
    """Activate — sets is_active=1. The dca_loop (separate module) picks
    this up on its next tick and places the base order.
    """
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import activate_dca_bot
    try:
        bot = activate_dca_bot(bot_id, session_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"bot": bot}


@router.post("/dca-bots/{bot_id}/deactivate")
async def dca_deactivate(bot_id: str, request: Request):
    """Deactivate — sets is_active=0. Existing fills are NOT auto-closed."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import deactivate_dca_bot
    try:
        bot = deactivate_dca_bot(bot_id, session_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"bot": bot}


@router.get("/dca-bots/{bot_id}/fills")
async def dca_fills(bot_id: str, request: Request):
    """List of fills for this bot — used by detail page + history charts."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import get_dca_bot, list_dca_fills
    if get_dca_bot(bot_id, session_id) is None:
        raise HTTPException(404, "dca bot not found")
    return {"fills": list_dca_fills(bot_id, session_id)}


@router.get("/dca-bots/{bot_id}/preview")
async def dca_preview(bot_id: str, request: Request):
    """Read-only live preview: pulls OKX public mark price for the bot's
    symbol and returns next-trigger / TP distance + would_fire_next.
    No DB writes, no orders. Safe to poll from the dashboard at 5–10 s.
    """
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .dca_bots import get_dca_bot, compute_preview
    bot = get_dca_bot(bot_id, session_id)
    if bot is None:
        raise HTTPException(404, "dca bot not found")

    # Pull mark price from OKX public market endpoint (no auth needed).
    # Convert PRUVIQ symbol to OKX-SWAP format if needed.
    raw_symbol = str(bot["symbol"]).upper()
    if "-" in raw_symbol:
        okx_sym = raw_symbol
    elif raw_symbol.endswith("USDT"):
        okx_sym = raw_symbol[:-4] + "-USDT-SWAP"
    else:
        okx_sym = raw_symbol

    import httpx
    from .config import OKX_BASE_URL
    mark_price = 0.0
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"{OKX_BASE_URL}/api/v5/market/ticker",
                params={"instId": okx_sym},
            )
            if resp.status_code == 200:
                body = resp.json()
                if body.get("code") == "0" and body.get("data"):
                    mark_price = float(body["data"][0].get("last") or 0.0)
    except Exception as e:
        logger.warning("dca preview ticker fetch failed: %s", e)

    if mark_price <= 0:
        return {
            "bot_id": bot_id,
            "symbol_resolved": okx_sym,
            "error": "could not fetch mark price",
        }

    from .dca_bots import list_dca_fills
    fills = list_dca_fills(bot_id, session_id)
    open_fills = [f for f in fills if f["status"] == "open"]
    preview = compute_preview(bot, mark_price, open_fills)
    return {
        "bot_id": bot_id,
        "symbol_resolved": okx_sym,
        "preview": preview,
    }


@router.get("/dca-bots/{bot_id}/parity")
async def dca_parity(bot_id: str, request: Request):
    """Day-7 parity check: how closely does this bot's paper-mode fills
    match what its own backtest would predict for the same window?

    Window: bot.created_at → now (or → last fill if more recent). For
    bots active < 2h we return early since the window has too few
    candles for a stable comparison.

    Returns side-by-side counts + a `pass` flag per the dog-foot
    manual's acceptance criteria:
      - fills count: diff ≤ 10%
      - avg entry: diff ≤ 1%
      - TP cycles: diff ≤ 1 absolute

    Auth-gated, session-scoped. Rate-limit shared with /simulate
    since both walk the full candle window.
    """
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    now_ts = time.time()
    last_sim = _simulate_rate_limit.get(session_id, 0)
    if now_ts - last_sim < SIMULATE_RATE_LIMIT_SECONDS:
        wait = int(SIMULATE_RATE_LIMIT_SECONDS - (now_ts - last_sim))
        raise HTTPException(429, f"parity rate limit: wait {wait}s")
    _simulate_rate_limit[session_id] = now_ts

    from .dca_bots import get_dca_bot, list_dca_fills, DEFAULT_DCA
    bot = get_dca_bot(bot_id, session_id)
    if bot is None:
        raise HTTPException(404, "dca bot not found")

    fills = list_dca_fills(bot_id, session_id)
    if not fills:
        return {
            "bot_id": bot_id,
            "skipped": "no_paper_fills_yet",
            "hint": "wait for the loop to write at least a base fill",
        }

    # Window: bot creation → now
    created_at = float(bot.get("created_at", now_ts))
    if now_ts - created_at < 2 * 3600:
        return {
            "bot_id": bot_id,
            "skipped": "window_too_short",
            "hours_elapsed": (now_ts - created_at) / 3600.0,
            "hint": "parity needs ≥ 2h of activity for stable comparison",
        }

    # Resolve symbol to DataManager naming (strip -SWAP / -USDT suffix)
    raw = str(bot["symbol"]).upper()
    if raw.endswith("-USDT-SWAP"):
        dm_symbol = raw.replace("-USDT-SWAP", "USDT")
    elif raw.endswith("-USDT"):
        dm_symbol = raw.replace("-USDT", "USDT")
    else:
        dm_symbol = raw

    from api.data_manager import DataManager
    dm = DataManager()
    df = dm.get_df(dm_symbol)
    if df is None or len(df) == 0:
        raise HTTPException(404, f"no candles for symbol={dm_symbol}")

    # Slice window: bot activation → now (use ISO8601 from timestamps)
    from datetime import datetime, timezone
    start_iso = datetime.fromtimestamp(created_at, tz=timezone.utc).isoformat()
    sliced = df[df["timestamp"] >= start_iso]
    if len(sliced) < 2:
        return {
            "bot_id": bot_id,
            "skipped": "candles_not_yet_indexed",
            "hint": "data pipeline hasn't ingested candles for this window yet",
        }

    # Run backtest with bot's exact params — loop over multiple cycles
    # simulate_dca models a single DCA cycle (breaks on first TP). To get
    # an apples-to-apples comparison with paper mode (which accumulates N
    # cycles over the window), we restart the simulation after each TP.
    merged = {**DEFAULT_DCA, **{k: bot[k] for k in DEFAULT_DCA if k in bot}}
    from .dca_backtest import simulate_dca

    bt_tp_closed = 0
    bt_fills_count = 0
    bt_avg_entries: list[tuple[float, float]] = []  # (avg_price, total_size)
    remaining = sliced.reset_index(drop=True)

    while len(remaining) >= 2:
        sim = simulate_dca(merged, remaining)
        sim_dict = sim.to_dict()
        bt_fills_count += len(sim_dict.get("fills", []))
        avg_p = float(sim_dict.get("avg_entry_price") or 0.0)
        total_s = float(sim_dict.get("total_size_usdt") or 0.0)
        if avg_p > 0:
            bt_avg_entries.append((avg_p, total_s))

        if sim_dict.get("exit_reason") != "tp":
            break
        bt_tp_closed += 1

        # Advance past the TP candle and restart
        exit_iso = sim_dict.get("exit_time_iso", "")
        if not exit_iso:
            break
        remaining = remaining[remaining["timestamp"] > exit_iso].reset_index(drop=True)

    # Weighted average entry across all cycles
    bt_avg = 0.0
    total_bt_size = sum(s for _, s in bt_avg_entries)
    if total_bt_size > 0:
        bt_avg = sum(p * s for p, s in bt_avg_entries) / total_bt_size

    # Paper side
    paper_total_size = sum(f["fill_size_usdt"] for f in fills)
    paper_avg = (
        sum(f["fill_price"] * f["fill_size_usdt"] for f in fills)
        / paper_total_size
        if paper_total_size > 0
        else 0.0
    )
    paper_tp_closed = sum(1 for f in fills if f["status"] == "tp_closed")
    paper_fills_count = len(fills)

    # Deltas per dog-foot manual
    def _pct_diff(a: float, b: float) -> float:
        if a == 0 and b == 0:
            return 0.0
        denom = max(abs(a), abs(b), 1e-9)
        return abs(a - b) / denom * 100.0

    fills_diff_pct = _pct_diff(paper_fills_count, bt_fills_count)
    avg_diff_pct = _pct_diff(paper_avg, bt_avg)
    tp_abs_diff = abs(paper_tp_closed - bt_tp_closed)

    pass_fills = fills_diff_pct <= 10.0
    pass_avg = avg_diff_pct <= 1.0
    pass_tp = tp_abs_diff <= 1
    overall_pass = pass_fills and pass_avg and pass_tp

    return {
        "bot_id": bot_id,
        "window": {
            "start_iso": start_iso,
            "hours_elapsed": (now_ts - created_at) / 3600.0,
            "candle_count": int(len(sliced)),
        },
        "paper": {
            "fills_count": paper_fills_count,
            "avg_entry_price": paper_avg,
            "tp_cycles": paper_tp_closed,
        },
        "backtest": {
            "fills_count": bt_fills_count,
            "avg_entry_price": bt_avg,
            "tp_cycles": bt_tp_closed,
        },
        "deltas": {
            "fills_diff_pct": fills_diff_pct,
            "avg_diff_pct": avg_diff_pct,
            "tp_abs_diff": tp_abs_diff,
        },
        "pass": {
            "fills": pass_fills,
            "avg_entry": pass_avg,
            "tp_cycles": pass_tp,
            "overall": overall_pass,
        },
    }


@router.post("/dca-bots/simulate")
async def dca_simulate(request: Request):
    """Backtest DCA params on historical OHLCV. No DB writes, no orders.
    Body: {params: dict, symbol: "BTCUSDT", start?: "ISO8601", end?: "ISO8601",
           taker_fee_pct?: 0.05}
    Symbol uses the DataManager naming (no -USDT-SWAP suffix). Defaults
    to the full available candle window if start/end omitted.
    Auth is required to keep the endpoint behind the cookie wall, but
    the call hits no per-session state.

    Rate-limited the same as /grid-bots/simulate (5s/session) — backtest
    walks the full candle window so concurrent calls peg the worker.
    """
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    now_ts = time.time()
    last_sim = _simulate_rate_limit.get(session_id, 0)
    if now_ts - last_sim < SIMULATE_RATE_LIMIT_SECONDS:
        wait = int(SIMULATE_RATE_LIMIT_SECONDS - (now_ts - last_sim))
        raise HTTPException(429, f"simulate rate limit: wait {wait}s")
    _simulate_rate_limit[session_id] = now_ts
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "body must be a JSON object")
    params = body.get("params") or {}
    if not isinstance(params, dict):
        raise HTTPException(400, "params must be an object")
    symbol = (body.get("symbol") or "").upper()
    if not symbol:
        raise HTTPException(400, "symbol required (e.g. BTCUSDT)")
    start = body.get("start")
    end = body.get("end")
    raw_fee = body.get("taker_fee_pct")
    taker_fee_pct = float(raw_fee) if raw_fee is not None else 0.05

    # Validate params against the same bounds as create_dca_bot
    from .dca_bots import validate_dca_params, DEFAULT_DCA
    merged = {**DEFAULT_DCA, **params}
    errs = validate_dca_params(merged)
    if errs:
        raise HTTPException(400, "; ".join(errs))

    # Pull candles
    from api.data_manager import DataManager
    dm = DataManager()
    df = dm.get_df(symbol)
    if df is None or len(df) == 0:
        raise HTTPException(404, f"no candles for symbol={symbol}")

    # Slice by date window if requested
    sliced = df
    if start:
        sliced = sliced[sliced["timestamp"] >= start]
    if end:
        sliced = sliced[sliced["timestamp"] <= end]
    if len(sliced) < 2:
        raise HTTPException(
            400,
            f"window has only {len(sliced)} candle(s) — need at least 2",
        )

    from .dca_backtest import simulate_dca
    res = simulate_dca(merged, sliced, taker_fee_pct=taker_fee_pct)
    return {"result": res.to_dict(), "candle_count": int(len(sliced))}


# ── Grid bots — third paradigm (range-bound limit-order grid) ──────────────

@router.post("/grid-bots")
async def grid_create(request: Request):
    """Create a grid bot for this session (starts inactive)."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .grid_bots import create_grid_bot
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "body must be a JSON object")
    try:
        bot = create_grid_bot(session_id, body)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"bot": bot}


@router.get("/grid-bots")
async def grid_list(request: Request):
    """List all grid bots owned by this session."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .grid_bots import list_grid_bots
    return {"bots": list_grid_bots(session_id)}


@router.get("/grid-bots/{bot_id}")
async def grid_detail(bot_id: str, request: Request):
    """Bot detail + orders + computed grid_lines + per_grid_size_usdt."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .grid_bots import get_grid_bot_with_orders
    bot = get_grid_bot_with_orders(bot_id, session_id)
    if bot is None:
        raise HTTPException(404, "grid bot not found")
    return {"bot": bot}


@router.put("/grid-bots/{bot_id}")
async def grid_update(bot_id: str, request: Request):
    """Partial update. Refused if bot is active."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .grid_bots import update_grid_bot
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "body must be a JSON object")
    try:
        bot = update_grid_bot(bot_id, session_id, body)
    except ValueError as e:
        if "not found" in str(e):
            raise HTTPException(404, str(e))
        raise HTTPException(400, str(e))
    return {"bot": bot}


@router.delete("/grid-bots/{bot_id}")
async def grid_delete(bot_id: str, request: Request):
    """Delete bot + cascade orders. Refused if bot is active."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .grid_bots import delete_grid_bot
    try:
        ok = delete_grid_bot(bot_id, session_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not ok:
        raise HTTPException(404, "grid bot not found")
    return {"status": "deleted", "id": bot_id}


@router.post("/grid-bots/{bot_id}/activate")
async def grid_activate(bot_id: str, request: Request):
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .grid_bots import activate_grid_bot
    try:
        bot = activate_grid_bot(bot_id, session_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"bot": bot}


@router.post("/grid-bots/{bot_id}/deactivate")
async def grid_deactivate(bot_id: str, request: Request):
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .grid_bots import deactivate_grid_bot
    try:
        bot = deactivate_grid_bot(bot_id, session_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"bot": bot}


@router.get("/grid-bots/{bot_id}/orders")
async def grid_orders_list(bot_id: str, request: Request):
    """All limit orders placed by this grid bot, newest first."""
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")
    from .grid_bots import get_grid_bot, list_grid_orders
    if get_grid_bot(bot_id, session_id) is None:
        raise HTTPException(404, "grid bot not found")
    return {"orders": list_grid_orders(bot_id, session_id)}


@router.post("/grid-bots/simulate")
async def grid_simulate(request: Request):
    """Backtest Grid params on historical OHLCV. No DB writes, no orders.
    Body: {params, symbol, start?, end?, taker_fee_pct?}
    Sim is pair-based ("approx" accuracy) — within ±10% of executor reality
    for healthy grids. Response field `accuracy: "approx"` is explicit.
    """
    session_id = _get_session(request)
    if not is_authenticated(session_id):
        raise HTTPException(401, "Not connected to OKX.")

    # Rate limit: 5 seconds between simulate calls per session
    now = time.time()
    last_sim = _simulate_rate_limit.get(session_id, 0)
    if now - last_sim < SIMULATE_RATE_LIMIT_SECONDS:
        wait = int(SIMULATE_RATE_LIMIT_SECONDS - (now - last_sim))
        raise HTTPException(429, f"Rate limit: wait {wait}s before next simulate")
    _simulate_rate_limit[session_id] = now

    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(400, "body must be a JSON object")
    params = body.get("params") or {}
    if not isinstance(params, dict):
        raise HTTPException(400, "params must be an object")
    symbol = (body.get("symbol") or "").upper()
    if not symbol:
        raise HTTPException(400, "symbol required (e.g. BTCUSDT)")
    start = body.get("start")
    end = body.get("end")
    raw_fee = body.get("taker_fee_pct")
    taker_fee_pct = float(raw_fee) if raw_fee is not None else 0.05

    from .grid_bots import validate_grid_params, DEFAULT_GRID
    merged = {**DEFAULT_GRID, **params}
    errs = validate_grid_params(merged)
    if errs:
        raise HTTPException(400, "; ".join(errs))

    from api.data_manager import DataManager
    dm = DataManager()
    df = dm.get_df(symbol)
    if df is None or len(df) == 0:
        raise HTTPException(404, f"no candles for symbol={symbol}")
    sliced = df
    if start:
        sliced = sliced[sliced["timestamp"] >= start]
    if end:
        sliced = sliced[sliced["timestamp"] <= end]
    if len(sliced) < 2:
        raise HTTPException(
            400,
            f"window has only {len(sliced)} candle(s) — need at least 2",
        )

    from .grid_backtest import simulate_grid
    res = simulate_grid(merged, sliced, taker_fee_pct=taker_fee_pct)
    return {"result": res.to_dict(), "candle_count": int(len(sliced))}


# ── Admin: session overview ─────────────────────────────────

@router.get("/admin/sessions")
async def admin_sessions(request: Request):
    """
    Connected user count. Requires X-Admin-Key header.

    Returns total OAuth sessions in DB and the most recent connect timestamp.
    """
    if not ADMIN_KEY:
        raise HTTPException(503, "Admin endpoint disabled (ADMIN_API_KEY unset)")

    import hmac
    provided = request.headers.get("x-admin-key", "")
    if not provided or not hmac.compare_digest(provided, ADMIN_KEY):
        raise HTTPException(403, "Invalid admin key")

    from .storage import count_sessions
    return count_sessions()


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
        # CodeQL py/stack-trace-exposure: previously the exception message
        # was surfaced directly in the HTTP 500 body. Endpoint is
        # admin-only so the immediate risk is low, but leaking exception
        # type + internal path would still help an attacker who'd
        # compromised the admin key. Log full detail server-side, return
        # generic message — operator checks journalctl for root cause.
        logger.error(
            "admin_halt execute_halt failed: %s: %s",
            e.__class__.__name__, e,
        )
        raise HTTPException(500, "halt execution failed — see server logs")

    return {"status": "halted", "message": message}
