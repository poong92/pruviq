"""
Fernet multi-key rotation regression guard (PR 2026-04-19).

architecture-audit HIGH #9: single-key `OKX_ENCRYPTION_KEY` had no rotation
path. Key leak forced ALL users to re-OAuth. Now:

  - `OKX_ENCRYPTION_KEYS=new,old` uses `MultiFernet` (encrypt under new,
    decrypt under either)
  - `migrate_okx_encryption_keys.py --apply` re-encrypts every row under
    the newest key
  - After migration, operator drops old key from env

Tested behaviour:
  1. Single-key mode still works (back-compat)
  2. Multi-key decrypts both old and new
  3. New writes encrypt under newest key
  4. `rotate()` re-encrypts old rows under new key
  5. Bad keys in OKX_ENCRYPTION_KEYS are skipped, not fatal
"""
from __future__ import annotations

import importlib
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from cryptography.fernet import Fernet


def _fresh_storage(tmp_db: str, old_key: str | None, keys: str | None):
    """Reload okx.config + okx.storage with a clean env."""
    os.environ["OKX_DB_PATH"] = tmp_db
    for k in ("OKX_ENCRYPTION_KEY", "OKX_ENCRYPTION_KEYS"):
        os.environ.pop(k, None)
    if old_key:
        os.environ["OKX_ENCRYPTION_KEY"] = old_key
    if keys:
        os.environ["OKX_ENCRYPTION_KEYS"] = keys
    import okx.config as cfg
    import okx.storage as storage
    importlib.reload(cfg)
    importlib.reload(storage)
    return storage


def test_single_key_still_works():
    """Back-compat: operators without KEYS env keep using KEY."""
    k = Fernet.generate_key().decode()
    with tempfile.TemporaryDirectory() as tmp:
        db = str(Path(tmp) / "a.db")
        storage = _fresh_storage(db, old_key=k, keys=None)
        enc = storage._encrypt({"api_key": "k1"})
        dec = storage._decrypt(enc)
        assert dec == {"api_key": "k1"}


def test_multi_key_encrypts_under_newest_decrypts_either():
    """Rotation mode: writes under new_key, reads tolerant of both."""
    old = Fernet.generate_key().decode()
    new = Fernet.generate_key().decode()
    with tempfile.TemporaryDirectory() as tmp:
        db = str(Path(tmp) / "b.db")
        # Phase 1: single-key old
        storage = _fresh_storage(db, old_key=old, keys=None)
        old_ciphertext = storage._encrypt({"api_key": "pre-rotation"})

        # Phase 2: reload with both keys (new first) — old ciphertext must
        # still decrypt, and new writes use new_key.
        storage = _fresh_storage(db, old_key=None, keys=f"{new},{old}")
        assert storage._decrypt(old_ciphertext) == {"api_key": "pre-rotation"}
        new_ciphertext = storage._encrypt({"api_key": "post-rotation"})
        assert storage._decrypt(new_ciphertext) == {"api_key": "post-rotation"}
        # The new ciphertext must be decryptable under new_key alone (proof
        # new writes are under new_key, not old_key).
        storage2 = _fresh_storage(db, old_key=None, keys=new)
        assert storage2._decrypt(new_ciphertext) == {"api_key": "post-rotation"}
        # And the old ciphertext must FAIL under new_key alone.
        import cryptography.fernet as fm
        with pytest.raises(fm.InvalidToken):
            storage2._decrypt(old_ciphertext)


def test_migration_script_rotates_all_rows():
    """migrate_okx_encryption_keys.py --apply rotates existing rows."""
    old = Fernet.generate_key().decode()
    new = Fernet.generate_key().decode()
    with tempfile.TemporaryDirectory() as tmp:
        db = str(Path(tmp) / "c.db")

        # Seed 3 sessions under old key
        storage = _fresh_storage(db, old_key=old, keys=None)
        import time
        with storage._get_conn() as conn:
            for i in range(3):
                enc = storage._encrypt({"api_key": f"k{i}"})
                conn.execute(
                    "INSERT INTO okx_sessions "
                    "(session_id, user_data, created_at, updated_at) "
                    "VALUES (?, ?, ?, ?)",
                    (f"sess-{i}", enc, time.time(), time.time()),
                )

        # Reload with both keys and run migration
        _fresh_storage(db, old_key=None, keys=f"{new},{old}")
        import importlib
        import scripts.migrate_okx_encryption_keys as mig
        importlib.reload(mig)
        stats = mig.rotate_rows(apply_changes=True)
        assert stats["total"] == 3
        assert stats["rotated"] == 3
        assert stats["failed"] == 0

        # Now reload with new_key ONLY — all rows must still decrypt.
        storage = _fresh_storage(db, old_key=None, keys=new)
        with storage._get_conn() as conn:
            rows = conn.execute(
                "SELECT session_id, user_data FROM okx_sessions"
            ).fetchall()
        assert len(rows) == 3
        for sess_id, token in rows:
            assert storage._decrypt(token)["api_key"].startswith("k")


def test_bad_key_in_keys_env_is_skipped_not_fatal():
    """A malformed key in the comma list logs + skips, doesn't break the rest."""
    good = Fernet.generate_key().decode()
    bad = "not-a-valid-fernet-key"
    with tempfile.TemporaryDirectory() as tmp:
        db = str(Path(tmp) / "d.db")
        storage = _fresh_storage(db, old_key=None, keys=f"{good},{bad}")
        # _fernet should be built from good only (single Fernet after skip)
        assert storage._fernet is not None
        enc = storage._encrypt({"api_key": "x"})
        assert storage._decrypt(enc) == {"api_key": "x"}


def test_all_bad_keys_disables_encryption():
    """If every key is invalid, _fernet is None — no silent half-encryption."""
    with tempfile.TemporaryDirectory() as tmp:
        db = str(Path(tmp) / "e.db")
        storage = _fresh_storage(db, old_key=None, keys="bad1,bad2")
        assert storage._fernet is None
        with pytest.raises(RuntimeError, match="not configured"):
            storage._encrypt({"k": "v"})


def test_keys_env_takes_precedence_over_key():
    """If both KEY and KEYS are set, KEYS wins (explicit rotation mode)."""
    k1 = Fernet.generate_key().decode()
    k2 = Fernet.generate_key().decode()
    with tempfile.TemporaryDirectory() as tmp:
        db = str(Path(tmp) / "f.db")
        storage = _fresh_storage(db, old_key=k1, keys=k2)
        enc = storage._encrypt({"k": "v"})
        # Should decrypt under k2 only
        storage2 = _fresh_storage(db, old_key=None, keys=k2)
        assert storage2._decrypt(enc) == {"k": "v"}
        # Not under k1
        storage3 = _fresh_storage(db, old_key=k1, keys=None)
        import cryptography.fernet as fm
        with pytest.raises(fm.InvalidToken):
            storage3._decrypt(enc)


def test_whitespace_and_trailing_comma_tolerated():
    """Operator can leave `KEYS=new,` to mark phase-out without empty token."""
    k = Fernet.generate_key().decode()
    with tempfile.TemporaryDirectory() as tmp:
        db = str(Path(tmp) / "g.db")
        storage = _fresh_storage(db, old_key=None, keys=f" {k} , ")
        assert storage._fernet is not None
        enc = storage._encrypt({"x": 1})
        assert storage._decrypt(enc) == {"x": 1}


@pytest.fixture(autouse=True)
def _cleanup_env():
    yield
    for k in ("OKX_DB_PATH", "OKX_ENCRYPTION_KEY", "OKX_ENCRYPTION_KEYS"):
        os.environ.pop(k, None)
