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

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from .config import OKX_DB_PATH, OKX_ENCRYPTION_KEY, OKX_ENCRYPTION_KEYS

logger = logging.getLogger("okx_storage")


def _build_fernet() -> MultiFernet | Fernet | None:
    """Build the active Fernet (or MultiFernet) from env.

    Precedence:
      1. OKX_ENCRYPTION_KEYS (comma-separated, newest first) — rotation mode
      2. OKX_ENCRYPTION_KEY (single key) — legacy / steady state

    MultiFernet encrypts new data with the first key; decrypts by trying each
    in order. Empty/whitespace keys are skipped so an operator can set
    `OKX_ENCRYPTION_KEYS=new,` (trailing comma) without breakage during
    phase-out.
    """
    if OKX_ENCRYPTION_KEYS:
        raw_keys = [k.strip() for k in OKX_ENCRYPTION_KEYS.split(",") if k.strip()]
        fernets: list[Fernet] = []
        for idx, k in enumerate(raw_keys):
            try:
                fernets.append(Fernet(k.encode()))
            except Exception as e:
                # One bad key must not take down the rest — log and skip.
                logger.error(
                    "OKX_ENCRYPTION_KEYS[%d] is invalid (%s) — skipping",
                    idx, e.__class__.__name__,
                )
        if not fernets:
            logger.error(
                "OKX_ENCRYPTION_KEYS set but all keys invalid — "
                "token encryption disabled"
            )
            return None
        if len(fernets) == 1:
            return fernets[0]
        return MultiFernet(fernets)
    if OKX_ENCRYPTION_KEY:
        try:
            return Fernet(OKX_ENCRYPTION_KEY.encode())
        except Exception:
            logger.error("Invalid OKX_ENCRYPTION_KEY — token encryption disabled")
    return None


_fernet: MultiFernet | Fernet | None = _build_fernet()


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
            created_at REAL NOT NULL,
            code_verifier TEXT NOT NULL DEFAULT ''
        )
    """)
    # Migration for pre-PKCE schemas (column added 2026-04-25). SQLite has no
    # `IF NOT EXISTS` for ADD COLUMN — catch the duplicate-column error and
    # let any other OperationalError bubble up.
    try:
        conn.execute(
            "ALTER TABLE okx_csrf_states ADD COLUMN code_verifier TEXT NOT NULL DEFAULT ''"
        )
    except sqlite3.OperationalError as e:
        if "duplicate column" not in str(e).lower():
            raise
    # Phase 2.1: trailing-stop algo tracking. Mutable state separate from the
    # immutable merkle audit leaf — leaf records the entry fill (one per
    # position), this table records the trailing-leg lifecycle (arm → live →
    # cancelled/triggered) so close detection can cancel the sibling and
    # restart-recovery can reconcile against /api/v5/trade/orders-algo-pending.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS okx_trailing_algos (
            algo_id        TEXT PRIMARY KEY,
            session_id     TEXT NOT NULL,
            inst_id        TEXT NOT NULL,
            signal_id      TEXT,
            parent_ord_id  TEXT,
            callback_ratio TEXT NOT NULL,
            ts_iso         TEXT NOT NULL,
            state          TEXT NOT NULL DEFAULT 'live'
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_trailing_session ON okx_trailing_algos(session_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_trailing_parent ON okx_trailing_algos(parent_ord_id)"
    )
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
    logger.info("OKX session saved: %s", session_id[:8])


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
    """Delete the session row and cascade any per-session bot state.

    Without this cascade, dca_bots + grid_bots rows with is_active=1 left
    pointing at a deleted session keep running in the dca_loop / future
    grid_loop, generating paper fills nobody can ever see (the owner
    session that could query them is gone). Over time → unbounded DB
    growth + log spam. See debugger audit scenario 7.
    """
    with _get_conn() as conn:
        # Capture bot ids first so we can fan out to their child tables
        dca_ids = [
            r[0] for r in conn.execute(
                "SELECT id FROM dca_bots WHERE session_id = ?", (session_id,)
            ).fetchall()
        ]
        grid_ids = [
            r[0] for r in conn.execute(
                "SELECT id FROM grid_bots WHERE session_id = ?", (session_id,)
            ).fetchall()
        ]
        for table, ids in (("dca_fills", dca_ids), ("grid_orders", grid_ids)):
            if ids:
                placeholders = ",".join("?" * len(ids))
                conn.execute(
                    f"DELETE FROM {table} WHERE bot_id IN ({placeholders})",
                    ids,
                )
        conn.execute("DELETE FROM dca_bots WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM grid_bots WHERE session_id = ?", (session_id,))
        # Per-session trading config + strategies + pending queue also belong
        # to the departing user.
        conn.execute("DELETE FROM trading_settings WHERE session_id = ?", (session_id,))
        try:
            conn.execute("DELETE FROM user_strategies WHERE session_id = ?", (session_id,))
        except Exception:
            # Table may not exist if upgrade ordering differs in dev DBs.
            pass
        try:
            conn.execute("DELETE FROM pending_signals WHERE session_id = ?", (session_id,))
        except Exception:
            pass
        conn.execute("DELETE FROM okx_sessions WHERE session_id = ?", (session_id,))


def count_sessions() -> dict:
    """Return total connected user count and most recent connect time."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*), MAX(created_at) FROM okx_sessions"
        ).fetchone()
    return {"total": row[0], "last_connected_at": row[1]}


