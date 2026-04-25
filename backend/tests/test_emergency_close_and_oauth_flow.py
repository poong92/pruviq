"""
Fund-loss critical path tests (PR 2026-04-19).

test-writer agent identified two unarmored paths that could hide a live
OKX position left open:

1. `_emergency_close_with_retry` — three retry attempts, then critical
   Telegram alert + return False. Zero tests today. A regression (e.g.
   breaking the retry_async wrapper or silencing send_execution_failed)
   would leave positions open without user notification.

2. `exchange_code` — OAuth token exchange + API-key creation. Zero tests
   for either the happy path or the common failure modes (OKX 50113
   expired code, OKX 5xx). A crash here means the user sees a generic
   "exchange_failed" redirect with no server-side distinction.

Both paths use httpx/OKXClient, so tests mock at the boundaries.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest


# ─── _emergency_close_with_retry ──────────────────────────────────


@pytest.fixture
def signal_stub() -> dict:
    return {
        "strategy": "bb-squeeze",
        "coin": "BTCUSDT",
        "direction": "long",
        "signal_time": "2026-04-19T10:00:00",
        "entry_price": 85000.0,
    }


@pytest.mark.anyio
async def test_emergency_close_happy_path_returns_true(signal_stub):
    """Close succeeds on first try → True + no critical alert."""
    from okx.auto_executor import _emergency_close_with_retry

    client = MagicMock()
    client.close_position = AsyncMock(return_value={"ordId": "close-1"})
    # No algo_ids → skip cancel step
    with patch(
        "okx.auto_executor.send_execution_failed",
        new=AsyncMock(),
    ) as mock_notify:
        ok = await _emergency_close_with_retry(
            client,
            inst_id="BTC-USDT-SWAP",
            td_mode="isolated",
            reason="SL/TP failed",
            chat_id="123",
            signal=signal_stub,
        )
    assert ok is True
    client.close_position.assert_called_once_with(
        "BTC-USDT-SWAP", mgn_mode="isolated"
    )
    # Allow the fire-and-forget notification task to start
    await asyncio.sleep(0)
    assert mock_notify.await_count == 1
    msg = mock_notify.await_args.args[2]
    assert "즉시 청산" in msg or "close" in msg.lower()


@pytest.mark.anyio
async def test_emergency_close_all_retries_fail_returns_false(signal_stub):
    """Close fails 3x → False + critical Telegram + log.critical.

    Regression guard: if retry_async is ever swapped for a one-shot call
    or send_execution_failed is wired to the wrong chat, a user would
    never hear about an open position."""
    from okx.auto_executor import _emergency_close_with_retry

    client = MagicMock()
    client.close_position = AsyncMock(side_effect=RuntimeError("OKX 5xx"))
    with patch(
        "okx.auto_executor.send_execution_failed",
        new=AsyncMock(),
    ) as mock_notify:
        ok = await _emergency_close_with_retry(
            client,
            inst_id="BTC-USDT-SWAP",
            td_mode="isolated",
            reason="SL/TP failed",
            chat_id="123",
            signal=signal_stub,
        )
    assert ok is False
    # retry_async runs max_attempts=3; close_position must be called 3x.
    assert client.close_position.await_count == 3
    # fire-and-forget task — let the scheduler run once
    await asyncio.sleep(0)
    assert mock_notify.await_count == 1
    msg = mock_notify.await_args.args[2]
    # Must signal "check OKX manually" — distinct from routine "execution failed"
    assert "긴급 청산 실패" in msg
    assert "BTC-USDT-SWAP" in msg  # so the user knows which position


@pytest.mark.anyio
async def test_emergency_close_cancel_first_on_algo_ids(signal_stub):
    """When algo_ids are supplied, cancel_algo_orders must run before
    close_position. If cancel fails we still attempt close (L6 lesson)."""
    from okx.auto_executor import _emergency_close_with_retry

    client = MagicMock()
    client.cancel_algo_orders = AsyncMock(
        side_effect=RuntimeError("cancel 5xx")
    )
    client.close_position = AsyncMock(return_value={"ordId": "c-1"})
    with patch(
        "okx.auto_executor.send_execution_failed",
        new=AsyncMock(),
    ):
        ok = await _emergency_close_with_retry(
            client,
            inst_id="BTC-USDT-SWAP",
            td_mode="isolated",
            reason="SL/TP failed",
            chat_id="123",
            signal=signal_stub,
            algo_ids=["algo-1", "algo-2"],
        )
    # Cancel ran (best-effort, raised), close still succeeded.
    assert client.cancel_algo_orders.await_count == 1
    assert client.close_position.await_count == 1
    assert ok is True


@pytest.mark.anyio
async def test_emergency_close_no_chat_id_skips_notification(signal_stub):
    """chat_id=None → no send_execution_failed call (silent path for
    admin-only sessions)."""
    from okx.auto_executor import _emergency_close_with_retry

    client = MagicMock()
    client.close_position = AsyncMock(return_value={"ordId": "c-1"})
    with patch(
        "okx.auto_executor.send_execution_failed",
        new=AsyncMock(),
    ) as mock_notify:
        ok = await _emergency_close_with_retry(
            client,
            inst_id="BTC-USDT-SWAP",
            td_mode="isolated",
            reason="slippage",
            chat_id=None,
            signal=signal_stub,
        )
    assert ok is True
    await asyncio.sleep(0)
    assert mock_notify.await_count == 0


# ─── exchange_code OAuth flow ──────────────────────────────────────


class _MockResponse:
    """Minimal httpx.Response lookalike — supports .json(), .status_code,
    .raise_for_status()."""

    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self._body = body
        self.text = str(body)[:300]

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            import httpx
            raise httpx.HTTPStatusError(
                f"{self.status_code}",
                request=MagicMock(),
                response=MagicMock(status_code=self.status_code),
            )


@pytest.mark.anyio
async def test_exchange_code_invalid_state_raises():
    """Bad CSRF state must raise ValueError before any OKX call."""
    from okx.oauth import exchange_code

    with patch("okx.oauth.validate_csrf_state", return_value=None):
        with pytest.raises(ValueError, match="CSRF"):
            await exchange_code("code-xyz", "bad-state", "")


@pytest.mark.anyio
async def test_exchange_code_token_missing_raises():
    """OKX returns 200 but body lacks access_token → ValueError
    (e.g. expired code returns code=50113)."""
    from okx.oauth import exchange_code

    token_resp = _MockResponse(200, {"code": "50113", "msg": "code expired"})
    client_cm = MagicMock()
    client_cm.__aenter__ = AsyncMock(
        return_value=MagicMock(post=AsyncMock(return_value=token_resp))
    )
    client_cm.__aexit__ = AsyncMock(return_value=False)
    with patch(
        "okx.oauth.validate_csrf_state",
        return_value=("https://pruviq.com/dashboard", "en", ""),
    ), patch("okx.oauth.httpx.AsyncClient", return_value=client_cm):
        with pytest.raises(ValueError, match="OKX token error"):
            await exchange_code("expired-code", "ok-state", "")


@pytest.mark.anyio
async def test_exchange_code_5xx_raises_httpx_error():
    """OKX 5xx → raise_for_status → httpx.HTTPStatusError propagates."""
    from okx.oauth import exchange_code
    import httpx

    token_resp = _MockResponse(502, {"msg": "bad gateway"})
    client_cm = MagicMock()
    client_cm.__aenter__ = AsyncMock(
        return_value=MagicMock(post=AsyncMock(return_value=token_resp))
    )
    client_cm.__aexit__ = AsyncMock(return_value=False)
    with patch(
        "okx.oauth.validate_csrf_state",
        return_value=("https://pruviq.com/dashboard", "en", ""),
    ), patch("okx.oauth.httpx.AsyncClient", return_value=client_cm):
        with pytest.raises(httpx.HTTPStatusError):
            await exchange_code("any-code", "ok-state", "")


@pytest.mark.anyio
async def test_exchange_code_happy_path_saves_session():
    """Happy path: token → apikey → save_session → (session_id, redirect, lang)."""
    from okx.oauth import exchange_code

    token_resp = _MockResponse(
        200,
        {
            "access_token": "at-123",
            "refresh_token": "rt-123",
            "expires_in": 3600,
        },
    )
    apikey_resp = _MockResponse(
        200,
        {
            "code": "0",
            "msg": "",
            "data": [
                {
                    "apiKey": "user-api-key",
                    "secretKey": "user-secret-key",
                    "perm": "read_only,trade",
                }
            ],
        },
    )

    # First post = token endpoint; second post = apikey endpoint.
    mock_post = AsyncMock(side_effect=[token_resp, apikey_resp])
    client_cm = MagicMock()
    client_cm.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
    client_cm.__aexit__ = AsyncMock(return_value=False)

    with patch(
        "okx.oauth.validate_csrf_state",
        return_value=("https://pruviq.com/dashboard", "en", ""),
    ), patch("okx.oauth.save_session") as mock_save, patch(
        "okx.oauth.httpx.AsyncClient", return_value=client_cm
    ):
        session_id, redirect, lang = await exchange_code(
            "ok-code", "ok-state", ""
        )

    assert isinstance(session_id, str) and len(session_id) >= 32
    assert redirect == "https://pruviq.com/dashboard"
    assert lang == "en"
    mock_save.assert_called_once()
    saved = mock_save.call_args.args[1]
    assert saved["api_key"] == "user-api-key"
    assert saved["secret_key"] == "user-secret-key"
    # passphrase is generated locally — must be present and non-empty
    assert saved["passphrase"] and len(saved["passphrase"]) >= 8


@pytest.mark.anyio
async def test_exchange_code_apikey_failure_raises():
    """OKX returns token OK but apikey creation fails (code != "0") → ValueError."""
    from okx.oauth import exchange_code

    token_resp = _MockResponse(
        200, {"access_token": "at-ok", "refresh_token": "rt-ok"}
    )
    apikey_resp = _MockResponse(
        200,
        {"code": "50000", "msg": "Broker not approved for user"},
    )
    mock_post = AsyncMock(side_effect=[token_resp, apikey_resp])
    client_cm = MagicMock()
    client_cm.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
    client_cm.__aexit__ = AsyncMock(return_value=False)

    with patch(
        "okx.oauth.validate_csrf_state",
        return_value=("https://pruviq.com/dashboard", "en", ""),
    ), patch("okx.oauth.httpx.AsyncClient", return_value=client_cm):
        with pytest.raises(ValueError, match="OKX API key creation failed"):
            await exchange_code("ok-code", "ok-state", "")
