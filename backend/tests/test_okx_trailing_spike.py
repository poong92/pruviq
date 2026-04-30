"""Phase 2.0 trailing-TP design spike — 4 prototype tests answering the
spike questions from the autotrading redesign plan.

Spike questions (all answered at the OKX API boundary, code-as-decision):

  1. OKX trailing API decision: place_algo_order (callback) vs amend_algos.
     → Answer: separate `move_order_stop` algo order. Conditional SL/TP
       cannot be morphed in-place into a trailing stop, so a second algo
       (different algoId) is the correct shape. OKX manages the trailing
       internally — no app-side polling loop required.

  2. State persistence: how to recover trailing arm/disarm after restart.
     → Answer: store algoId on place; on restart, query
       /api/v5/trade/orders-algo-pending filtered by algoId. If present →
       still armed. If missing → either triggered/cancelled by OKX or
       cleared by user — fall back to the regular reconciler path.

  3. Polling cadence: simulator uses 4h candle close, real trade?
     → Answer: OKX move_order_stop uses live mark/last/index price (per
       triggerPxType). No tick polling needed from us. Cadence question
       collapses at the API boundary.

  4. Idempotency: amend retry pattern with clOrdId.
     → Answer: algoClOrdId on POST. OKX rejects duplicate algoClOrdId
       with code 51020 (same code used for regular order clOrdId). Caller
       uses deterministic hash of (signal_id, "trail") to make retries
       safe.

Tests are mocked — they verify the request shape we send to OKX.
Production-ready hardening (real testnet calls, error handling, schema
validation) lives in Phase 2.1.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def client(monkeypatch):
    """Build an OKXClient with broker code stubbed and HTTP mocked."""
    monkeypatch.setenv("OKX_BROKER_CODE_API", "TEST_BROKER")
    monkeypatch.setenv("OKX_DEMO_MODE", "false")
    import importlib

    import okx.config as config

    importlib.reload(config)
    import okx.client as client_mod

    importlib.reload(client_mod)

    c = client_mod.OKXClient(
        api_key="ak", secret_key="sk", passphrase="pp"
    )
    return c


@pytest.mark.anyio
async def test_q1_trailing_stop_uses_move_order_stop_algo_type(client, monkeypatch):
    """Q1: We send ordType=move_order_stop, NOT conditional. callbackRatio
    sits in the body; broker tag is included for commission tracking."""
    captured: dict = {}

    async def fake_post(path, body):
        captured["path"] = path
        captured["body"] = body
        return {"code": "0", "data": [{"algoId": "11111"}]}

    monkeypatch.setattr(client, "_post", fake_post)
    result = await client.place_trailing_stop(
        inst_id="BTC-USDT-SWAP",
        side="sell",
        sz="2",
        callback_ratio="0.01",
        active_px="100000",
    )
    assert captured["path"] == "/api/v5/trade/order-algo"
    body = captured["body"]
    assert body["ordType"] == "move_order_stop"
    assert body["instId"] == "BTC-USDT-SWAP"
    assert body["side"] == "sell"
    assert body["sz"] == "2"
    assert body["callbackRatio"] == "0.01"
    assert body["activePx"] == "100000"
    assert body["tag"] == "TEST_BROKER"
    assert "callbackSpread" not in body
    assert result["data"][0]["algoId"] == "11111"


@pytest.mark.anyio
async def test_q2_restart_recovery_via_algos_pending_query(client, monkeypatch):
    """Q2: After restart, app stored algoId. Query orders-algo-pending
    filtered by ordType=move_order_stop + algoId. If returned list is
    non-empty → still armed."""
    captured: dict = {}

    async def fake_get(path, params=None):
        captured["path"] = path
        captured["params"] = params or {}
        return {
            "code": "0",
            "data": [
                {
                    "algoId": "11111",
                    "instId": "BTC-USDT-SWAP",
                    "ordType": "move_order_stop",
                    "state": "live",
                }
            ],
        }

    monkeypatch.setattr(client, "_get", fake_get)
    pending = await client.get_algo_orders_pending(
        algo_id="11111", inst_id="BTC-USDT-SWAP"
    )
    assert captured["path"] == "/api/v5/trade/orders-algo-pending"
    # ordType is hard-coded to move_order_stop so this helper only
    # surfaces trailing — keeps the recovery path narrow.
    assert captured["params"]["ordType"] == "move_order_stop"
    assert captured["params"]["algoId"] == "11111"
    assert captured["params"]["instId"] == "BTC-USDT-SWAP"
    assert len(pending) == 1
    assert pending[0]["state"] == "live"


@pytest.mark.anyio
async def test_q3_callback_ratio_xor_spread_enforced(client, monkeypatch):
    """Q3 part 1: We don't poll — OKX manages trailing. The spike helper
    enforces callback_ratio XOR callback_spread (OKX requires exactly
    one). Both-or-neither must raise before any HTTP call."""
    posted = False

    async def fake_post(path, body):
        nonlocal posted
        posted = True
        return {"code": "0", "data": [{"algoId": "x"}]}

    monkeypatch.setattr(client, "_post", fake_post)

    # Neither → reject.
    with pytest.raises(ValueError, match="exactly one"):
        await client.place_trailing_stop(
            inst_id="BTC-USDT-SWAP", side="sell", sz="2"
        )
    # Both → reject.
    with pytest.raises(ValueError, match="exactly one"):
        await client.place_trailing_stop(
            inst_id="BTC-USDT-SWAP",
            side="sell",
            sz="2",
            callback_ratio="0.01",
            callback_spread="50",
        )
    assert not posted, "POST must not fire when caller mis-specifies callback"


@pytest.mark.anyio
async def test_q4_idempotency_via_algo_cl_ord_id(client, monkeypatch):
    """Q4: algoClOrdId is sent verbatim. OKX rejects duplicates with code
    51020 — caller's responsibility to derive a deterministic hash."""
    captured: dict = {}

    async def fake_post(path, body):
        captured["body"] = body
        return {"code": "0", "data": [{"algoId": "22222"}]}

    monkeypatch.setattr(client, "_post", fake_post)
    await client.place_trailing_stop(
        inst_id="ETH-USDT-SWAP",
        side="buy",
        sz="3",
        callback_spread="5",
        cl_ord_id="signal12345trail",
    )
    assert captured["body"]["algoClOrdId"] == "signal12345trail"
    # Without cl_ord_id, the field must be absent (OKX treats empty
    # strings as still-an-attempted-id, which would block legitimate
    # retries).
    captured.clear()
    await client.place_trailing_stop(
        inst_id="ETH-USDT-SWAP",
        side="buy",
        sz="3",
        callback_spread="5",
    )
    assert "algoClOrdId" not in captured["body"]
