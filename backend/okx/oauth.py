"""
OKX OAuth 2.0 flow for FD Broker (Authorization Code mode).

Flow:
  1. generate_auth_url()  → user → OKX login page
  2. exchange_code(code)  → authorization code → encrypted tokens
  3. get_valid_token(sid)  → valid access_token (auto-refresh)
  4. disconnect(sid)       → delete session
"""
from __future__ import annotations

import asyncio
import logging
import secrets
import time
from urllib.parse import urlencode

import httpx

# Per-session lock to prevent concurrent token refresh (race condition)
_refresh_locks: dict[str, asyncio.Lock] = {}

from .config import (
    OKX_CLIENT_ID,
    OKX_CLIENT_SECRET,
    OKX_OAUTH_AUTHORIZE,
    OKX_OAUTH_TOKEN,
    OKX_REDIRECT_URI,
)
from .storage import (
    delete_session,
    get_session,
    save_csrf_state,
    save_session,
    update_session,
    validate_csrf_state,
)

logger = logging.getLogger("okx_oauth")


def generate_auth_url(redirect_after: str = "", lang: str = "en") -> str:
    """
    Generate OKX OAuth authorization URL.
    Stores CSRF state token for validation on callback.
    """
    state = secrets.token_urlsafe(32)
    save_csrf_state(state, redirect_after or "", lang)

    params = {
        "client_id": OKX_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": OKX_REDIRECT_URI,
        "scope": "read_only,trade",
        "state": state,
    }
    return f"{OKX_OAUTH_AUTHORIZE}?{urlencode(params)}"


def generate_oauth_params(redirect_after: str = "", lang: str = "en") -> dict:
    """
    Generate OAuth params for frontend JS SDK call.
    Saves CSRF state to DB, returns params dict for OKEXOAuthSDK.authorize().
    client_id is not a secret — safe to return to frontend.
    """
    state = secrets.token_urlsafe(32)
    save_csrf_state(state, redirect_after or "", lang)
    return {
        "state": state,
        "client_id": OKX_CLIENT_ID,
        "response_type": "code",
        "access_type": "offline",
        "scope": "read_only,trade",
        "redirect_uri": OKX_REDIRECT_URI,
    }


async def exchange_code(code: str, state: str, domain: str = "") -> tuple[str, str, str]:  # domain param kept for router compat
    """
    Exchange authorization code for access + refresh tokens.
    Validates CSRF state, stores encrypted tokens in SQLite.
    Returns (session_id, redirect_url, lang).
    """
    csrf_result = validate_csrf_state(state)
    if csrf_result is None:
        raise ValueError("Invalid or expired CSRF state")
    redirect_url, lang = csrf_result

    # Standard FD Broker OAuth token exchange (RFC 6749)
    data = {
        "client_id": OKX_CLIENT_ID,
        "client_secret": OKX_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": OKX_REDIRECT_URI,
    }

    logger.warning("→ OKX token request url=%s", OKX_OAUTH_TOKEN)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            OKX_OAUTH_TOKEN,
            data=data,  # RFC 6749: application/x-www-form-urlencoded
            timeout=15,
        )
        logger.warning("OKX token → status=%s body=%s", resp.status_code, resp.text[:300])
        resp.raise_for_status()
        token_data = resp.json()

    if "access_token" not in token_data:
        raise ValueError(f"OKX token error: {token_data}")

    tokens = {
        "access_token": token_data["access_token"],
        "refresh_token": token_data["refresh_token"],
        "expires_at": time.time() + token_data.get("expires_in", 3600),
        "scope": token_data.get("scope", ""),
    }

    # ── Stable session_id: tied to OKX account UID ──────────────────
    # Critical: session_id must not change on re-authentication.
    # Random token (old approach) caused all strategies/settings to be
    # lost every time the user reconnected OKX after cookie expiry.
    session_id = secrets.token_urlsafe(32)  # fallback if UID fetch fails
    try:
        from .client import OKXClient
        async with OKXClient(tokens["access_token"]) as client:
            uid = await client.get_user_uid()
            session_id = f"okx_{uid}"
            logger.info("UID-based session: okx_%s", uid[:6])
    except Exception as e:
        logger.warning(
            "Could not fetch OKX UID — using random session_id (settings will not persist across reconnects): %s", e
        )

    save_session(session_id, tokens)
    logger.info("OAuth session created: %s", session_id[:8])
    return session_id, redirect_url, lang


