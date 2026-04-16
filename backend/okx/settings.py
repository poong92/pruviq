"""
User trading settings — stored in encrypted SQLite.
Each OKX session has its own trading configuration.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from typing import Any

from .storage import _get_conn

logger = logging.getLogger("okx_settings")

# ── Schema ──────────────────────────────────────────────

DEFAULT_SETTINGS: dict[str, Any] = {
    "strategies": [],          # e.g. ["bb-squeeze-short", "momentum-long"]
    "coins": [],               # e.g. ["BTCUSDT", "ETHUSDT"]
    "position_size_usdt": 100,  # per trade (used when position_size_mode=fixed)
    "position_size_mode": "fixed",  # fixed | percent
    "position_size_pct": 5,    # % of account balance per trade (used when mode=percent)
    "leverage": 1,             # 1-125
    "td_mode": "isolated",     # isolated or cross
    "max_concurrent": 3,       # max open positions
    "max_daily_trades": 20,    # safety limit
    "max_per_trade_usdt": 200.0,  # hard cap per single trade (execution-time safety)
    "daily_loss_limit_usdt": 200,  # stop trading if daily loss exceeds
    "execution_mode": "manual",    # manual | alert | auto
    "enabled": False,          # master switch
    "alert_telegram_chat_id": "",  # personal Telegram chat ID for alert mode
}


def _ensure_table() -> None:
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS trading_settings (
                session_id TEXT PRIMARY KEY,
                settings   TEXT NOT NULL,
                updated_at REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS trade_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT NOT NULL,
                signal      TEXT NOT NULL,
                result      TEXT NOT NULL,
                pnl_usdt    REAL DEFAULT 0,
                created_at  REAL NOT NULL,
                pnl_synced  INTEGER DEFAULT 1
            )
        """)
        # Additive migration: add pnl_synced column for tables created before this field existed.
        # SQLite does not support "IF NOT EXISTS" on ALTER TABLE ADD COLUMN, so we catch the
        # OperationalError("duplicate column name") that is raised when the column already exists.
        try:
            conn.execute("ALTER TABLE trade_log ADD COLUMN pnl_synced INTEGER DEFAULT 1")
        except sqlite3.OperationalError as e:
            if "duplicate column" not in str(e).lower():
                raise
        # Signal deduplication: prevents the same signal from executing twice
        # across 5-minute auto-trading loop cycles
        conn.execute("""
            CREATE TABLE IF NOT EXISTS executed_signals (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT NOT NULL,
                strategy    TEXT NOT NULL,
                coin        TEXT NOT NULL,
                signal_time TEXT NOT NULL,
                executed_at REAL NOT NULL,
                UNIQUE(session_id, strategy, coin, signal_time)
            )
        """)
        # Cleanup index for old executed_signals (>24h)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_executed_signals_ts
            ON executed_signals(executed_at)
        """)


def get_settings(session_id: str) -> dict[str, Any]:
    """Get user trading settings, returns defaults if not set."""
    _ensure_table()
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT settings FROM trading_settings WHERE session_id = ?",
            (session_id,),
        ).fetchone()
    if not row:
        return {**DEFAULT_SETTINGS}
    stored = json.loads(row[0])
    # Merge with defaults for any new fields
    return {**DEFAULT_SETTINGS, **stored}


def save_settings(session_id: str, settings: dict[str, Any]) -> dict[str, Any]:
    """Save user trading settings. Validates and returns saved settings."""
    _ensure_table()
    # Validate
    validated = {**DEFAULT_SETTINGS}
    if "strategies" in settings:
        validated["strategies"] = list(settings["strategies"])
    if "coins" in settings:
        validated["coins"] = [c.upper() for c in settings["coins"]]
    if "position_size_usdt" in settings:
        val = float(settings["position_size_usdt"])
        validated["position_size_usdt"] = max(1, min(5000, val))
    if "position_size_mode" in settings and settings["position_size_mode"] in ("fixed", "percent"):
        validated["position_size_mode"] = settings["position_size_mode"]
    if "position_size_pct" in settings:
        val = float(settings["position_size_pct"])
        validated["position_size_pct"] = max(1, min(20, val))
    if "leverage" in settings:
        val = int(settings["leverage"])
        validated["leverage"] = max(1, min(125, val))
    if "td_mode" in settings and settings["td_mode"] in ("isolated", "cross"):
        validated["td_mode"] = settings["td_mode"]
    if "max_concurrent" in settings:
        val = int(settings["max_concurrent"])
        validated["max_concurrent"] = max(1, min(10, val))
    if "max_daily_trades" in settings:
        val = int(settings["max_daily_trades"])
        validated["max_daily_trades"] = max(1, min(50, val))
    if "max_per_trade_usdt" in settings:
        val = float(settings["max_per_trade_usdt"])
        if val <= 0:
            raise ValueError("max_per_trade_usdt must be > 0")
        validated["max_per_trade_usdt"] = max(1.0, min(10000.0, val))
    if "daily_loss_limit_usdt" in settings:
        val = float(settings["daily_loss_limit_usdt"])
        validated["daily_loss_limit_usdt"] = max(50, min(5000, val))
    if "execution_mode" in settings and settings["execution_mode"] in (
        "manual", "alert", "auto"
    ):
        validated["execution_mode"] = settings["execution_mode"]
    if "enabled" in settings:
        validated["enabled"] = bool(settings["enabled"])
    if "alert_telegram_chat_id" in settings:
        chat_id = str(settings["alert_telegram_chat_id"]).strip()
        # Basic validation: must be numeric or start with @ (channel username)
        if chat_id and not (chat_id.lstrip("-").isdigit() or chat_id.startswith("@")):
            raise ValueError("alert_telegram_chat_id must be a numeric chat ID or @username")
        validated["alert_telegram_chat_id"] = chat_id

    with _get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO trading_settings "
            "(session_id, settings, updated_at) VALUES (?, ?, ?)",
            (session_id, json.dumps(validated), time.time()),
        )

    logger.info("Settings saved for session %s", session_id[:8])
    return validated


# ── Trade Log ───────────────────────────────────────────

def log_trade(session_id: str, signal: dict, result: dict, pnl: float = 0) -> None:
    """Log an executed trade."""
    _ensure_table()
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO trade_log (session_id, signal, result, pnl_usdt, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (session_id, json.dumps(signal), json.dumps(result), pnl, time.time()),
        )


def get_trade_log(session_id: str, limit: int = 50) -> list[dict]:
    """Get recent trades for a session."""
    _ensure_table()
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT signal, result, pnl_usdt, created_at FROM trade_log "
            "WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
    return [
        {
            "signal": json.loads(r[0]),
            "result": json.loads(r[1]),
            "pnl_usdt": r[2],
            "timestamp": r[3],
        }
        for r in rows
    ]


def get_daily_stats(session_id: str) -> dict:
    """Get today's trading stats for safety checks."""
    _ensure_table()
    # Start of today (UTC)
    import datetime
    today_start = datetime.datetime.now(datetime.timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).timestamp()

    with _get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(pnl_usdt), 0) FROM trade_log "
            "WHERE session_id = ? AND created_at >= ?",
            (session_id, today_start),
        ).fetchone()
    return {
        "trades_today": row[0],
        "pnl_today": row[1],
    }


