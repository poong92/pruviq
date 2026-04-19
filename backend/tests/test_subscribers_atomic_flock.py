"""
Regression guard for /api/subscribe + /api/unsubscribe atomic-write +
fcntl.flock hardening (PR 2026-04-19).

Three things this file asserts:
  1. `_mutate_subscribers_atomic` uses fcntl.flock and tmp+rename (not
     direct write_text) — prevents torn reads on crash and drop-on-race
     on multi-worker uvicorn.
  2. /api/unsubscribe uses hmac.compare_digest (no timing leak on
     mismatched prefixes).
  3. Concurrent subscribe requests from threaded clients don't lose
     updates — this would fail if the helper were removed and we went
     back to read-modify-write without a lock.
"""
from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_with_temp_subscribers(monkeypatch):
    """Point SUBSCRIBERS_FILE at a fresh tempdir + reload the app."""
    tmp = tempfile.TemporaryDirectory()
    sub_path = Path(tmp.name) / "subs.json"
    monkeypatch.setenv("SUBSCRIBERS_FILE", str(sub_path))
    monkeypatch.setenv("UNSUBSCRIBE_SECRET", "x" * 32)

    # Re-import main under the env overrides (module-level constant)
    import importlib

    import api.main as main

    importlib.reload(main)
    client = TestClient(main.app)
    yield client, sub_path, main
    tmp.cleanup()
    importlib.reload(main)  # restore for other tests


def test_helper_uses_flock_and_atomic_rename():
    """Source-level guard: if someone rips out the lock or the tmp+rename
    discipline, they have to change this test too (making the regression
    visible in the PR)."""
    src = Path(__file__).resolve().parent.parent / "api" / "main.py"
    body = src.read_text()
    # Helper exists
    assert "_mutate_subscribers_atomic" in body, (
        "the read-modify-write helper must exist; do not inline the "
        "sequence again — it's the single choke-point for the flock"
    )
    # Inside the helper: fcntl.flock with LOCK_EX + LOCK_UN
    assert "fcntl.LOCK_EX" in body, (
        "helper must acquire an exclusive flock to serialize writers"
    )
    assert "fcntl.LOCK_UN" in body, (
        "helper must release the flock in a finally block"
    )
    # Still writes via tmp+rename (not direct write_text on the canonical file)
    # This assertion is strict: the lock guards concurrency, the rename
    # guards reader-visible atomicity on POSIX.
    helper_body = body.split("_mutate_subscribers_atomic", 1)[1].split("\n\n\n", 1)[0]
    assert ".with_suffix(\".tmp\")" in helper_body, (
        "helper must stage the write in a .tmp file"
    )
    assert "tmp.rename(SUBSCRIBERS_FILE)" in helper_body, (
        "helper must atomically rename .tmp → canonical"
    )


def test_unsubscribe_uses_compare_digest():
    """hmac.compare_digest avoids byte-by-byte early exit on mismatched
    tokens. The previous `if token not in (full, legacy)` had a timing
    leak proportional to prefix-match length."""
    src = Path(__file__).resolve().parent.parent / "api" / "main.py"
    body = src.read_text()
    # Locate the unsubscribe function body
    match = re.search(r"async def unsubscribe_email.*?(?=\n@app\.|\nasync def |\ndef )", body, re.DOTALL)
    assert match, "unsubscribe_email function not found"
    fn_body = match.group(0)
    assert "hmac.compare_digest" in fn_body, (
        "unsubscribe must use hmac.compare_digest for token comparison — "
        "`==` / `in` on HMAC values leaks prefix match length via timing"
    )
    # Double guard: make sure the old vulnerable form didn't creep back
    assert "token not in (expected_full, expected_legacy)" not in fn_body, (
        "the non-constant-time comparison is back — revert the regression"
    )


def test_subscribe_writes_via_tmp_rename_not_partial_file(client_with_temp_subscribers):
    """End-to-end: POST to /api/subscribe lands the email in the canonical
    file. The `.tmp` sibling should NOT exist afterwards (it was renamed)."""
    client, sub_path, _ = client_with_temp_subscribers
    resp = client.post("/api/subscribe", json={"email": "a@example.com", "lang": "en"})
    assert resp.status_code == 200
    assert sub_path.exists(), "canonical subscribers file must exist after subscribe"
    tmp_sibling = sub_path.with_suffix(".tmp")
    assert not tmp_sibling.exists(), (
        ".tmp must be gone after rename — stranded .tmp indicates a crash "
        "between write and rename"
    )
    data = json.loads(sub_path.read_text())
    assert any(s["email"] == "a@example.com" for s in data["subscribers"])


def test_concurrent_mutations_do_not_lose_updates(client_with_temp_subscribers):
    """Call `_mutate_subscribers_atomic` directly from N threads. All N
    appends must survive — without the flock, a lost-update race is
    visible here.

    Calling the helper directly (not via HTTP) dodges the route-level
    rate limiter that correctly caps /api/subscribe at a few req/min per
    client. This test is about concurrency correctness, not rate-limit
    behaviour."""
    _, sub_path, main = client_with_temp_subscribers

    N = 20
    errors: list[Exception] = []

    def _append(i: int) -> None:
        def mutator(data):
            data["subscribers"].append({
                "email": f"user{i:03d}@example.com",
                "lang": "en",
                "subscribed_at": "2026-04-19T00:00:00",
                "active": True,
            })
            return data, None

        try:
            main._mutate_subscribers_atomic(mutator)
        except Exception as e:  # pragma: no cover — captured for assert
            errors.append(e)

    threads = [threading.Thread(target=_append, args=(i,)) for i in range(N)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"one or more mutations raised: {errors[:3]}"

    data = json.loads(sub_path.read_text())
    emails = {s["email"] for s in data["subscribers"]}
    expected = {f"user{i:03d}@example.com" for i in range(N)}
    missing = expected - emails
    assert not missing, (
        f"lost {len(missing)} emails to the read-modify-write race: "
        f"{sorted(missing)[:5]}"
    )
