"""
Manual API key paste auth path — regression guards.

Owner shipped manual paste 2026-04-25 to unblock OKX trading without waiting
on Fast API approval. The trading critical path (auto_executor, orders,
reconciler, /execute/*) reads from get_api_credentials() which only checks
that the session row contains an `api_key`. Manual paste must produce a row
with bit-identical shape to OAuth output — otherwise the cap, idempotency,
and /halt killswitch silently bypass.

Tests:
  1. Source guard — module imports save_session, references client.get_balance,
     and contains no `bare except`.
  2. Happy path — valid creds → session_id + storage round-trip.
  3. Rejection — OKX-side error (50111 Invalid Sign) → ValueError surfaces it
     under `invalid_credentials:` prefix and writes nothing to storage.
  4. Input validation — empty / oversize fields short-circuit before OKXClient.
"""
from __future__ import annotations

import os
import re
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

MANUAL_AUTH_PY = BACKEND / "okx" / "manual_auth.py"


def test_source_imports_save_session_and_get_balance_no_bare_except():
    """The implementation must reuse storage.save_session (single SSoT) and
    OKXClient.get_balance (single auth primitive). bare-except would silently
    swallow OKX errors — explicitly forbidden by CLAUDE.md rule 5."""
    src = MANUAL_AUTH_PY.read_text(encoding="utf-8")
    assert re.search(r"from\s+\.storage\s+import\s+.*save_session", src), (
        "manual_auth.py must import save_session from .storage — no parallel "
        "credential store. Found imports do not include save_session."
    )
    assert "client.get_balance" in src or ".get_balance(" in src, (
        "manual_auth.py must call OKXClient.get_balance to validate creds "
        "before persisting them. Reference not found."
    )
    # bare `except:` and `except Exception:` (no name) are forbidden — both
    # would mask OKX errors that we MUST surface to the user.
    assert not re.search(r"^\s*except\s*:\s*$", src, re.M), (
        "bare `except:` found — must catch specific exception types."
    )
    assert not re.search(r"^\s*except\s+Exception\s*:\s*$", src, re.M), (
        "bare `except Exception:` (without `as e`) is forbidden — silently "
        "swallowing OKX failures defeats the validation step."
    )


@pytest.mark.anyio
async def test_validate_and_store_happy_path(monkeypatch):
    """Valid creds → OKXClient.get_balance returns → save_session persists →
    round-trip via get_session yields identical credential dict."""
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["OKX_DB_PATH"] = str(Path(tmp) / "test.db")
        # Fernet key for storage.encrypt — Fernet.generate_key()-equivalent.
        os.environ["OKX_ENCRYPTION_KEY"] = (
            "ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM1Pg="
        )
        # Reload modules to pick up env. config first so storage/manual_auth
        # re-capture OKX_ENCRYPTION_KEY etc. (other tests reload config too).
        import importlib
        import okx.config as config_mod
        import okx.storage as storage
        import okx.manual_auth as manual_auth
        import okx.client as client_mod
        importlib.reload(config_mod)
        importlib.reload(storage)
        importlib.reload(manual_auth)

        async def fake_get_balance(self, ccy: str = "USDT"):
            return [{"ccy": "USDT", "bal": "100", "avail_bal": "100"}]

        async def fake_close(self):
            return None

        monkeypatch.setattr(client_mod.OKXClient, "get_balance", fake_get_balance)
        monkeypatch.setattr(client_mod.OKXClient, "close", fake_close)

        api_key = "okx-fake-key-1234567890abcdef-aaaa"
        secret = "okx-fake-secret-1234567890abcdef"
        passphrase = "Pa$$w0rd!"

        sid = await manual_auth.validate_and_store(api_key, secret, passphrase)
        assert isinstance(sid, str) and len(sid) >= 32

        creds = storage.get_session(sid)
        assert creds is not None
        assert creds["api_key"] == api_key
        assert creds["secret_key"] == secret
        assert creds["passphrase"] == passphrase
        assert creds["perm"] == "manual_paste"
        assert "created_at" in creds

    os.environ.pop("OKX_DB_PATH", None)
    os.environ.pop("OKX_ENCRYPTION_KEY", None)