# ── Active Sessions (for auto-execution worker) ─────────

def get_auto_sessions() -> list[str]:
    """Get all session IDs with auto-execution enabled."""
    _ensure_table()
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT session_id, settings FROM trading_settings"
        ).fetchall()
    result = []
    for session_id, settings_json in rows:
        settings = json.loads(settings_json)
        if settings.get("enabled") and settings.get("execution_mode") == "auto":
            result.append(session_id)
    return result


def is_signal_executed(session_id: str, strategy: str, coin: str, signal_time: str) -> bool:
    """Check if this exact signal has already been executed for this session."""
    _ensure_table()
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM executed_signals "
            "WHERE session_id=? AND strategy=? AND coin=? AND signal_time=?",
            (session_id, strategy, coin, signal_time),
        ).fetchone()
    return row is not None


def mark_signal_executed(session_id: str, strategy: str, coin: str, signal_time: str) -> None:
    """Mark a signal as executed. Silently ignores duplicate (UNIQUE constraint)."""
    _ensure_table()
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO executed_signals "
            "(session_id, strategy, coin, signal_time, executed_at) VALUES (?,?,?,?,?)",
            (session_id, strategy, coin, signal_time, time.time()),
        )
    # Prune records older than 24h to prevent unbounded growth
    cutoff = time.time() - 86400
    with _get_conn() as conn:
        conn.execute("DELETE FROM executed_signals WHERE executed_at < ?", (cutoff,))


def get_alert_sessions() -> list[tuple[str, str]]:
    """Get all session IDs with alert mode enabled. Returns [(session_id, chat_id), ...]."""
    _ensure_table()
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT session_id, settings FROM trading_settings"
        ).fetchall()
    result = []
    for session_id, settings_json in rows:
        settings = json.loads(settings_json)
        if (
            settings.get("enabled")
            and settings.get("execution_mode") == "alert"
        ):
            chat_id = settings.get("alert_telegram_chat_id", "")
            result.append((session_id, chat_id))
    return result
