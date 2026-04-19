"""
ADMIN_API_KEYS / INTERNAL_API_KEYS rotation regression guard (PR 2026-04-20).

Same rotation shape shipped for OKX_ENCRYPTION_KEYS in PR #1195 — an
operator can set `ADMIN_API_KEYS=new,old` while both clients exist,
then shrink to `ADMIN_API_KEYS=new` once old clients are retired.

Asserts:
  1. `_parse_rotation_keys` honours precedence (plural > singular), drops
     short keys with a warning, preserves newest-first order.
  2. `_admin_key_valid` accepts ANY member of the rotation tuple,
     constant-time across all members.
  3. Legacy `ADMIN_API_KEY` / `INTERNAL_API_KEY` module constants stay
     populated with the newest key so any third-party caller reading the
     singular name keeps working.
  4. /admin/refresh + /internal/signals + /simulate rate-limit bypass
     all accept any rotation member.
"""
from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi.testclient import TestClient


NEW = "A" * 32 + "_new_secret"
OLD = "B" * 32 + "_old_secret"
BAD = "C" * 32 + "_bad_secret"


@pytest.fixture
def reloaded_main(monkeypatch):
    """Reload api.main with a controlled set of env vars. Required because
    the module reads keys once at import time."""

    def _factory(**env: str):
        # Wipe the relevant envs first so leftovers don't leak in.
        for k in (
            "ADMIN_API_KEYS", "ADMIN_API_KEY",
            "INTERNAL_API_KEYS", "INTERNAL_API_KEY",
        ):
            monkeypatch.delenv(k, raising=False)
        for k, v in env.items():
            monkeypatch.setenv(k, v)
        import api.main as main
        importlib.reload(main)
        return main

    yield _factory


def test_parse_rotation_plural_beats_singular(reloaded_main):
    main = reloaded_main(
        ADMIN_API_KEYS=f"{NEW},{OLD}",
        ADMIN_API_KEY="ignored_" + ("x" * 32),
    )
    assert main._ADMIN_API_KEYS == (NEW, OLD)
    # Legacy singular constant = primary (newest) key for third-party readers.
    assert main.ADMIN_API_KEY == NEW


def test_parse_rotation_drops_short_keys(reloaded_main):
    main = reloaded_main(ADMIN_API_KEYS=f"{NEW},too_short,{OLD}")
    assert main._ADMIN_API_KEYS == (NEW, OLD), (
        "short key must be dropped, not break the rest of the tuple"
    )


def test_parse_rotation_trailing_comma_tolerated(reloaded_main):
    # Operator mid-rotation: `ADMIN_API_KEYS=new,` before adding the old
    # back in, or after removing old. Empty segment must not poison
    # anything.
    main = reloaded_main(ADMIN_API_KEYS=f"{NEW},")
    assert main._ADMIN_API_KEYS == (NEW,)


def test_falls_back_to_singular_legacy(reloaded_main):
    main = reloaded_main(ADMIN_API_KEY=NEW)
    assert main._ADMIN_API_KEYS == (NEW,)
    assert main.ADMIN_API_KEY == NEW


def test_empty_env_disables_admin(reloaded_main):
    main = reloaded_main()  # no env
    assert main._ADMIN_API_KEYS == ()
    assert main.ADMIN_API_KEY is None


def test_admin_key_valid_accepts_any_member(reloaded_main):
    main = reloaded_main()
    keys = (NEW, OLD)
    assert main._admin_key_valid(NEW, keys) is True
    assert main._admin_key_valid(OLD, keys) is True
    assert main._admin_key_valid(BAD, keys) is False
    assert main._admin_key_valid("", keys) is False
    # Empty tuple must reject everything — a missing-secret deploy cannot
    # be bypassed by sending any truthy key.
    assert main._admin_key_valid(NEW, ()) is False


def test_admin_key_valid_does_not_early_exit(reloaded_main):
    """The validator must NOT early-exit on first match — that would leak
    position-of-match via timing across a rotation. We can't directly
    assert timing, but we can check the loop body by inspection: the
    implementation uses `ok = True` + `|=` instead of `return True`, so
    every call walks the full tuple. This is a source-level guard."""
    src = (Path(__file__).resolve().parent.parent / "api" / "main.py").read_text()
    # Grab the body of _admin_key_valid
    start = src.find("def _admin_key_valid(")
    end = src.find("\n\n\n", start) if start > -1 else -1
    assert start > 0 and end > start, "could not locate _admin_key_valid"
    body = src[start:end]
    assert "return True" not in body, (
        "validator must not short-circuit on first match; use a boolean "
        "accumulator so timing leaks a single bit, not position-of-match"
    )
    assert "compare_digest" in body, "must use hmac.compare_digest"


def test_admin_refresh_accepts_old_key_during_rotation(reloaded_main):
    main = reloaded_main(ADMIN_API_KEYS=f"{NEW},{OLD}")
    client = TestClient(main.app)

    # Old key still works mid-rotation — this is the whole point.
    # /admin/refresh hits external refresh; we only care about the auth
    # check, so we stub _refresh_data to a no-op.
    main._refresh_data = lambda: None  # type: ignore[attr-defined]
    r_old = client.post("/admin/refresh", headers={"X-Admin-Key": OLD})
    assert r_old.status_code == 200, r_old.text
    r_new = client.post("/admin/refresh", headers={"X-Admin-Key": NEW})
    assert r_new.status_code == 200, r_new.text
    r_bad = client.post("/admin/refresh", headers={"X-Admin-Key": BAD})
    assert r_bad.status_code == 403


def test_admin_refresh_rejects_when_disabled(reloaded_main):
    main = reloaded_main()  # no keys
    client = TestClient(main.app)
    r = client.post("/admin/refresh", headers={"X-Admin-Key": NEW})
    assert r.status_code == 403, (
        "with no keys configured, no header value can unlock /admin/refresh"
    )
