"""Phase 2.1 integration tests — trailing TP wire-up across orders.py +
auto_executor.py + storage.py + dry-run endpoint helper.

Five tests, each pinned to one Phase 2.1 sub-step from the plan:

  T1 trailing places two algo legs           (orders.execute_from_simulation)
  T2 fixed places one algo leg               (regression — no behaviour drift)
  T3 algoId persists to okx_trailing_algos   (storage.insert_trailing_algo)
  T4 close detection cancels sibling         (orders.cancel_trailing_for_position)
  T5 dry-run helper emits zero POSTs         (orders.build_dry_run_payload)

Mocking strategy mirrors test_okx_trailing_spike.py: monkeypatch the
OKXClient HTTP plumbing (`_post`, `_get`) and any helpers that call out to
external services. Tests are hermetic — temp DB via env override + module
reload — so concurrent runs don't share state.

The params-correctness parity check (advisor #1) lives in T1: callbackRatio
is asserted to be exactly `str(trail_pct/100)`, which is the single seam
between simulator decimal-form (engine_fast.py:1372) and OKX decimal-string.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def temp_db(monkeypatch):
    """Hermetic SQLite per test. Modules that read OKX_DB_PATH at import
    time (storage) are reloaded so the path takes effect."""
    with tempfile.TemporaryDirectory() as tmp:
        db_path = str(Path(tmp) / "phase21.db")
        monkeypatch.setenv("OKX_DB_PATH", db_path)
        monkeypatch.setenv("OKX_BROKER_CODE_API", "TEST_BROKER")
        monkeypatch.setenv("OKX_DEMO_MODE", "false")
        # Reload anything that captured these env vars at import time.
        import importlib

        import okx.config as config

        importlib.reload(config)
        import okx.storage as storage

        importlib.reload(storage)
        # Touch the DB so schema CREATE IF NOT EXISTS fires.
        storage._get_conn().close()
        yield db_path


@pytest.fixture
def patched_okx(monkeypatch, temp_db):
    """Patch every OKX side-effecting call so `execute_from_simulation` and
    `build_dry_run_payload` run end-to-end without touching the network.

    Returns a record dict that the test inspects to verify what *would* have
    been sent. POST counts and the captured bodies live there.
    """
    import importlib

    import okx.client as client_mod

    importlib.reload(client_mod)
    import okx.orders as orders_mod

    importlib.reload(orders_mod)

    rec: dict = {
        "post_calls": [],   # list of (path, body)
        "get_calls": [],    # list of (path, params)
        "leverage_calls": 0,
        "close_calls": 0,
    }

    # Stub credentials so OKXClient constructor succeeds in test.
    monkeypatch.setattr(
        orders_mod, "get_api_credentials",
        lambda sid: {"api_key": "ak", "secret_key": "sk", "passphrase": "pp"},
    )

    # Patch OKXClient methods at the class level so any new instance gets
    # the stubs (orders.py opens its own client inside the function).
    async def fake_get_mark_price(self, inst_id):
        rec["get_calls"].append(("mark_price", inst_id))
        return 100000.0

    async def fake_get_instrument_info(self, inst_id):
        rec["get_calls"].append(("instrument_info", inst_id))
        return {"ctVal": 0.01, "minSz": 1, "lotSz": 1, "tickSz": 0.1}

    async def fake_set_leverage(self, **kwargs):
        rec["leverage_calls"] += 1
        return {"code": "0"}

    async def fake_place_order(self, **kwargs):
        body = {"path": "/api/v5/trade/order", **kwargs}
        rec["post_calls"].append(("/api/v5/trade/order", body))
        return {"ordId": "OID-MARKET-1", "code": "0"}

    async def fake_place_algo_order(self, **kwargs):
        # Mirror the body shape for assertion. ordType always "conditional"
        # for this helper; trailing goes through place_trailing_stop.
        body = {"path": "/api/v5/trade/order-algo", "ordType": "conditional", **kwargs}
        rec["post_calls"].append(("/api/v5/trade/order-algo", body))
        return {"code": "0", "data": [{"algoId": "ALGO-SL-1"}]}

    async def fake_place_trailing_stop(self, **kwargs):
        body = {
            "path": "/api/v5/trade/order-algo",
            "ordType": "move_order_stop",
            **kwargs,
        }
        rec["post_calls"].append(("/api/v5/trade/order-algo", body))
        return {"code": "0", "data": [{"algoId": "ALGO-TRAIL-1"}]}

    async def fake_cancel_algo_orders(self, algo_ids, inst_id):
        rec["post_calls"].append(
            ("/api/v5/trade/cancel-algos", {"algo_ids": algo_ids, "inst_id": inst_id})
        )
        return {"code": "0"}

    async def fake_close_position(self, inst_id, mgn_mode="isolated"):
        rec["close_calls"] += 1
        return {"code": "0"}

    monkeypatch.setattr(client_mod.OKXClient, "get_mark_price", fake_get_mark_price)
    monkeypatch.setattr(client_mod.OKXClient, "get_instrument_info", fake_get_instrument_info)
    monkeypatch.setattr(client_mod.OKXClient, "set_leverage", fake_set_leverage)
    monkeypatch.setattr(client_mod.OKXClient, "place_order", fake_place_order)
    monkeypatch.setattr(client_mod.OKXClient, "place_algo_order", fake_place_algo_order)
    monkeypatch.setattr(client_mod.OKXClient, "place_trailing_stop", fake_place_trailing_stop)
    monkeypatch.setattr(client_mod.OKXClient, "cancel_algo_orders", fake_cancel_algo_orders)
    monkeypatch.setattr(client_mod.OKXClient, "close_position", fake_close_position)

    # OKXClient.__aenter__/__aexit__ default to the unpatched (real) impls,
    # which only do `httpx.AsyncClient` lifecycle — safe with no requests.

    # Also stub merkle so non-fatal try/except doesn't interfere with assertions.
    import okx.merkle as merkle_mod

    monkeypatch.setattr(merkle_mod, "record_order", lambda **kw: None)

    return rec


def _build_request(*, tp_source: str = "follow_signal", trail_pct=None,
                    sl_pct: float = 5.0, tp_pct: float = 8.0):
    from okx.models import SimToExecRequest

    return SimToExecRequest(
        strategy="bb-squeeze-short",
        direction="long",
        symbol="BTCUSDT",
        sl_pct=sl_pct,
        tp_pct=tp_pct,
        position_size_usdt=1000.0,
        leverage=5,
        td_mode="isolated",
        tp_source=tp_source,
        trail_pct=trail_pct,
    )


@pytest.mark.anyio
async def test_t1_trailing_signal_places_two_algo_legs(patched_okx):
    """T1: tp_source='trailing' + trail_pct=2.0 produces SL conditional algo
    + trailing move_order_stop algo. callbackRatio == '0.02' (the parity
    seam between sim engine_fast.py:1372 decimal form and OKX decimal-string)."""
    from okx.orders import execute_from_simulation

    req = _build_request(tp_source="trailing", trail_pct=2.0, sl_pct=5.0)
    result = await execute_from_simulation("sess-T1", req, current_price=100000.0)

    algo_calls = [c for c in patched_okx["post_calls"] if c[0].endswith("/order-algo")]
    assert len(algo_calls) == 2, (
        f"trailing strategy must place SL conditional + trailing move_order_stop, "
        f"got {len(algo_calls)}: {algo_calls}"
    )

    sl_body = next(c[1] for c in algo_calls if c[1].get("ordType") == "conditional")
    trail_body = next(c[1] for c in algo_calls if c[1].get("ordType") == "move_order_stop")

    # SL leg: trigger present, TP absent (trailing replaces TP).
    assert sl_body.get("sl_trigger_px"), "SL trigger missing"
    assert sl_body.get("tp_trigger_px") is None, (
        "trailing strategies must omit conditional TP (trailing replaces it)"
    )
    # Trailing leg: callbackRatio is the parity anchor.
    assert trail_body.get("callback_ratio") == "0.02", (
        f"callbackRatio must equal trail_pct/100 (engine_fast.py:1372 parity); "
        f"got {trail_body.get('callback_ratio')}"
    )
    # Both algoIds surfaced into the result for the caller / audit.
    assert result.get("trailing_algo_id") == "ALGO-TRAIL-1"
    assert result["details"]["callback_ratio"] == "0.02"
    assert result["details"]["tp_source"] == "trailing"


@pytest.mark.anyio
async def test_t2_fixed_signal_places_one_algo_leg_only(patched_okx):
    """T2 regression: tp_source='custom_pct' (or default) places exactly one
    conditional SL+TP algo. No trailing POST. Phase 2.1's strategy_overrides
    rewrite must not break the legacy fixed path."""
    from okx.orders import execute_from_simulation

    req = _build_request(tp_source="custom_pct", trail_pct=None, sl_pct=5.0, tp_pct=8.0)
    await execute_from_simulation("sess-T2", req, current_price=100000.0)

    algo_calls = [c for c in patched_okx["post_calls"] if c[0].endswith("/order-algo")]
    assert len(algo_calls) == 1, (
        f"fixed strategy must place exactly one conditional algo, "
        f"got {len(algo_calls)}: {algo_calls}"
    )
    sl_body = algo_calls[0][1]
    assert sl_body.get("ordType") == "conditional"
    assert sl_body.get("sl_trigger_px"), "SL still required on fixed path"
    assert sl_body.get("tp_trigger_px"), "TP still required on fixed path"


@pytest.mark.anyio
async def test_t3_trailing_algo_id_persists_to_db(patched_okx):
    """T3: a successful trailing arm inserts a row into okx_trailing_algos
    with the algoId, parent_ord_id, callback_ratio. Phase 2.1.4 close-cancel
    queries this table by parent_ord_id."""
    from okx import storage
    from okx.orders import execute_from_simulation

    req = _build_request(tp_source="trailing", trail_pct=2.0, sl_pct=5.0)
    await execute_from_simulation(
        "sess-T3", req, current_price=100000.0, cl_ord_id="signalT3"
    )

    rows = storage.list_live_trailing_algos(session_id="sess-T3")
    assert len(rows) == 1, f"expected 1 trailing row for sess-T3, got {len(rows)}"
    row = rows[0]
    assert row["algo_id"] == "ALGO-TRAIL-1"
    assert row["inst_id"] == "BTC-USDT-SWAP"
    assert row["parent_ord_id"] == "OID-MARKET-1"
    assert row["callback_ratio"] == "0.02"


@pytest.mark.anyio
async def test_t4_close_detection_cancels_sibling_trailing(patched_okx):
    """T4: when a trailing algo is armed and the close-detection path
    invokes cancel_trailing_for_position, OKX cancel-algos POST fires once
    with the right algoId, and the DB state flips to 'cancelled'."""
    from okx import storage
    from okx.orders import cancel_trailing_for_position, execute_from_simulation

    # Seed a trailing position.
    req = _build_request(tp_source="trailing", trail_pct=2.0, sl_pct=5.0)
    await execute_from_simulation(
        "sess-T4", req, current_price=100000.0, cl_ord_id="signalT4"
    )
    # Reset post_calls so we count only the cancel.
    patched_okx["post_calls"].clear()

    cancel_result = await cancel_trailing_for_position("sess-T4", "OID-MARKET-1")
    assert cancel_result["cancelled"] is True
    assert cancel_result["algo_id"] == "ALGO-TRAIL-1"

    cancel_calls = [
        c for c in patched_okx["post_calls"] if c[0].endswith("/cancel-algos")
    ]
    assert len(cancel_calls) == 1
    assert cancel_calls[0][1]["algo_ids"] == ["ALGO-TRAIL-1"]
    assert cancel_calls[0][1]["inst_id"] == "BTC-USDT-SWAP"

    # DB state flipped → list_live no longer surfaces it.
    live_after = storage.list_live_trailing_algos(session_id="sess-T4")
    assert len(live_after) == 0, "cancelled trailing must not appear in live list"


@pytest.mark.anyio
async def test_t5_dry_run_endpoint_emits_no_okx_post(patched_okx):
    """T5: build_dry_run_payload returns the three OKX request bodies
    without firing any POST. OKX read GETs (mark price + instrument info)
    are still allowed because tickSz/ctVal aren't derivable otherwise."""
    from okx.orders import build_dry_run_payload

    req = _build_request(tp_source="trailing", trail_pct=2.0, sl_pct=5.0)
    payload = await build_dry_run_payload("sess-T5", req, current_price=100000.0)

    posts = patched_okx["post_calls"]
    assert posts == [], (
        f"dry-run must emit ZERO POSTs (Phase 2.2 ledger goal), "
        f"observed {len(posts)}: {[p[0] for p in posts]}"
    )
    # Three required keys present; trailing populated for trailing strategy.
    assert payload["order_request"]["ordType"] == "market"
    assert payload["sl_algo_request"]["ordType"] == "conditional"
    assert payload["trailing_algo_request"]["ordType"] == "move_order_stop"
    assert payload["trailing_algo_request"]["callbackRatio"] == "0.02"
    # Fixed path branch: trailing_algo_request must be None, regression guard.
    fixed_req = _build_request(tp_source="custom_pct", trail_pct=None)
    fixed_payload = await build_dry_run_payload(
        "sess-T5", fixed_req, current_price=100000.0,
    )
    assert fixed_payload["trailing_algo_request"] is None