@pytest.mark.anyio
async def test_validate_and_store_rejects_invalid_credentials(monkeypatch):
    """OKX returns code 50111 'Invalid Sign' → OKXClient raises
    ValueError('OKX API error 50111: ...') → manual_auth must re-raise as
    ValueError starting with 'invalid_credentials:' AND must NOT call
    save_session (so a bad-creds attempt leaves no row behind)."""
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["OKX_DB_PATH"] = str(Path(tmp) / "test.db")
        os.environ["OKX_ENCRYPTION_KEY"] = (
            "ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM1Pg="
        )
        import importlib
        import okx.config as config_mod
        import okx.storage as storage
        import okx.manual_auth as manual_auth
        import okx.client as client_mod
        importlib.reload(config_mod)
        importlib.reload(storage)
        importlib.reload(manual_auth)

        save_calls: list = []
        original_save = storage.save_session

        def tracked_save(session_id, data):
            save_calls.append(session_id)
            return original_save(session_id, data)

        monkeypatch.setattr(storage, "save_session", tracked_save)
        # manual_auth imported save_session from .storage — patch its module
        # binding too (Python's `from X import Y` copies the reference).
        monkeypatch.setattr(manual_auth, "save_session", tracked_save)

        async def failing_get_balance(self, ccy: str = "USDT"):
            raise ValueError("OKX API error 50111: Invalid Sign")

        async def fake_close(self):
            return None

        monkeypatch.setattr(client_mod.OKXClient, "get_balance", failing_get_balance)
        monkeypatch.setattr(client_mod.OKXClient, "close", fake_close)

        with pytest.raises(ValueError) as exc_info:
            await manual_auth.validate_and_store(
                "okx-fake-key-1234567890abcdef-aaaa",
                "okx-fake-secret-1234567890abcdef",
                "Pa$$w0rd!",
            )

        msg = str(exc_info.value)
        assert msg.startswith("invalid_credentials:"), (
            f"error must start with 'invalid_credentials:' so the HTTP layer "
            f"can surface it; got: {msg!r}"
        )
        assert "50111" in msg or "Invalid Sign" in msg, (
            f"OKX-side error code/message must be preserved for debugging; "
            f"got: {msg!r}"
        )
        assert save_calls == [], (
            f"save_session must NOT be called on rejection — got calls: "
            f"{save_calls}"
        )

    os.environ.pop("OKX_DB_PATH", None)
    os.environ.pop("OKX_ENCRYPTION_KEY", None)


@pytest.mark.anyio
async def test_validate_and_store_input_validation_short_circuits(monkeypatch):
    """Empty / oversize inputs must reject BEFORE OKXClient is even
    instantiated — protects OKX rate limit + reduces attack surface."""
    import okx.client as client_mod
    import okx.manual_auth as manual_auth

    instantiated: list = []
    original_init = client_mod.OKXClient.__init__

    def tracked_init(self, *args, **kwargs):
        instantiated.append((args, kwargs))
        return original_init(self, *args, **kwargs)

    monkeypatch.setattr(client_mod.OKXClient, "__init__", tracked_init)

    # Empty fields
    for empty in ("", "   ", None):
        with pytest.raises(ValueError) as exc_info:
            await manual_auth.validate_and_store(empty, "x" * 30, "x" * 12)
        assert "missing_field" in str(exc_info.value)

    # Oversize api_key
    with pytest.raises(ValueError) as exc_info:
        await manual_auth.validate_and_store("x" * 1000, "x" * 30, "x" * 12)
    assert "malformed_field" in str(exc_info.value)

    # Undersize passphrase
    with pytest.raises(ValueError) as exc_info:
        await manual_auth.validate_and_store("x" * 30, "x" * 30, "ab")
    assert "malformed_field" in str(exc_info.value)

    assert instantiated == [], (
        f"OKXClient must not be instantiated when input fails validation; "
        f"got {len(instantiated)} instantiations: {instantiated}"
    )
