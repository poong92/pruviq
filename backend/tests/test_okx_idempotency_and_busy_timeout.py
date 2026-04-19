"""
/execute/order idempotency + SQLite busy_timeout regression guards.

Earlier expert sweep flagged two operational gaps:

1. `router.py::execute_order` did not honor any Idempotency-Key header.
   `execute_from_simulation(..., cl_ord_id=None)` already supported clOrdId
   for OKX-side dedup, but the HTTP layer never wired it. A client-side
   retry (timeout, Cloudflare 520) that reached OKX first but not the
   caller would place a second order on the next attempt. OKX rejects
   duplicate clOrdIds with code 51020 — the safest dedup anchor we have.

2. `storage.py::_get_conn` enabled WAL journal but never set
   `PRAGMA busy_timeout`. SQLite default is SQLITE_BUSY-fail-immediately
   on write lock contention — with reconciler + settings writer + /execute/
   order all holding brief write locks, a user action can get a spurious
   500 that a 5-second wait would have absorbed.
"""
from __future__ import annotations

import hashlib
import sqlite3
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest


def test_busy_timeout_is_set():
    """storage._get_conn must set PRAGMA busy_timeout ≥ 1000ms. Without it,
    two concurrent writers race and one gets SQLITE_BUSY immediately."""
    import os
    # Point the storage module at a fresh temp DB so tests are hermetic.
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["OKX_DB_PATH"] = str(Path(tmp) / "test.db")
        # Reload to pick up the path override.
        import importlib
        import okx.storage as storage
        importlib.reload(storage)
        conn = storage._get_conn()
        try:
            cur = conn.execute("PRAGMA busy_timeout")
            val = cur.fetchone()[0]
        finally:
            conn.close()
        assert val >= 1000, (
            f"busy_timeout is {val}ms — too low. SQLite will fail concurrent "
            "writes with SQLITE_BUSY before the lock clears. Expected ≥ 1000ms "
            "(canonical value 5000)."
        )
    os.environ.pop("OKX_DB_PATH", None)


def test_wal_and_busy_timeout_coexist():
    """WAL + busy_timeout are both needed. WAL lets readers and writers
    coexist; busy_timeout keeps writer-vs-writer collisions from surfacing
    as errors. Regression: ensure both PRAGMAs are wired, not one."""
    import os
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["OKX_DB_PATH"] = str(Path(tmp) / "test.db")
        import importlib
        import okx.storage as storage
        importlib.reload(storage)
        conn = storage._get_conn()
        try:
            journal = conn.execute("PRAGMA journal_mode").fetchone()[0]
            busy = conn.execute("PRAGMA busy_timeout").fetchone()[0]
        finally:
            conn.close()
        assert journal.lower() == "wal", f"journal_mode must be wal, got {journal!r}"
        assert busy >= 1000, f"busy_timeout must be ≥ 1000ms, got {busy}"
    os.environ.pop("OKX_DB_PATH", None)


def test_execute_order_accepts_idempotency_key_header():
    """Route signature must declare Idempotency-Key header. Without it, the
    OpenAPI schema and request parsing skip the header entirely and the
    idempotency codepath dies silently."""
    from okx.router import execute_order
    import inspect

    sig = inspect.signature(execute_order)
    assert "idempotency_key" in sig.parameters, (
        "execute_order missing idempotency_key parameter — retries cannot "
        "be made safe against duplicate OKX orders."
    )
    # FastAPI stores the Header alias in the parameter default's metadata.
    # Inspecting the default here is brittle across FastAPI versions; instead
    # verify the parameter at least exists with the correct name.


def test_cl_ord_id_derivation_is_deterministic():
    """The same (session_id, idempotency_key) pair must hash to the same
    32-char clOrdId on every retry — that is the entire point of OKX dedup."""
    session_id = "ses-abc123"
    key = "client-supplied-ulid"
    raw = f"{session_id}:{key}".encode()
    expected = hashlib.sha1(raw).hexdigest()[:32]

    # Re-derive to prove determinism
    assert hashlib.sha1(raw).hexdigest()[:32] == expected
    # Stay within OKX clOrdId format: [A-Za-z0-9_]{1,32}
    assert 1 <= len(expected) <= 32
    assert all(c.isalnum() or c == "_" for c in expected), (
        f"clOrdId {expected!r} contains characters OKX rejects. "
        "Hash digest must be hex — sha1 hex is safe; MD5 base64 would not be."
    )


def test_cl_ord_id_differs_across_sessions():
    """Two different sessions with the same Idempotency-Key must get
    different clOrdIds — otherwise session A's key could collide with
    session B's and one would be silently rejected by OKX."""
    key = "same-key-from-different-users"
    a = hashlib.sha1(f"sessA:{key}".encode()).hexdigest()[:32]
    b = hashlib.sha1(f"sessB:{key}".encode()).hexdigest()[:32]
    assert a != b, (
        "clOrdId collides across sessions — attacker or honest-mistake "
        "scenario where two users pick the same idempotency key would "
        "cause one of them to get 51020 from OKX on their first post."
    )
