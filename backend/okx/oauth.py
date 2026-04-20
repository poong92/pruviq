"""
OKX OAuth 2.0 flow for Broker program.

Flow:
  1. generate_oauth_params()   → frontend builds authorize URL
  2. exchange_code(code)       → code → access_token → create API key for user
  3. get_api_credentials(sid)  → returns {api_key, secret_key, passphrase}
  4. disconnect(sid)           → delete session

scope="fast_api" — REQUIRED for OKX Broker OAuth (OKX_API_SPECS.md §1).
scope="read_only,trade" silently routes user to /account/users (OKX drop). Do NOT use.
(Earlier comment had this reversed — corrected 2026-04-19 after /users drop confirmed live.)
"""
from __future__ import annotations

import logging
import secrets
import string
import time

import httpx

from .config import (
    OKX_BASE_URL,
    OKX_BROKER_CODE,
    OKX_CLIENT_ID,
    OKX_CLIENT_SECRET,
    OKX_DEMO_MODE,
    OKX_OAUTH_AUTHORIZE,
    OKX_OAUTH_TOKEN,
    OKX_REDIRECT_URI,
)
from .storage import (
    delete_session,
    get_session,
    save_csrf_state,
    save_session,
    validate_csrf_state,
)

logger = logging.getLogger("okx_oauth")


def _gen_passphrase() -> str:
    """Generate passphrase meeting OKX requirements: 8-32 chars, upper+lower+digit+special."""
    chars = string.ascii_letters + string.digits + "!@#$%"
    rand = "".join(secrets.choice(chars) for _ in range(12))
    return f"Pr1!{rand}"  # guaranteed: upper(P), lower(r), digit(1), special(!)


def _validate_redirect(url: str) -> str:
    """Return url if safe; else "". Blocks open-redirect phishing on
    `/auth/okx/*?redirect=...`.

    Allowed:
      - empty
      - relative path starting with "/" (same origin)
      - absolute http(s) url on pruviq.com or *.pruviq.com

    Explicitly rejected: javascript:, data:, vbscript:, file:, protocol-relative
    (//evil.com), and any non-pruviq host. urlparse("javascript:x").netloc == ""
    so a naive netloc check fails open — enforce scheme allowlist too.
    """
    if not url:
        return ""
    from urllib.parse import urlparse
    # Protocol-relative ("//evil.com/…") is not same-origin — reject before parse.
    if url.startswith("//"):
        logger.warning("OAuth redirect blocked (protocol-relative): %s", url[:100])
        return ""
    try:
        parsed = urlparse(url)
    except Exception:
        return ""
    scheme = (parsed.scheme or "").lower()
    # 2026-04-19: use `.hostname` (stripped userinfo, lower-cased) instead
    # of `.netloc`. Input like `https://pruviq.com@evil.pruviq.com/` has
    # netloc=`pruviq.com@evil.pruviq.com` which endswith `.pruviq.com`
    # and would pass the host check, but the effective destination host
    # is `evil.pruviq.com` (attacker-controlled). .hostname returns only
    # the host part and drops `user:pass@`.
    host = (parsed.hostname or "").lower()
    if not scheme and not host:
        # Relative path. Require leading "/" to avoid ambiguous inputs.
        if url.startswith("/"):
            return url
        logger.warning("OAuth redirect blocked (ambiguous relative): %s", url[:100])
        return ""
    if scheme not in ("http", "https"):
        logger.warning("OAuth redirect blocked (bad scheme=%s): %s", scheme, url[:100])
        return ""
    # Reject any userinfo in the URL — it has no legitimate use here and
    # confuses downstream parsers.
    if "@" in (parsed.netloc or ""):
        logger.warning("OAuth redirect blocked (userinfo in URL): %s", url[:100])
        return ""
    if host == "pruviq.com" or host.endswith(".pruviq.com"):
        return url
    logger.warning("OAuth redirect blocked (not pruviq.com): %s", url[:100])
    return ""


def generate_oauth_params(redirect_after: str = "", lang: str = "en") -> dict:
    """Generate OAuth params for frontend authorize URL."""
    redirect_after = _validate_redirect(redirect_after)
    state = secrets.token_urlsafe(32)
    save_csrf_state(state, redirect_after or "", lang)
    params = {
        "state": state,
        "client_id": OKX_CLIENT_ID,
        "response_type": "code",
        "access_type": "offline",
        "scope": "fast_api",
        "redirect_uri": OKX_REDIRECT_URI,
    }
    if OKX_BROKER_CODE:
        params["channelId"] = OKX_BROKER_CODE
    return params


