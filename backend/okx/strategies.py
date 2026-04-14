"""
User strategy storage + manual approval queue.

Two tables:
  user_strategies   — per-user saved trading strategies (name, base_strategy,
                      exec_mode, sizing, leverage, SL/TP, risk limits).
                      Exactly one can be `is_active=1` per session.
  pending_signals   — manual-approval queue populated by auto_executor when
                      active strategy has exec_mode='approval'. User approves
                      or rejects via the router endpoints; expired rows are
                      swept by expire_old_signals().

All functions take a session_id so users can only see/edit their own rows.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Optional

from .storage import _get_conn

logger = logging.getLogger("okx_strategies")


# ── Schema + defaults ──────────────────────────────────────

DEFAULT_STRATEGY: dict[str, Any] = {
    "name": "Untitled",
    "base_strategy": "",
    "exec_mode": "auto",                      # auto | manual | approval
    "approval_timeout_sec": 600,
    "position_sizing_method": "fixed",         # fixed | multiplier
    "position_size_usdt": 100.0,
    "multiplier": 1.0,
    "leverage_source": "custom",              # follow_signal | custom
    "leverage": 1,
    "sl_source": "follow_signal",             # follow_signal | custom_pct
    "sl_pct": 10.0,
    "tp_source": "follow_signal",             # follow_signal | custom_pct | trailing
    "tp_pct": 8.0,
    "trail_pct": 3.0,
    "max_daily_loss_usdt": 200.0,
    "max_concurrent_pos": 3,
    "is_active": 0,
}


_VALID_EXEC_MODE = {"auto", "manual", "approval"}
_VALID_SIZING = {"fixed", "multiplier"}
_VALID_LEV_SRC = {"follow_signal", "custom"}
_VALID_SL_SRC = {"follow_signal", "custom_pct"}
_VALID_TP_SRC = {"follow_signal", "custom_pct", "trailing"}


def _ensure_tables() -> None:
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_strategies (
                id              TEXT PRIMARY KEY,
                session_id      TEXT NOT NULL,
                name            TEXT NOT NULL,
                base_strategy   TEXT NOT NULL,
                exec_mode       TEXT NOT NULL DEFAULT 'auto',
                approval_timeout_sec INTEGER DEFAULT 600,
                position_sizing_method TEXT NOT NULL DEFAULT 'fixed',
                position_size_usdt REAL DEFAULT 100,
                multiplier      REAL DEFAULT 1.0,
                leverage_source TEXT NOT NULL DEFAULT 'custom',
                leverage        INTEGER DEFAULT 1,
                sl_source       TEXT NOT NULL DEFAULT 'follow_signal',
                sl_pct          REAL DEFAULT 10,
                tp_source       TEXT NOT NULL DEFAULT 'follow_signal',
                tp_pct          REAL DEFAULT 8,
                trail_pct       REAL DEFAULT 3,
                max_daily_loss_usdt REAL DEFAULT 200,
                max_concurrent_pos  INTEGER DEFAULT 3,
                is_active       INTEGER DEFAULT 0,
                created_at      REAL NOT NULL,
                updated_at      REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_strategies_session
            ON user_strategies(session_id, is_active)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pending_signals (
                id              TEXT PRIMARY KEY,
                strategy_id     TEXT NOT NULL,
                session_id      TEXT NOT NULL,
                symbol          TEXT NOT NULL,
                direction       TEXT NOT NULL,
                base_strategy   TEXT NOT NULL,
                signal_price    REAL NOT NULL,
                signal_time     TEXT NOT NULL,
                suggested_params TEXT NOT NULL,
                expires_at      REAL NOT NULL,
                status          TEXT DEFAULT 'pending',
                user_override_params TEXT,
                created_at      REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_session
            ON pending_signals(session_id, status)
        """)


# ── Validation helpers ─────────────────────────────────────