async def refresh_access_token(session_id: str) -> str:
    """Refresh expired access_token using refresh_token."""
    tokens = get_session(session_id)
    if not tokens:
        raise ValueError("Session not found")

    data = {
        "client_id": OKX_CLIENT_ID,
        "client_secret": OKX_CLIENT_SECRET,
        "refresh_token": tokens["refresh_token"],
        "grant_type": "refresh_token",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(OKX_OAUTH_TOKEN, data=data, timeout=15)
        # Refresh token expired or revoked → delete session immediately
        if resp.status_code in (400, 401, 403):
            logger.warning(
                "Refresh token rejected (status=%s) for session %s — deleting session",
                resp.status_code, session_id[:8],
            )
            await _notify_reauth(session_id)
            delete_session(session_id)
            raise ValueError(f"Refresh token expired or revoked (status={resp.status_code})")
        resp.raise_for_status()
        token_data = resp.json()

    if "access_token" not in token_data:
        # Handle OKX-level error codes indicating token invalidation
        if token_data.get("error") in ("invalid_grant", "expired_token", "invalid_token"):
            logger.warning(
                "Refresh token invalidated (error=%s) for session %s — deleting session",
                token_data.get("error"), session_id[:8],
            )
            await _notify_reauth(session_id)
            delete_session(session_id)
        raise ValueError(f"OKX refresh error: {token_data}")

    tokens["access_token"] = token_data["access_token"]
    tokens["refresh_token"] = token_data["refresh_token"]
    tokens["expires_at"] = time.time() + token_data.get("expires_in", 3600)
    update_session(session_id, tokens)

    logger.info("Token refreshed: session %s", session_id[:8])
    return tokens["access_token"]


async def _notify_reauth(session_id: str) -> None:
    """Send Telegram alert when OKX re-authentication is needed."""
    try:
        from .settings import get_settings
        settings = get_settings(session_id)
        chat_id = settings.get("alert_telegram_chat_id", "")
        if not chat_id:
            return
        from .notifications import send_reauth_alert
        await send_reauth_alert(chat_id)
    except Exception as e:
        logger.warning("Failed to send reauth alert for session %s: %s", session_id[:8], e)


async def get_valid_token(session_id: str) -> str:
    """
    Get valid access_token, auto-refreshing 5 min before expiry.
    Uses per-session lock to prevent concurrent refresh race conditions.
    """
    tokens = get_session(session_id)
    if not tokens:
        raise ValueError("Session not found. Connect OKX first.")

    if time.time() > tokens["expires_at"] - 300:
        # Per-session lock: only one coroutine refreshes at a time
        if session_id not in _refresh_locks:
            _refresh_locks[session_id] = asyncio.Lock()
        async with _refresh_locks[session_id]:
            # Re-read after acquiring lock — another coroutine may have refreshed
            tokens = get_session(session_id)
            if not tokens:
                raise ValueError("Session not found after refresh wait.")
            if time.time() > tokens["expires_at"] - 300:
                return await refresh_access_token(session_id)
            return tokens["access_token"]

    return tokens["access_token"]


def is_authenticated(session_id: str) -> bool:
    """Check if session has valid (or refreshable) tokens."""
    if not session_id:
        return False
    tokens = get_session(session_id)
    if not tokens:
        return False
    # Refresh token expires after 3 days
    if time.time() > tokens["expires_at"] + 259200:
        delete_session(session_id)
        return False
    return True


def disconnect(session_id: str) -> None:
    """Delete session and all tokens."""
    delete_session(session_id)
    logger.info("Session disconnected: %s", session_id[:8])