def generate_auth_url(redirect_after: str = "", lang: str = "en") -> str:
    """Generate full OKX authorize URL (server-side redirect variant)."""
    from urllib.parse import urlencode
    redirect_after = _validate_redirect(redirect_after)
    state = secrets.token_urlsafe(32)
    save_csrf_state(state, redirect_after or "", lang)
    params = {
        "client_id": OKX_CLIENT_ID,
        "response_type": "code",
        "access_type": "offline",
        "redirect_uri": OKX_REDIRECT_URI,
        "scope": "fast_api",
        "state": state,
    }
    if OKX_BROKER_CODE:
        params["channelId"] = OKX_BROKER_CODE
    return f"{OKX_OAUTH_AUTHORIZE}?{urlencode(params)}"


async def _create_user_apikey(access_token: str) -> dict:
    """
    Step 4 of Fast API flow: use one-time access_token to create API key for user.
    POST /api/v5/users/oauth/apikey
    Returns {api_key, secret_key, passphrase, perm}.
    """
    passphrase = _gen_passphrase()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
    }
    if OKX_DEMO_MODE:
        headers["x-simulated-trading"] = "1"

    body = {
        "label": "pruviq",
        "passphrase": passphrase,
        "perm": "read_only,trade",
    }
    logger.warning("→ POST /api/v5/users/oauth/apikey demo=%s", OKX_DEMO_MODE)
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{OKX_BASE_URL}/api/v5/users/oauth/apikey",
            headers=headers,
            json=body,
            timeout=15,
        )
        # Body contains apiKey/secretKey/passphrase — never log raw.
        resp.raise_for_status()
        result = resp.json()
        logger.warning(
            "← apikey status=%s code=%s msg=%s",
            resp.status_code, result.get("code"), str(result.get("msg", ""))[:120],
        )

    if result.get("code") != "0":
        raise ValueError(f"OKX API key creation failed: {result}")

    key_data = result["data"][0]
    return {
        "api_key": key_data["apiKey"],
        "secret_key": key_data["secretKey"],
        "passphrase": passphrase,
        "perm": key_data.get("perm", "read_only,trade"),
        "created_at": time.time(),
    }


async def exchange_code(code: str, state: str, domain: str = "") -> tuple[str, str, str]:
    """
    Exchange authorization code → access_token → create API key for user.
    Returns (session_id, redirect_url, lang).
    """
    csrf_result = validate_csrf_state(state)
    if csrf_result is None:
        raise ValueError("Invalid or expired CSRF state")
    redirect_url, lang = csrf_result

    data = {
        "client_id": OKX_CLIENT_ID,
        "client_secret": OKX_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": OKX_REDIRECT_URI,
    }
    # CodeQL py/clear-text-logging-sensitive-data: false positive. `OKX_OAUTH_TOKEN`
    # is the public endpoint URL (`https://www.okx.com/api/v5/users/oauth/...`),
    # not a token/secret. The `data` dict below is NEVER logged — only the URL
    # and response shape flags (has_access, has_refresh) are emitted.
    logger.warning("→ OKX token request url=%s", OKX_OAUTH_TOKEN)
    async with httpx.AsyncClient() as client:
        resp = await client.post(OKX_OAUTH_TOKEN, data=data, timeout=15)
        # Body contains access_token/refresh_token — never log raw.
        resp.raise_for_status()
        token_data = resp.json()
        logger.warning(
            "← token status=%s has_access=%s has_refresh=%s",
            resp.status_code,
            "access_token" in token_data,
            "refresh_token" in token_data,
        )

    if "access_token" not in token_data:
        raise ValueError(f"OKX token error: {token_data}")

    # Use one-time access_token to create user API key
    credentials = await _create_user_apikey(token_data["access_token"])

    session_id = secrets.token_urlsafe(32)
    save_session(session_id, credentials)

    logger.info("OAuth session + API key created: %s", session_id[:8])
    return session_id, redirect_url, lang


def get_api_credentials(session_id: str) -> dict:
    """
    Get stored API key credentials for a session.
    Returns {api_key, secret_key, passphrase} or raises ValueError.
    """
    creds = get_session(session_id)
    if not creds:
        raise ValueError("Session not found. Connect OKX first.")
    if "api_key" not in creds:
        raise ValueError("Session has no API key. Please reconnect OKX.")
    return creds


def is_authenticated(session_id: str) -> bool:
    """Check if session has valid API key credentials."""
    if not session_id:
        return False
    creds = get_session(session_id)
    if not creds:
        return False
    return "api_key" in creds


def disconnect(session_id: str) -> None:
    """Delete session and all credentials."""
    delete_session(session_id)
    logger.info("Session disconnected: %s", session_id[:8])
