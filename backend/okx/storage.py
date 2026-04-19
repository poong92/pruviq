"""
Fernet-encrypted SQLite storage for OKX OAuth sessions.
Tokens are AES-encrypted at rest — never stored in plaintext.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from .config import OKX_DB_PATH, OKX_ENCRYPTION_KEY

logger = logging.getLogger("okx_storage")

_fernet: Fernet | None = None
if OKX_ENCRYPTION_KEY:
    try:
        _fernet = Fernet(OKX_ENCRYPTION_KEY.encode())
    except Exception:
        logger.error("Invalid OKX_ENCRYPTION_KEY — token encryption disabled")


def _db_path() -> str:
    if OKX_DB_PATH:
        return OKX_DB_PATH
    return str(Path(__file__).resolve().parent.parent / "data" / "okx_sessions.db")


def _get_conn() -> sqlite3.Connection:
    path = _db_path()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=5.0)
    conn.execute("PRAGMA journal_mode=WAL")
    # busy_timeout: if two connections race (uvicorn + reconciler + settings
    # writer), SQLite returns SQLITE_BUSY immediately by default. With WAL
    # this is rare but not impossible — the reconciler flush + a user-driven
    # /execute/order in the same tick can both hold brief write locks.
    # 5000ms covers typical contention without hanging the request.
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS okx_sessions (
            session_id TEXT PRIMARY KEY,
            user_data  TEXT NOT NULL,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS okx_csrf_states (
            state      TEXT PRIMARY KEY,
            redirect_url TEXT NOT NULL DEFAULT '',
            lang       TEXT NOT NULL DEFAULT 'en',
            created_at REAL NOT NULL
        )
    """)
    return conn


def _encrypt(data: dict) -> str:
    if not _fernet:
        raise RuntimeError("OKX_ENCRYPTION_KEY not configured")
    return _fernet.encrypt(json.dumps(data).encode()).decode()


def _decrypt(token: str) -> dict:
    if not _fernet:
        raise RuntimeError("OKX_ENCRYPTION_KEY not configured")
    return json.loads(_fernet.decrypt(token.encode()).decode())


# ── Sessions ────────────────────────────────────────────────

def save_session(session_id: str, tokens: dict) -> None:
    encrypted = _encrypt(tokens)
    now = time.time()
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO okx_sessions "
            "(session_id, user_data, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (session_id, encrypted, now, now),
        )


def get_session(session_id: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT user_data FROM okx_sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
    if not row:
        return None
    try:
        return _decrypt(row[0])
    except InvalidToken:
        logger.error("Failed to decrypt session %s", session_id[:8])
        return None


def update_session(session_id: str, tokens: dict) -> None:
    encrypted = _encrypt(tokens)
    with _get_conn() as conn:
        conn.execute(
            "UPDATE okx_sessions SET user_data = ?, updated_at = ? WHERE session_id = ?",
            (encrypted, time.time(), session_id),
        )


def delete_session(session_id: str) -> None:
    with _get_conn() as conn:
        conn.execute("DELETE FROM okx_sessions WHERE session_id = ?", (session_id,))


# ── CSRF States ─────────────────────────────────────────────

CSRF_TTL = 1800  # 30 minutes


def save_csrf_state(state: str, redirect_url: str, lang: str = "en") -> None:
    with _get_conn() as conn:
        # Cleanup expired states on write
        conn.execute(
            "DELETE FROM okx_csrf_states WHERE created_at < ?",
            (time.time() - CSRF_TTL,),
        )
        conn.execute(
            "INSERT INTO okx_csrf_states (state, redirect_url, lang, created_at) "
            "VALUES (?, ?, ?, ?)",
            (state, redirect_url, lang, time.time()),
        )


def validate_csrf_state(state: str) -> tuple[str, str] | None:
    """Validate and consume CSRF state. Returns (redirect_url, lang) or None."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT redirect_url, lang, created_at FROM okx_csrf_states WHERE state = ?",
            (state,),
        ).fetchone()
        if not row:
            return None
        # Consume (one-time use)
        conn.execute("DELETE FROM okx_csrf_states WHERE state = ?", (state,))
        # Check expiry
        if time.time() - row[2] > CSRF_TTL:
            return None
        return row[0], row[1]