# ── CSRF States ─────────────────────────────────────────────

CSRF_TTL = 1800  # 30 minutes


def save_csrf_state(
    state: str,
    redirect_url: str,
    lang: str = "en",
    code_verifier: str = "",
) -> None:
    with _get_conn() as conn:
        # Cleanup expired states on write
        conn.execute(
            "DELETE FROM okx_csrf_states WHERE created_at < ?",
            (time.time() - CSRF_TTL,),
        )
        conn.execute(
            "INSERT INTO okx_csrf_states "
            "(state, redirect_url, lang, created_at, code_verifier) "
            "VALUES (?, ?, ?, ?, ?)",
            (state, redirect_url, lang, time.time(), code_verifier),
        )


def validate_csrf_state(state: str) -> tuple[str, str, str] | None:
    """Validate and consume CSRF state.

    Returns (redirect_url, lang, code_verifier) or None.
    code_verifier is "" for non-PKCE legacy rows.
    """
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT redirect_url, lang, created_at, code_verifier "
            "FROM okx_csrf_states WHERE state = ?",
            (state,),
        ).fetchone()
        if not row:
            return None
        # Consume (one-time use)
        conn.execute("DELETE FROM okx_csrf_states WHERE state = ?", (state,))
        # Check expiry
        if time.time() - row[2] > CSRF_TTL:
            return None
        return row[0], row[1], row[3]


# ── Trailing-stop algo orders (Phase 2.1) ───────────────────


def insert_trailing_algo(
    *,
    algo_id: str,
    session_id: str,
    inst_id: str,
    callback_ratio: str,
    ts_iso: str,
    signal_id: str | None = None,
    parent_ord_id: str | None = None,
) -> None:
    """Persist a freshly-armed trailing algo order so close-detection and
    restart-recovery have something to reconcile against."""
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO okx_trailing_algos "
            "(algo_id, session_id, inst_id, signal_id, parent_ord_id, "
            " callback_ratio, ts_iso, state) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'live')",
            (
                algo_id, session_id, inst_id, signal_id, parent_ord_id,
                callback_ratio, ts_iso,
            ),
        )


def find_trailing_by_parent(parent_ord_id: str) -> dict | None:
    """Return the trailing algo armed against a given entry order, if any.

    Used by close-detection to cancel the sibling — when the entry order's
    position closes (SL hit, manual close, OKX-managed exit), the trailing
    leg becomes orphaned on OKX. We cancel it to keep the user's algo-list
    clean and to avoid a stale algo firing if OKX delays its own cleanup.
    """
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT algo_id, session_id, inst_id, signal_id, parent_ord_id, "
            " callback_ratio, ts_iso, state "
            "FROM okx_trailing_algos WHERE parent_ord_id = ? AND state = 'live'",
            (parent_ord_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "algo_id": row[0],
        "session_id": row[1],
        "inst_id": row[2],
        "signal_id": row[3],
        "parent_ord_id": row[4],
        "callback_ratio": row[5],
        "ts_iso": row[6],
        "state": row[7],
    }


def update_trailing_state(algo_id: str, state: str) -> None:
    """Mark a trailing algo as cancelled / triggered. State is intentionally
    a free-form string — caller passes the OKX state verbatim ('cancelled',
    'effective', 'order_failed', etc.) so the audit trail keeps the original
    OKX vocabulary rather than our re-interpreted one."""
    with _get_conn() as conn:
        conn.execute(
            "UPDATE okx_trailing_algos SET state = ? WHERE algo_id = ?",
            (state, algo_id),
        )


def list_live_trailing_algos(session_id: str | None = None) -> list[dict]:
    """Return all currently-live trailing algos. Used by restart-recovery
    to sweep against /api/v5/trade/orders-algo-pending — any live row whose
    algoId is no longer pending on OKX has been cleared by OKX (triggered or
    cancelled) and we update our state to match."""
    with _get_conn() as conn:
        if session_id:
            rows = conn.execute(
                "SELECT algo_id, session_id, inst_id, parent_ord_id, callback_ratio "
                "FROM okx_trailing_algos WHERE state = 'live' AND session_id = ?",
                (session_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT algo_id, session_id, inst_id, parent_ord_id, callback_ratio "
                "FROM okx_trailing_algos WHERE state = 'live'"
            ).fetchall()
    return [
        {
            "algo_id": r[0],
            "session_id": r[1],
            "inst_id": r[2],
            "parent_ord_id": r[3],
            "callback_ratio": r[4],
        }
        for r in rows
    ]
