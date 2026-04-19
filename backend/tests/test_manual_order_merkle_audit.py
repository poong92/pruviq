"""
Merkle audit-log gap fix regression guard (PR 2026-04-20).

Before this PR, only `auto_executor.py` recorded a Merkle leaf after a
successful order — manual orders placed via `/execute/order` (routed
through `okx.orders.execute_from_simulation`) completed silently with no
`order_audit` row. That meant the daily Merkle root at
`/trust/merkle/{YYYYMMDD}` was a selective summary: auto only, not all.
A user executing manually had no way to prove their order hit the chain.

Asserts:
  1. `execute_from_simulation` now imports + calls `merkle.record_order`
     after the market order succeeds.
  2. The leaf pre-image matches auto-executor's canonical format — same
     `session_id | ts_iso | inst_id | side | sz | fill_price |
     broker_code` shape so users can reproduce it off-line.
  3. Audit failure does NOT raise — the trading path must be uninterrupted
     by a logging issue (same invariant auto-executor honours).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

ORDERS_SRC = (Path(__file__).resolve().parent.parent / "okx" / "orders.py").read_text()


def test_orders_imports_record_order_from_merkle():
    """Source-level: the import must live inside execute_from_simulation
    (lazy import keeps module-load fast + avoids circular import with
    storage.py which merkle.py depends on)."""
    assert "from .merkle import record_order" in ORDERS_SRC, (
        "execute_from_simulation must import merkle.record_order — "
        "without it, manual /execute/order orders go unaudited"
    )


def test_orders_calls_record_order_after_place():
    """The record_order call must come AFTER client.place_order() so we
    only log orders that actually hit OKX. Logging a pre-submit payload
    would record orders that never executed."""
    place_pos = ORDERS_SRC.find("await client.place_order(")
    record_pos = ORDERS_SRC.find("_merkle_record(")
    assert 0 < place_pos < record_pos, (
        "record_order must be called AFTER place_order succeeds; "
        "record-before-place would log phantom orders"
    )


def test_leaf_preimage_matches_auto_executor_shape():
    """The leaf pre-image must mirror auto_executor's exactly — same
    7 fields in the same order — or the canonical leaf hash diverges
    across the two code paths and users can't reliably verify
    inclusion."""
    # Grab the _merkle_record(...) block. The body contains a nested
    # `datetime.now(timezone.utc)` paren, so a naive `.*?\)` regex would
    # close early. Instead scan from `_merkle_record(` to the outer-paren
    # match by counting depth.
    start = ORDERS_SRC.find("_merkle_record(")
    assert start > 0, "_merkle_record call not found"
    depth = 0
    open_pos = ORDERS_SRC.find("(", start)
    i = open_pos
    while i < len(ORDERS_SRC):
        ch = ORDERS_SRC[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                break
        i += 1
    assert depth == 0, "unbalanced parens in _merkle_record call"
    body = ORDERS_SRC[open_pos + 1: i]
    # Every canonical field must be a kwarg in the call
    for field in ("session_id", "ts_iso", "inst_id", "side", "sz",
                  "fill_price", "broker_code"):
        assert f"{field}=" in body, (
            f"{field} missing from manual-order leaf — pre-image would "
            f"diverge from auto_executor, breaking user-side verification"
        )


def test_audit_failure_does_not_raise():
    """The record_order call must live inside a try/except whose body
    logs but swallows. Otherwise a broken audit path = dead trading
    path, which is exactly the wrong failure mode for compliance
    instrumentation."""
    # Extract the block around _merkle_record
    idx = ORDERS_SRC.find("_merkle_record(")
    assert idx > 0
    # Look ~1500 chars around the call for the try/except shape
    window = ORDERS_SRC[max(0, idx - 800): idx + 800]
    assert "try:" in window, "audit record must be inside a try block"
    # Exception handler must log, not re-raise
    assert re.search(
        r"except\s+Exception\s+as\s+\w+:\s*\n\s*#.*\n\s*logger\.warning",
        window,
    ) or re.search(
        r"except\s+Exception\s+as\s+\w+:[\s\S]{0,200}?logger\.(warning|error)",
        window,
    ), (
        "audit record_order must log + swallow on failure — a raising "
        "exception handler would kill the trading response after the "
        "order actually placed"
    )


def test_still_uses_datetime_now_utc_not_naive():
    """Audit timestamps must be timezone-aware UTC — a naive local clock
    would produce leaves that disagree with auto_executor's UTC
    timestamps, and external verifiers can't reproduce them without
    knowing the server's local TZ."""
    # The record call region should use datetime.now(timezone.utc)
    idx = ORDERS_SRC.find("_merkle_record(")
    window = ORDERS_SRC[max(0, idx - 400): idx + 400]
    assert "datetime.now(timezone.utc)" in window, (
        "audit leaf ts must use datetime.now(timezone.utc).isoformat() — "
        "naive `datetime.now()` drifts with server TZ"
    )
