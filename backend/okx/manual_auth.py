"""
Manual API key paste auth path for OKX.

Owner decision (2026-04-25): ship manual paste FIRST while OAuth Broker (Fast
API) approval is pending. Industry-standard pattern — 3Commas, Cryptohopper,
BitsGap, Altrady, WunderTrading all prioritize manual-paste over OAuth.

Flow: user pastes API key + secret + passphrase → we validate by calling
OKX `GET /api/v5/account/balance` with HMAC-signed credentials → on success,
persist via storage.save_session() with the same dict shape OAuth produces.
The trading engine sees an identical session row regardless of how it was
created — `is_authenticated()`, `get_api_credentials()`, `MAX_PER_TRADE_USDT`
cap, clOrdId idempotency, /halt killswitch all work unchanged.
"""
from __future__ import annotations

import logging
import secrets
import time

import httpx

from .client import OKXClient
from .storage import save_session

logger = logging.getLogger("okx_manual_auth")

# Length sanity guards so we don't burn an OKX rate-limit slot on garbage.
# OKX API keys are typically 36-char UUIDs; secrets 32-char base64; passphrases
# user-defined 8-32 chars. Allow comfortable margin on both sides.
_API_KEY_MIN, _API_KEY_MAX = 20, 80
_SECRET_MIN, _SECRET_MAX = 20, 80
_PASSPHRASE_MIN, _PASSPHRASE_MAX = 8, 64


def _validate_input(api_key: str, secret_key: str, passphrase: str) -> tuple[str, str, str]:
    fields = {"api_key": api_key, "secret_key": secret_key, "passphrase": passphrase}
    cleaned = {}
    for name, raw in fields.items():
        if not isinstance(raw, str):
            raise ValueError(f"missing_field: {name}")
        v = raw.strip()
        if not v:
            raise ValueError(f"missing_field: {name}")
        cleaned[name] = v

    bounds = {
        "api_key": (_API_KEY_MIN, _API_KEY_MAX),
        "secret_key": (_SECRET_MIN, _SECRET_MAX),
        "passphrase": (_PASSPHRASE_MIN, _PASSPHRASE_MAX),
    }
    for name, v in cleaned.items():
        lo, hi = bounds[name]
        if len(v) < lo or len(v) > hi:
            raise ValueError(f"malformed_field: {name}")
    return cleaned["api_key"], cleaned["secret_key"], cleaned["passphrase"]


async def validate_and_store(api_key: str, secret_key: str, passphrase: str) -> str:
    """Validate user-pasted OKX credentials and persist a new session.

    Returns: session_id (32+ char URL-safe token).
    Raises: ValueError with one of:
      - "missing_field: <name>"
      - "malformed_field: <name>"
      - "invalid_credentials: <okx_msg>"
    """
    api_key, secret_key, passphrase = _validate_input(api_key, secret_key, passphrase)

    client = OKXClient(api_key=api_key, secret_key=secret_key, passphrase=passphrase)
    try:
        try:
            await client.get_balance("USDT")
        except httpx.HTTPStatusError as e:
            # OKX returns 401/403 on bad signature — surface a clean error.
            raise ValueError(
                f"invalid_credentials: HTTP {e.response.status_code} from OKX"
            ) from e
        except ValueError as e:
            # OKXClient raises ValueError("OKX API error <code>: <msg>") on
            # non-zero codes (50111 Invalid Sign, 50113 Invalid passphrase, etc.)
            msg = str(e)
            if msg.startswith("OKX API error"):
                raise ValueError(f"invalid_credentials: {msg}") from e
            raise
        except httpx.HTTPError as e:
            # Network / TLS failure — distinct from invalid creds.
            raise ValueError(f"invalid_credentials: network error contacting OKX") from e
    finally:
        await client.close()

    credentials = {
        "api_key": api_key,
        "secret_key": secret_key,
        "passphrase": passphrase,
        "perm": "manual_paste",
        "created_at": time.time(),
    }
    session_id = secrets.token_urlsafe(32)
    save_session(session_id, credentials)
    logger.info("manual session created: %s perm=manual_paste", session_id[:8])
    return session_id