def _validate_strategy(data: dict[str, Any], partial: bool = False) -> dict[str, Any]:
    """Validate + coerce strategy dict. `partial=True` skips required-field checks (used for update)."""
    out: dict[str, Any] = {}

    if not partial or "name" in data:
        name = str(data.get("name", DEFAULT_STRATEGY["name"])).strip()
        if not name:
            raise ValueError("name must not be empty")
        if len(name) > 100:
            raise ValueError("name exceeds 100 chars")
        out["name"] = name

    if not partial or "base_strategy" in data:
        base = str(data.get("base_strategy", "")).strip()
        if not base:
            raise ValueError("base_strategy required")
        out["base_strategy"] = base

    if "exec_mode" in data:
        v = str(data["exec_mode"])
        if v not in _VALID_EXEC_MODE:
            raise ValueError(f"exec_mode must be one of {sorted(_VALID_EXEC_MODE)}")
        out["exec_mode"] = v

    if "approval_timeout_sec" in data:
        v = int(data["approval_timeout_sec"])
        out["approval_timeout_sec"] = max(30, min(86400, v))

    if "position_sizing_method" in data:
        v = str(data["position_sizing_method"])
        if v not in _VALID_SIZING:
            raise ValueError(f"position_sizing_method must be one of {sorted(_VALID_SIZING)}")
        out["position_sizing_method"] = v

    if "position_size_usdt" in data:
        v = float(data["position_size_usdt"])
        out["position_size_usdt"] = max(1.0, min(100000.0, v))

    if "multiplier" in data:
        v = float(data["multiplier"])
        out["multiplier"] = max(0.01, min(100.0, v))

    if "leverage_source" in data:
        v = str(data["leverage_source"])
        if v not in _VALID_LEV_SRC:
            raise ValueError(f"leverage_source must be one of {sorted(_VALID_LEV_SRC)}")
        out["leverage_source"] = v

    if "leverage" in data:
        v = int(data["leverage"])
        out["leverage"] = max(1, min(125, v))

    if "sl_source" in data:
        v = str(data["sl_source"])
        if v not in _VALID_SL_SRC:
            raise ValueError(f"sl_source must be one of {sorted(_VALID_SL_SRC)}")
        out["sl_source"] = v

    if "sl_pct" in data:
        v = float(data["sl_pct"])
        out["sl_pct"] = max(0.01, min(100.0, v))

    if "tp_source" in data:
        v = str(data["tp_source"])
        if v not in _VALID_TP_SRC:
            raise ValueError(f"tp_source must be one of {sorted(_VALID_TP_SRC)}")
        out["tp_source"] = v

    if "tp_pct" in data:
        v = float(data["tp_pct"])
        out["tp_pct"] = max(0.01, min(1000.0, v))

    if "trail_pct" in data:
        v = float(data["trail_pct"])
        out["trail_pct"] = max(0.01, min(100.0, v))

    if "max_daily_loss_usdt" in data:
        v = float(data["max_daily_loss_usdt"])
        out["max_daily_loss_usdt"] = max(1.0, min(1000000.0, v))

    if "max_concurrent_pos" in data:
        v = int(data["max_concurrent_pos"])
        out["max_concurrent_pos"] = max(1, min(100, v))

    if "is_active" in data:
        out["is_active"] = 1 if bool(data["is_active"]) else 0

    return out


_STRATEGY_COLUMNS = [
    "id", "session_id", "name", "base_strategy", "exec_mode",
    "approval_timeout_sec", "position_sizing_method", "position_size_usdt",
    "multiplier", "leverage_source", "leverage", "sl_source", "sl_pct",
    "tp_source", "tp_pct", "trail_pct", "max_daily_loss_usdt",
    "max_concurrent_pos", "is_active", "created_at", "updated_at",
]


def _row_to_strategy(row: tuple) -> dict[str, Any]:
    return dict(zip(_STRATEGY_COLUMNS, row))


# ── Strategy CRUD ──────────────────────────────────────────

def create_strategy(session_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Create a new strategy. Returns the inserted row as dict."""
    _ensure_tables()
    validated = _validate_strategy(data, partial=False)
    merged = {**DEFAULT_STRATEGY, **validated}
    sid = uuid.uuid4().hex
    now = time.time()

    with _get_conn() as conn:
        conn.execute(
            """INSERT INTO user_strategies (
                id, session_id, name, base_strategy, exec_mode,
                approval_timeout_sec, position_sizing_method, position_size_usdt,
                multiplier, leverage_source, leverage, sl_source, sl_pct,
                tp_source, tp_pct, trail_pct, max_daily_loss_usdt,
                max_concurrent_pos, is_active, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                sid, session_id, merged["name"], merged["base_strategy"],
                merged["exec_mode"], merged["approval_timeout_sec"],
                merged["position_sizing_method"], merged["position_size_usdt"],
                merged["multiplier"], merged["leverage_source"],
                merged["leverage"], merged["sl_source"], merged["sl_pct"],
                merged["tp_source"], merged["tp_pct"], merged["trail_pct"],
                merged["max_daily_loss_usdt"], merged["max_concurrent_pos"],
                0,  # creation never auto-activates — must call activate_strategy
                now, now,
            ),
        )

    logger.info("Strategy created id=%s session=%s", sid[:8], session_id[:8])
    created = get_strategy(sid, session_id)
    if created is None:
        raise RuntimeError("strategy disappeared immediately after insert")
    return created


def get_strategies(session_id: str) -> list[dict[str, Any]]:
    """Return all strategies belonging to a session, newest first."""
    _ensure_tables()
    with _get_conn() as conn:
        rows = conn.execute(
            f"SELECT {', '.join(_STRATEGY_COLUMNS)} FROM user_strategies "
            "WHERE session_id = ? ORDER BY created_at DESC",
            (session_id,),
        ).fetchall()
    return [_row_to_strategy(r) for r in rows]


