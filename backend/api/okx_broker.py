"""
OKX FD OAuth Broker Module for PRUVIQ

Handles OAuth2 flow, token management, and trade execution via OKX Broker API.
All secrets sourced from environment variables — NEVER hardcoded.

Security:
    - Fernet encryption for tokens at rest (SQLite)
    - CSRF protection via cryptographic state parameter
    - httpOnly cookie for session tracking
    - IP validation on OAuth callback
    - Safe error messages (no secret leakage)

OKX Broker: FD OAuth Broker, Level 2
"""

import logging
import os
import secrets
import sqlite3
import time
from pathlib import Path
from typing import Optional

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

logger = logging.getLogger("pruviq.okx")

# ---------------------------------------------------------------------------
# Configuration — all from environment
# ---------------------------------------------------------------------------
OKX_BASE = "https://www.okx.com"
CLIENT_ID = os.getenv("OKX_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("OKX_CLIENT_SECRET", "")
BROKER_CODE = os.getenv("OKX_BROKER_CODE", "c12571e26a02OCDE")
REDIRECT_URI = os.getenv(
    "OKX_REDIRECT_URI", "https://api.pruviq.com/api/auth/okx/callback"
)
ENCRYPTION_KEY = os.getenv("OKX_ENCRYPTION_KEY", "")
FRONTEND_URL = os.getenv("OKX_FRONTEND_URL", "https://pruviq.com")

# Validate critical config at import time (log, don't crash)
if not CLIENT_ID:
    logger.warning("OKX_CLIENT_ID not set — OKX endpoints will fail")
if not CLIENT_SECRET:
    logger.warning("OKX_CLIENT_SECRET not set — OKX endpoints will fail")
if not ENCRYPTION_KEY:
    logger.warning("OKX_ENCRYPTION_KEY not set — token encryption disabled")


# ---------------------------------------------------------------------------
# Fernet cipher (lazy — only if key is configured)
# ---------------------------------------------------------------------------
_fernet: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    """Return a Fernet cipher instance, raising if key is missing."""
    global _fernet
    if _fernet is not None:
        return _fernet
    if not ENCRYPTION_KEY:
        raise RuntimeError("OKX_ENCRYPTION_KEY is not configured")
    _fernet = Fernet(ENCRYPTION_KEY.encode())
    return _fernet


def _encrypt(plaintext: str) -> str:
    """Encrypt a string value for storage."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def _decrypt(ciphertext: str) -> str:
    """Decrypt a stored value. Raises ValueError on failure."""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Token decryption failed — key may have rotated") from exc


# ---------------------------------------------------------------------------
# SQLite session storage
# ---------------------------------------------------------------------------
DB_PATH = Path(__file__).resolve().parent.parent / "data" / "okx_sessions.db"


def _get_db() -> sqlite3.Connection:
    """Open (or create) the sessions database and return a connection."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS okx_sessions (
            session_id   TEXT PRIMARY KEY,
            access_token TEXT NOT NULL,
            refresh_token TEXT NOT NULL,
            expires_at   REAL NOT NULL,
            created_at   REAL NOT NULL,
            ip           TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


# In-memory CSRF state store: state_value → (created_at, client_ip)
# Entries expire after 10 minutes.
_csrf_states: dict[str, tuple[float, str]] = {}
_CSRF_TTL = 600  # 10 minutes


def _prune_csrf_states() -> None:
    """Remove expired CSRF state entries."""
    now = time.time()
    expired = [k for k, (ts, _) in _csrf_states.items() if now - ts > _CSRF_TTL]
    for k in expired:
        del _csrf_states[k]


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class ExecuteOrderRequest(BaseModel):
    """Request body for placing an order via OKX."""

    inst_id: str = Field(..., description="Instrument ID, e.g. BTC-USDT-SWAP")
    td_mode: str = Field(
        "cross", description="Trade mode: cross, isolated, cash"
    )
    side: str = Field(..., description="buy or sell")
    ord_type: str = Field("market", description="market, limit, post_only, etc.")
    sz: str = Field(..., description="Size/quantity as string")
    px: Optional[str] = Field(None, description="Price (required for limit)")
    sl_trigger_px: Optional[str] = Field(None, description="Stop-loss trigger price")
    sl_ord_px: Optional[str] = Field(None, description="Stop-loss order price (-1 for market)")
    tp_trigger_px: Optional[str] = Field(None, description="Take-profit trigger price")
    tp_ord_px: Optional[str] = Field(None, description="Take-profit order price (-1 for market)")
    reduce_only: bool = Field(False, description="Reduce-only flag")


class AlgoOrderRequest(BaseModel):
    """Request body for SL/TP algo order."""

    inst_id: str = Field(..., description="Instrument ID")
    td_mode: str = Field("cross", description="Trade mode")
    side: str = Field(..., description="buy or sell")
    sz: str = Field(..., description="Size/quantity as string")
    ord_type: str = Field(
        "conditional", description="conditional, oco, trigger, etc."
    )
    sl_trigger_px: Optional[str] = None
    sl_ord_px: Optional[str] = None
    tp_trigger_px: Optional[str] = None
    tp_ord_px: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_client_ip(request: Request) -> str:
    """Extract client IP from request, respecting CF-Connecting-IP."""
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_session_id(request: Request) -> Optional[str]:
    """Extract session_id from httpOnly cookie."""
    return request.cookies.get("okx_session_id")


def _require_session(request: Request) -> dict:
    """
    Load and validate session from cookie.
    Returns the session row as a dict.
    Raises HTTPException 401 if invalid/missing/expired.
    """
    session_id = _get_session_id(request)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not connected to OKX")

    db = _get_db()
    try:
        row = db.execute(
            "SELECT * FROM okx_sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
    finally:
        db.close()

    if not row:
        raise HTTPException(status_code=401, detail="Session not found")

    return dict(row)


async def _okx_api_request(
    method: str,
    path: str,
    access_token: str,
    json_body: Optional[dict] = None,
) -> dict:
    """
    Make an authenticated request to OKX API on behalf of a user.

    Args:
        method: HTTP method (GET or POST)
        path: API path, e.g. /api/v5/trade/order
        access_token: Decrypted OAuth access token
        json_body: Optional JSON body for POST requests

    Returns:
        Parsed JSON response from OKX

    Raises:
        HTTPException on OKX errors
    """
    url = f"{OKX_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        if method.upper() == "GET":
            resp = await client.get(url, headers=headers)
        else:
            resp = await client.post(url, headers=headers, json=json_body or {})

    if resp.status_code != 200:
        logger.error("OKX API HTTP %d on %s", resp.status_code, path)
        raise HTTPException(
            status_code=502,
            detail="OKX API request failed",
        )

    data = resp.json()
    code = data.get("code", "0")

    if code != "0":
        return _handle_okx_error(code, data.get("msg", "Unknown error"), path)

    return data


def _handle_okx_error(code: str, msg: str, path: str) -> dict:
    """
    Handle OKX-specific error codes.

    Known codes:
        53000 — general broker error
        53001 — user canceled authorization
        53002 — access token expired (auto-refresh should catch this)
        53003 — invalid access token
        53004 — missing scope
        53005 — refresh token invalid/expired
        53006 — invalid authorization code
        53007 — redirect URI mismatch
        53008 — invalid client_id
        53009 — invalid client_secret
        53010 — rate limit exceeded
        53011-53017 — various broker/user errors

    Raises:
        HTTPException with a safe user-facing message
    """
    int_code = int(code) if code.isdigit() else 0
    logger.warning("OKX error %s on %s: %s", code, path, msg)

    if int_code == 53001:
        raise HTTPException(status_code=400, detail="OKX authorization was canceled")
    elif int_code == 53002:
        raise HTTPException(
            status_code=401,
            detail="OKX access token expired — please refresh or reconnect",
        )
    elif int_code == 53003:
        raise HTTPException(status_code=401, detail="Invalid OKX access token")
    elif int_code == 53005:
        raise HTTPException(
            status_code=401,
            detail="OKX refresh token invalid — please reconnect",
        )
    elif int_code == 53010:
        raise HTTPException(status_code=429, detail="OKX rate limit exceeded")
    elif 53000 <= int_code <= 53017:
        raise HTTPException(status_code=502, detail="OKX broker error")
    else:
        raise HTTPException(status_code=502, detail="OKX API error")


async def _refresh_access_token(session: dict) -> Optional[str]:
    """
    Attempt to refresh an expired access token.

    Args:
        session: dict with session_id, refresh_token (encrypted), etc.

    Returns:
        New decrypted access token on success, None on failure.
    """
    try:
        refresh_token = _decrypt(session["refresh_token"])
    except ValueError:
        logger.error("Cannot decrypt refresh_token for session %s", session["session_id"][:8])
        return None

    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{OKX_BASE}/api/v5/oauth/token", json=payload
        )

    if resp.status_code != 200:
        logger.error("OKX token refresh HTTP %d", resp.status_code)
        return None

    data = resp.json()
    if data.get("code", "0") != "0":
        int_code = int(data.get("code", "0")) if data.get("code", "0").isdigit() else 0
        if int_code == 53005:
            # Refresh token is dead — delete session
            logger.warning("Refresh token invalid for session %s — deleting", session["session_id"][:8])
            db = _get_db()
            try:
                db.execute("DELETE FROM okx_sessions WHERE session_id = ?", (session["session_id"],))
                db.commit()
            finally:
                db.close()
        return None

    new_access = data.get("data", {}).get("access_token") or data.get("access_token")
    new_refresh = data.get("data", {}).get("refresh_token") or data.get("refresh_token")
    expires_in = int(data.get("data", {}).get("expires_in", data.get("expires_in", 3600)))

    if not new_access:
        logger.error("No access_token in refresh response")
        return None

    # Update DB
    db = _get_db()
    try:
        update_fields = {
            "access_token": _encrypt(new_access),
            "expires_at": time.time() + expires_in,
        }
        if new_refresh:
            update_fields["refresh_token"] = _encrypt(new_refresh)

        set_clause = ", ".join(f"{k} = ?" for k in update_fields)
        values = list(update_fields.values()) + [session["session_id"]]
        db.execute(
            f"UPDATE okx_sessions SET {set_clause} WHERE session_id = ?",
            values,
        )
        db.commit()
    finally:
        db.close()

    logger.info("Refreshed access token for session %s", session["session_id"][:8])
    return new_access


async def _get_valid_access_token(session: dict) -> str:
    """
    Get a valid (non-expired) access token for the session.
    Auto-refreshes if expired.

    Raises HTTPException 401 if refresh fails.
    """
    now = time.time()

    # If token is not expired (with 60s buffer), decrypt and return
    if session["expires_at"] > now + 60:
        try:
            return _decrypt(session["access_token"])
        except ValueError:
            raise HTTPException(status_code=500, detail="Token decryption error")

    # Token expired — try refresh
    new_token = await _refresh_access_token(session)
    if not new_token:
        raise HTTPException(
            status_code=401,
            detail="OKX session expired — please reconnect",
        )
    return new_token


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------
router = APIRouter(prefix="/api", tags=["okx-broker"])


# ======================== OAuth Flow ========================


@router.get("/auth/okx/start")
async def auth_okx_start(request: Request) -> dict:
    """
    Start the OKX OAuth flow.

    Generates a CSRF state token, stores it in memory, and returns
    the authorization URL the frontend should redirect the user to.
    """
    if not CLIENT_ID:
        raise HTTPException(status_code=503, detail="OKX integration not configured")

    _prune_csrf_states()

    state = secrets.token_urlsafe(32)
    client_ip = _get_client_ip(request)
    _csrf_states[state] = (time.time(), client_ip)

    auth_url = (
        f"{OKX_BASE}/api/v5/oauth/authorize"
        f"?response_type=code"
        f"&client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&scope=read_only,trade"
        f"&state={state}"
    )

    return {"url": auth_url}


@router.get("/auth/okx/callback")
async def auth_okx_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
) -> RedirectResponse:
    """
    OKX OAuth callback endpoint.

    Validates CSRF state, exchanges authorization code for tokens,
    encrypts and stores them, and redirects to frontend with a session cookie.
    """
    # Handle user cancellation or OKX error
    if error:
        logger.info("OKX OAuth error: %s", error)
        return RedirectResponse(
            url=f"{FRONTEND_URL}/connect?error=canceled", status_code=302
        )

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state parameter")

    # CSRF validation
    _prune_csrf_states()
    csrf_entry = _csrf_states.pop(state, None)
    if not csrf_entry:
        raise HTTPException(status_code=403, detail="Invalid or expired state token")

    csrf_ts, csrf_ip = csrf_entry
    client_ip = _get_client_ip(request)

    if csrf_ip != client_ip:
        logger.warning(
            "IP mismatch on OAuth callback: expected %s, got %s",
            csrf_ip,
            client_ip,
        )
        raise HTTPException(status_code=403, detail="IP address mismatch")

    # Exchange code for tokens
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(f"{OKX_BASE}/api/v5/oauth/token", json=payload)

    if resp.status_code != 200:
        logger.error("OKX token exchange HTTP %d", resp.status_code)
        return RedirectResponse(
            url=f"{FRONTEND_URL}/connect?error=exchange_failed", status_code=302
        )

    data = resp.json()
    if data.get("code", "0") != "0":
        okx_code = data.get("code", "unknown")
        logger.warning("OKX token exchange error: %s — %s", okx_code, data.get("msg"))

        if okx_code == "53006":
            error_label = "invalid_code"
        elif okx_code == "53001":
            error_label = "canceled"
        else:
            error_label = "exchange_failed"

        return RedirectResponse(
            url=f"{FRONTEND_URL}/connect?error={error_label}", status_code=302
        )

    # Parse tokens from response
    token_data = data.get("data", data)
    if isinstance(token_data, list) and len(token_data) > 0:
        token_data = token_data[0]

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = int(token_data.get("expires_in", 3600))

    if not access_token or not refresh_token:
        logger.error("Missing tokens in OKX response")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/connect?error=no_tokens", status_code=302
        )

    # Store encrypted session
    session_id = secrets.token_urlsafe(32)

    db = _get_db()
    try:
        db.execute(
            """
            INSERT INTO okx_sessions
                (session_id, access_token, refresh_token, expires_at, created_at, ip)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                _encrypt(access_token),
                _encrypt(refresh_token),
                time.time() + expires_in,
                time.time(),
                client_ip,
            ),
        )
        db.commit()
    finally:
        db.close()

    logger.info("OKX session created for IP %s", client_ip)

    # Redirect to frontend with session cookie
    redirect = RedirectResponse(
        url=f"{FRONTEND_URL}/connect?success=true", status_code=302
    )
    redirect.set_cookie(
        key="okx_session_id",
        value=session_id,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=90 * 24 * 3600,  # 90 days
        path="/",
        domain=".pruviq.com",
    )
    return redirect


@router.get("/auth/okx/status")
async def auth_okx_status(request: Request) -> dict:
    """
    Check OKX connection status.

    Returns:
        connected: bool
        expires_at: float (unix ts) if connected
    """
    session_id = _get_session_id(request)
    if not session_id:
        return {"connected": False}

    db = _get_db()
    try:
        row = db.execute(
            "SELECT expires_at, created_at FROM okx_sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
    finally:
        db.close()

    if not row:
        return {"connected": False}

    return {
        "connected": True,
        "expires_at": row["expires_at"],
        "created_at": row["created_at"],
        "token_valid": row["expires_at"] > time.time(),
    }


@router.post("/auth/okx/refresh")
async def auth_okx_refresh(request: Request) -> dict:
    """
    Manually refresh the OKX access token.

    Returns new expiration time on success.
    """
    session = _require_session(request)
    new_token = await _refresh_access_token(session)

    if not new_token:
        raise HTTPException(
            status_code=401,
            detail="Token refresh failed — please reconnect",
        )

    # Re-read session to get updated expires_at
    db = _get_db()
    try:
        row = db.execute(
            "SELECT expires_at FROM okx_sessions WHERE session_id = ?",
            (session["session_id"],),
        ).fetchone()
    finally:
        db.close()

    return {
        "refreshed": True,
        "expires_at": row["expires_at"] if row else None,
    }


@router.post("/auth/okx/disconnect")
async def auth_okx_disconnect(request: Request, response: Response) -> dict:
    """
    Disconnect OKX account by deleting the session and clearing the cookie.
    """
    session_id = _get_session_id(request)
    if not session_id:
        return {"disconnected": True}

    db = _get_db()
    try:
        db.execute("DELETE FROM okx_sessions WHERE session_id = ?", (session_id,))
        db.commit()
    finally:
        db.close()

    response.delete_cookie(
        key="okx_session_id",
        path="/",
        domain=".pruviq.com",
    )
    logger.info("OKX session disconnected: %s", session_id[:8])
    return {"disconnected": True}


# ======================== Trade Execution ========================


@router.post("/okx/execute")
async def okx_execute_order(request: Request, body: ExecuteOrderRequest) -> dict:
    """
    Place an order on OKX via the user's OAuth token.

    The broker tag is ALWAYS included in every order for attribution.
    Supports market and limit orders with optional inline SL/TP.
    """
    session = _require_session(request)
    access_token = await _get_valid_access_token(session)

    order_body: dict = {
        "instId": body.inst_id,
        "tdMode": body.td_mode,
        "side": body.side,
        "ordType": body.ord_type,
        "sz": body.sz,
        "tag": BROKER_CODE,  # CRITICAL: broker attribution
    }

    if body.px:
        order_body["px"] = body.px
    if body.reduce_only:
        order_body["reduceOnly"] = True

    # Inline SL/TP (OKX v5 supports these on the main order endpoint)
    if body.sl_trigger_px:
        order_body["slTriggerPx"] = body.sl_trigger_px
        order_body["slOrdPx"] = body.sl_ord_px or "-1"
    if body.tp_trigger_px:
        order_body["tpTriggerPx"] = body.tp_trigger_px
        order_body["tpOrdPx"] = body.tp_ord_px or "-1"

    data = await _okx_api_request(
        "POST", "/api/v5/trade/order", access_token, order_body
    )

    return {
        "success": True,
        "data": data.get("data", []),
    }


@router.post("/okx/execute-algo")
async def okx_execute_algo_order(
    request: Request, body: AlgoOrderRequest
) -> dict:
    """
    Place an SL/TP algo order on OKX.

    Used for conditional/OCO orders that are separate from the main order.
    Broker tag is included for attribution.
    """
    session = _require_session(request)
    access_token = await _get_valid_access_token(session)

    algo_body: dict = {
        "instId": body.inst_id,
        "tdMode": body.td_mode,
        "side": body.side,
        "sz": body.sz,
        "ordType": body.ord_type,
        "tag": BROKER_CODE,
    }

    if body.sl_trigger_px:
        algo_body["slTriggerPx"] = body.sl_trigger_px
        algo_body["slOrdPx"] = body.sl_ord_px or "-1"
    if body.tp_trigger_px:
        algo_body["tpTriggerPx"] = body.tp_trigger_px
        algo_body["tpOrdPx"] = body.tp_ord_px or "-1"

    data = await _okx_api_request(
        "POST", "/api/v5/trade/order-algo", access_token, algo_body
    )

    return {
        "success": True,
        "data": data.get("data", []),
    }


@router.get("/okx/positions")
async def okx_get_positions(request: Request) -> dict:
    """Get the user's current positions on OKX."""
    session = _require_session(request)
    access_token = await _get_valid_access_token(session)

    data = await _okx_api_request(
        "GET", "/api/v5/account/positions", access_token
    )

    return {
        "success": True,
        "data": data.get("data", []),
    }


@router.get("/okx/orders")
async def okx_get_orders(
    request: Request,
    inst_type: str = "SWAP",
    limit: int = 20,
) -> dict:
    """
    Get the user's recent orders on OKX.

    Args:
        inst_type: SWAP, FUTURES, SPOT, etc.
        limit: Max number of orders to return (max 100).
    """
    session = _require_session(request)
    access_token = await _get_valid_access_token(session)

    # Clamp limit
    limit = min(max(1, limit), 100)

    data = await _okx_api_request(
        "GET",
        f"/api/v5/trade/orders-history?instType={inst_type}&limit={limit}",
        access_token,
    )

    return {
        "success": True,
        "data": data.get("data", []),
    }