def get_strategy(strategy_id: str, session_id: str) -> Optional[dict[str, Any]]:
    """Return a single strategy if it belongs to the session, else None."""
    _ensure_tables()
    with _get_conn() as conn:
        row = conn.execute(
            f"SELECT {', '.join(_STRATEGY_COLUMNS)} FROM user_strategies "
            "WHERE id = ? AND session_id = ?",
            (strategy_id, session_id),
        ).fetchone()
    return _row_to_strategy(row) if row else None


def update_strategy(
    strategy_id: str, session_id: str, data: dict[str, Any]
) -> dict[str, Any]:
    """Partial update. Raises ValueError if strategy not found."""
    _ensure_tables()
    existing = get_strategy(strategy_id, session_id)
    if not existing:
        raise ValueError("strategy not found")

    validated = _validate_strategy(data, partial=True)
    if not validated:
        return existing

    # is_active is managed exclusively via activate_strategy — strip here
    validated.pop("is_active", None)

    if not validated:
        return existing

    set_clause = ", ".join(f"{k} = ?" for k in validated.keys())
    params: list[Any] = list(validated.values())
    params.extend([time.time(), strategy_id, session_id])

    with _get_conn() as conn:
        conn.execute(
            f"UPDATE user_strategies SET {set_clause}, updated_at = ? "
            "WHERE id = ? AND session_id = ?",
            params,
        )

    logger.info("Strategy updated id=%s session=%s fields=%s",
                strategy_id[:8], session_id[:8], list(validated.keys()))
    updated = get_strategy(strategy_id, session_id)
    if updated is None:
        raise RuntimeError("strategy disappeared during update")
    return updated


def delete_strategy(strategy_id: str, session_id: str) -> bool:
    """Delete a strategy. Returns True if deleted, False if not found."""
    _ensure_tables()
    with _get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM user_strategies WHERE id = ? AND session_id = ?",
            (strategy_id, session_id),
        )
        deleted = cur.rowcount > 0
    if deleted:
        logger.info("Strategy deleted id=%s session=%s", strategy_id[:8], session_id[:8])
    return deleted


def activate_strategy(strategy_id: str, session_id: str) -> dict[str, Any]:
    """Activate a strategy — deactivates all other strategies of the same session atomically."""
    _ensure_tables()
    existing = get_strategy(strategy_id, session_id)
    if not existing:
        raise ValueError("strategy not found")

    now = time.time()
    with _get_conn() as conn:
        # Deactivate all others, then activate this one — single transaction
        conn.execute(
            "UPDATE user_strategies SET is_active = 0, updated_at = ? "
            "WHERE session_id = ? AND id != ?",
            (now, session_id, strategy_id),
        )
        conn.execute(
            "UPDATE user_strategies SET is_active = 1, updated_at = ? "
            "WHERE id = ? AND session_id = ?",
            (now, strategy_id, session_id),
        )

    logger.info("Strategy activated id=%s session=%s", strategy_id[:8], session_id[:8])
    activated = get_strategy(strategy_id, session_id)
    if activated is None:
        raise RuntimeError("strategy disappeared during activate")
    return activated


def get_active_strategy(session_id: str) -> Optional[dict[str, Any]]:
    """Return the active strategy for a session, or None if none active."""
    _ensure_tables()
    with _get_conn() as conn:
        row = conn.execute(
            f"SELECT {', '.join(_STRATEGY_COLUMNS)} FROM user_strategies "
            "WHERE session_id = ? AND is_active = 1 LIMIT 1",
            (session_id,),
        ).fetchone()
    return _row_to_strategy(row) if row else None


# ── Pending signal queue ───────────────────────────────────

_PENDING_COLUMNS = [
    "id", "strategy_id", "session_id", "symbol", "direction", "base_strategy",
    "signal_price", "signal_time", "suggested_params", "expires_at",
    "status", "user_override_params", "created_at",
]


def _row_to_pending(row: tuple) -> dict[str, Any]:
    d = dict(zip(_PENDING_COLUMNS, row))
    # Decode JSON blobs
    try:
        d["suggested_params"] = json.loads(d["suggested_params"])
    except (TypeError, ValueError):
        d["suggested_params"] = {}
    if d.get("user_override_params"):
        try:
            d["user_override_params"] = json.loads(d["user_override_params"])
        except (TypeError, ValueError):
            d["user_override_params"] = None
    else:
        d["user_override_params"] = None
    return d


def create_pending_signal(
    strategy_id: str,
    session_id: str,
    signal: dict[str, Any],
    suggested_params: dict[str, Any],
    timeout_sec: int = 600,
) -> dict[str, Any]:
    """Enqueue a signal for manual approval. `signal` matches auto_executor's signal shape."""
    _ensure_tables()
    pid = uuid.uuid4().hex
    now = time.time()
    expires_at = now + max(30, int(timeout_sec))

    symbol = str(signal.get("coin") or signal.get("symbol") or "")
    direction = str(signal.get("direction", "long"))
    base_strategy = str(signal.get("strategy") or signal.get("base_strategy") or "")
    signal_price = float(signal.get("entry_price") or signal.get("price") or 0)
    signal_time = str(signal.get("signal_time", ""))

    with _get_conn() as conn:
        conn.execute(
            """INSERT INTO pending_signals (
                id, strategy_id, session_id, symbol, direction, base_strategy,
                signal_price, signal_time, suggested_params, expires_at,
                status, user_override_params, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                pid, strategy_id, session_id, symbol, direction, base_strategy,
                signal_price, signal_time, json.dumps(suggested_params),
                expires_at, "pending", None, now,
            ),
        )

    logger.info(
        "Pending signal created id=%s session=%s %s/%s expires_in=%ds",
        pid[:8], session_id[:8], base_strategy, symbol, int(timeout_sec),
    )
    created = _get_pending_by_id(pid, session_id)
    if created is None:
        raise RuntimeError("pending signal disappeared immediately after insert")
    return created


def _get_pending_by_id(signal_id: str, session_id: str) -> Optional[dict[str, Any]]:
    with _get_conn() as conn:
        row = conn.execute(
            f"SELECT {', '.join(_PENDING_COLUMNS)} FROM pending_signals "
            "WHERE id = ? AND session_id = ?",
            (signal_id, session_id),
        ).fetchone()
    return _row_to_pending(row) if row else None


def get_pending_signals(session_id: str) -> list[dict[str, Any]]:
    """Return all still-pending signals (not expired/approved/rejected), newest first."""
    _ensure_tables()
    # Sweep expired rows first so callers always see accurate status
    expire_old_signals()
    with _get_conn() as conn:
        rows = conn.execute(
            f"SELECT {', '.join(_PENDING_COLUMNS)} FROM pending_signals "
            "WHERE session_id = ? AND status = 'pending' "
            "ORDER BY created_at DESC",
            (session_id,),
        ).fetchall()
    return [_row_to_pending(r) for r in rows]


def approve_signal(
    signal_id: str,
    session_id: str,
    user_override_params: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Mark a pending signal as approved. Raises ValueError if not found or not pending."""
    _ensure_tables()
    existing = _get_pending_by_id(signal_id, session_id)
    if not existing:
        raise ValueError("pending signal not found")
    if existing["status"] != "pending":
        raise ValueError(f"signal status is '{existing['status']}' — only 'pending' can be approved")
    if existing["expires_at"] < time.time():
        raise ValueError("signal has expired")

    override_json = json.dumps(user_override_params) if user_override_params else None
    with _get_conn() as conn:
        conn.execute(
            "UPDATE pending_signals SET status = 'approved', user_override_params = ? "
            "WHERE id = ? AND session_id = ?",
            (override_json, signal_id, session_id),
        )

    logger.info("Signal approved id=%s session=%s", signal_id[:8], session_id[:8])
    result = _get_pending_by_id(signal_id, session_id)
    if result is None:
        raise RuntimeError("signal disappeared during approve")
    return result


def reject_signal(signal_id: str, session_id: str) -> dict[str, Any]:
    """Mark a pending signal as rejected. Raises ValueError if not found or not pending."""
    _ensure_tables()
    existing = _get_pending_by_id(signal_id, session_id)
    if not existing:
        raise ValueError("pending signal not found")
    if existing["status"] != "pending":
        raise ValueError(f"signal status is '{existing['status']}' — only 'pending' can be rejected")

    with _get_conn() as conn:
        conn.execute(
            "UPDATE pending_signals SET status = 'rejected' "
            "WHERE id = ? AND session_id = ?",
            (signal_id, session_id),
        )

    logger.info("Signal rejected id=%s session=%s", signal_id[:8], session_id[:8])
    result = _get_pending_by_id(signal_id, session_id)
    if result is None:
        raise RuntimeError("signal disappeared during reject")
    return result


def expire_old_signals() -> int:
    """Mark all expired pending signals as 'expired'. Returns number of rows updated."""
    _ensure_tables()
    now = time.time()
    with _get_conn() as conn:
        cur = conn.execute(
            "UPDATE pending_signals SET status = 'expired' "
            "WHERE status = 'pending' AND expires_at < ?",
            (now,),
        )
        count = cur.rowcount
    if count:
        logger.info("Expired %d pending signal(s)", count)
    return count
