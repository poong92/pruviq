"""
DCA (Dollar-Cost-Averaging) bot — per-session CRUD + activation state.

Different paradigm from `user_strategies` (which is signal-based):
- DCA opens a base position at user-specified base_price_usdt.
- When price drops by price_step_pct, the bot places another buy
  whose size is prev_size × size_multiplier ("safety order").
- The new fill lowers the average entry; TP fires at tp_pct above the
  running average.
- Caps: max_safety_orders, stop_scaling_price (extreme-bear gate).

This module covers ONLY the data model + CRUD. The execution loop
(price polling → trigger orders → TP/SL → liquidation guard) and
backtest simulator are separate modules (dca_loop.py, dca_backtest.py)
introduced in their own PRs so each can be reviewed independently.

Storage shares the same SQLite db as user_strategies (storage._get_conn).
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Optional

from .storage import _get_conn

logger = logging.getLogger("okx_dca_bots")


# ── Schema + defaults ──────────────────────────────────────

DEFAULT_DCA: dict[str, Any] = {
    "name": "Untitled DCA",
    "symbol": "BTC-USDT-SWAP",
    "direction": "long",                 # long | short
    "base_price_usdt": 0.0,              # 0 = "use market price at activation"
    "position_size_usdt": 50.0,
    "leverage": 1,
    "price_step_pct": 2.0,               # 2% price drop triggers next safety
    "size_multiplier": 1.0,              # equal-size additions
    "max_safety_orders": 5,
    "tp_pct": 3.0,                       # 3% above average → TP
    "stop_scaling_price": 0.0,           # 0 = no floor; else stop adding below
    "is_active": 0,
    "paper_mode": 1,                     # 1 = simulated fills only (default, safe)
}

_VALID_DIRECTION = {"long", "short"}

# Hard bounds enforced by validate_dca_params. Outside these we 400.
_BOUNDS = {
    "position_size_usdt": (1.0, 5000.0),
    "leverage": (1, 125),
    "price_step_pct": (0.1, 20.0),
    "size_multiplier": (0.5, 3.0),
    "max_safety_orders": (1, 20),
    "tp_pct": (0.1, 50.0),
}


_SYMBOL_RE = __import__("re").compile(
    r"^[A-Z0-9]{2,12}-USDT(?:-SWAP)?$"
)


def validate_dca_params(p: dict[str, Any]) -> list[str]:
    """Return list of human-readable validation errors (empty = ok)."""
    errs: list[str] = []
    if not isinstance(p.get("name"), str) or not p["name"].strip():
        errs.append("name: required")
    elif len(p["name"]) > 80:
        errs.append("name: max 80 chars")
    sym = p.get("symbol")
    if not isinstance(sym, str) or not _SYMBOL_RE.match(sym):
        errs.append(
            "symbol: must match '<BASE>-USDT' or '<BASE>-USDT-SWAP' "
            "(e.g. BTC-USDT-SWAP); only A-Z0-9 in BASE"
        )
    if p.get("direction") not in _VALID_DIRECTION:
        errs.append("direction: must be 'long' or 'short'")
    for key, (lo, hi) in _BOUNDS.items():
        if key not in p:
            continue
        v = p[key]
        if not isinstance(v, (int, float)):
            errs.append(f"{key}: must be a number")
        elif v < lo or v > hi:
            errs.append(f"{key}: must be between {lo} and {hi}")
    if p.get("base_price_usdt") is not None:
        bp = p["base_price_usdt"]
        if not isinstance(bp, (int, float)) or bp < 0:
            errs.append("base_price_usdt: must be a non-negative number")
    if p.get("stop_scaling_price") is not None:
        sp = p["stop_scaling_price"]
        if not isinstance(sp, (int, float)) or sp < 0:
            errs.append("stop_scaling_price: must be a non-negative number")

    # Cumulative position cap.
    # With size_multiplier=m and max_safety_orders=n, total notional placed
    # over a full cycle is `base × (m^(n+1) - 1) / (m - 1)` for m != 1, or
    # `base × (n + 1)` for m == 1. Without this guard, m=3, n=20 yields
    # ~17 billion USDT — the per-fill bound check alone misses it.
    # Cap at 50,000 USDT to keep dog-foot + future real-mode within a
    # sane account size; high-end users can raise per-bot via PUT (future).
    try:
        base = float(p.get("position_size_usdt", 0.0))
        m = float(p.get("size_multiplier", 1.0))
        n = int(p.get("max_safety_orders", 0))
        if base > 0 and n >= 0 and m > 0:
            if abs(m - 1.0) < 1e-9:
                cumulative = base * (n + 1)
            else:
                cumulative = base * (m ** (n + 1) - 1.0) / (m - 1.0)
            if cumulative > 50_000.0:
                errs.append(
                    f"cumulative_position_usdt={cumulative:.0f} exceeds "
                    "50,000 cap — lower size_multiplier or max_safety_orders"
                )
    except (TypeError, ValueError, OverflowError):
        errs.append("cumulative_position calc failed — check numeric inputs")

    return errs


_DCA_COLUMNS = [
    "id", "session_id", "name", "symbol", "direction",
    "base_price_usdt", "position_size_usdt", "leverage",
    "price_step_pct", "size_multiplier", "max_safety_orders",
    "tp_pct", "stop_scaling_price",
    "is_active", "created_at", "updated_at", "paper_mode",
]


def _row_to_dca(row: tuple) -> dict[str, Any]:
    return dict(zip(_DCA_COLUMNS, row))


def _ensure_tables() -> None:
    import sqlite3 as _sqlite3
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS dca_bots (
                id                    TEXT PRIMARY KEY,
                session_id            TEXT NOT NULL,
                name                  TEXT NOT NULL,
                symbol                TEXT NOT NULL,
                direction             TEXT NOT NULL DEFAULT 'long',
                base_price_usdt       REAL NOT NULL DEFAULT 0,
                position_size_usdt    REAL NOT NULL,
                leverage              INTEGER NOT NULL DEFAULT 1,
                price_step_pct        REAL NOT NULL,
                size_multiplier       REAL NOT NULL DEFAULT 1.0,
                max_safety_orders     INTEGER NOT NULL,
                tp_pct                REAL NOT NULL,
                stop_scaling_price    REAL NOT NULL DEFAULT 0,
                is_active             INTEGER NOT NULL DEFAULT 0,
                created_at            REAL NOT NULL,
                updated_at            REAL NOT NULL,
                paper_mode            INTEGER NOT NULL DEFAULT 1
            )
        """)
        # Migration for older DBs without paper_mode column.
        try:
            conn.execute(
                "ALTER TABLE dca_bots ADD COLUMN paper_mode INTEGER NOT NULL DEFAULT 1"
            )
        except _sqlite3.OperationalError as e:
            if "duplicate column" not in str(e).lower():
                raise
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_dca_bots_session "
            "ON dca_bots(session_id)"
        )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS dca_fills (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id        TEXT NOT NULL,
                order_num     INTEGER NOT NULL,
                fill_price    REAL NOT NULL,
                fill_size_usdt REAL NOT NULL,
                okx_order_id  TEXT,
                filled_at     REAL NOT NULL,
                status        TEXT NOT NULL DEFAULT 'open'
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_dca_fills_bot "
            "ON dca_fills(bot_id)"
        )
        # Race guard: prevent two dca_loop ticks (in case uvicorn ever runs
        # with --workers >1) from inserting duplicate base/safety fills for
        # the same bot+order_num. Duplicate inserts will raise IntegrityError
        # the caller can catch + log.
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_dca_fills_bot_order "
            "ON dca_fills(bot_id, order_num)"
        )


def _merge_defaults(data: dict[str, Any]) -> dict[str, Any]:
    out = dict(DEFAULT_DCA)
    for k, v in data.items():
        if k in DEFAULT_DCA:
            out[k] = v
    return out


# ── CRUD ───────────────────────────────────────────────────

def create_dca_bot(session_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Insert a new DCA bot for this session (is_active starts at 0)."""
    _ensure_tables()
    merged = _merge_defaults(data)
    errs = validate_dca_params(merged)
    if errs:
        raise ValueError("; ".join(errs))
    bot_id = uuid.uuid4().hex
    now = time.time()
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO dca_bots ("
            "id, session_id, name, symbol, direction, base_price_usdt, "
            "position_size_usdt, leverage, price_step_pct, size_multiplier, "
            "max_safety_orders, tp_pct, stop_scaling_price, "
            "is_active, created_at, updated_at, paper_mode"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
            (
                bot_id, session_id, merged["name"], merged["symbol"],
                merged["direction"], float(merged["base_price_usdt"]),
                float(merged["position_size_usdt"]), int(merged["leverage"]),
                float(merged["price_step_pct"]),
                float(merged["size_multiplier"]),
                int(merged["max_safety_orders"]),
                float(merged["tp_pct"]),
                float(merged["stop_scaling_price"]),
                now, now,
                1 if merged.get("paper_mode", 1) else 0,
            ),
        )
    logger.info("DCA bot created id=%s session=%s", bot_id[:8], session_id[:8])
    bot = get_dca_bot(bot_id, session_id)
    if bot is None:
        raise RuntimeError("dca bot vanished after insert")
    return bot


def get_dca_bot(bot_id: str, session_id: str) -> Optional[dict[str, Any]]:
    _ensure_tables()
    with _get_conn() as conn:
        row = conn.execute(
            f"SELECT {', '.join(_DCA_COLUMNS)} FROM dca_bots "
            "WHERE id = ? AND session_id = ?",
            (bot_id, session_id),
        ).fetchone()
    return _row_to_dca(row) if row else None


def list_dca_bots(session_id: str) -> list[dict[str, Any]]:
    _ensure_tables()
    with _get_conn() as conn:
        rows = conn.execute(
            f"SELECT {', '.join(_DCA_COLUMNS)} FROM dca_bots "
            "WHERE session_id = ? ORDER BY updated_at DESC, id",
            (session_id,),
        ).fetchall()
    return [_row_to_dca(r) for r in rows]


def update_dca_bot(
    bot_id: str, session_id: str, data: dict[str, Any]
) -> dict[str, Any]:
    """Partial update — only allowed when bot is inactive.
    Editing an active bot mid-flight would invalidate running fills and
    confuse the executor's running-average math, so we reject 409-style.
    """
    existing = get_dca_bot(bot_id, session_id)
    if not existing:
        raise ValueError("dca bot not found")
    if existing["is_active"]:
        raise ValueError("cannot edit an active dca bot — deactivate first")
    merged = _merge_defaults({**existing, **data})
    errs = validate_dca_params(merged)
    if errs:
        raise ValueError("; ".join(errs))
    now = time.time()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE dca_bots SET "
            "name=?, symbol=?, direction=?, base_price_usdt=?, "
            "position_size_usdt=?, leverage=?, price_step_pct=?, "
            "size_multiplier=?, max_safety_orders=?, tp_pct=?, "
            "stop_scaling_price=?, paper_mode=?, updated_at=? "
            "WHERE id=? AND session_id=?",
            (
                merged["name"], merged["symbol"], merged["direction"],
                float(merged["base_price_usdt"]),
                float(merged["position_size_usdt"]),
                int(merged["leverage"]),
                float(merged["price_step_pct"]),
                float(merged["size_multiplier"]),
                int(merged["max_safety_orders"]),
                float(merged["tp_pct"]),
                float(merged["stop_scaling_price"]),
                1 if merged.get("paper_mode", 1) else 0,
                now, bot_id, session_id,
            ),
        )
    updated = get_dca_bot(bot_id, session_id)
    if updated is None:
        raise RuntimeError("dca bot vanished after update")
    return updated


def delete_dca_bot(bot_id: str, session_id: str) -> bool:
    """Delete bot + cascade fills.
    Refuses if active — caller must deactivate first.
    """
    existing = get_dca_bot(bot_id, session_id)
    if not existing:
        return False
    if existing["is_active"]:
        raise ValueError("cannot delete an active dca bot — deactivate first")
    with _get_conn() as conn:
        conn.execute(
            "DELETE FROM dca_fills WHERE bot_id = ?", (bot_id,),
        )
        cur = conn.execute(
            "DELETE FROM dca_bots WHERE id = ? AND session_id = ?",
            (bot_id, session_id),
        )
        return cur.rowcount > 0


def activate_dca_bot(bot_id: str, session_id: str) -> dict[str, Any]:
    """Flip is_active = 1. The execution loop (separate module) will pick
    this up on its next tick and place the base order.
    Note: unlike user_strategies, DCA bots are always multi-active —
    different symbols / directions can coexist.
    """
    existing = get_dca_bot(bot_id, session_id)
    if not existing:
        raise ValueError("dca bot not found")
    now = time.time()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE dca_bots SET is_active = 1, updated_at = ? "
            "WHERE id = ? AND session_id = ?",
            (now, bot_id, session_id),
        )
    logger.info("DCA bot activated id=%s session=%s", bot_id[:8], session_id[:8])
    activated = get_dca_bot(bot_id, session_id)
    if activated is None:
        raise RuntimeError("dca bot vanished after activate")
    return activated


def deactivate_dca_bot(bot_id: str, session_id: str) -> dict[str, Any]:
    """Flip is_active = 0. Existing fills are NOT auto-closed — the user
    must explicitly close positions on the exchange or use a future
    `/dca-bots/:id/close` endpoint (separate PR).
    """
    existing = get_dca_bot(bot_id, session_id)
    if not existing:
        raise ValueError("dca bot not found")
    now = time.time()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE dca_bots SET is_active = 0, updated_at = ? "
            "WHERE id = ? AND session_id = ?",
            (now, bot_id, session_id),
        )
    logger.info(
        "DCA bot deactivated id=%s session=%s", bot_id[:8], session_id[:8]
    )
    deactivated = get_dca_bot(bot_id, session_id)
    if deactivated is None:
        raise RuntimeError("dca bot vanished after deactivate")
    return deactivated


# ── Fill tracking (used by the executor loop, exposed for read-only API) ──

def list_dca_fills(bot_id: str, session_id: str) -> list[dict[str, Any]]:
    """Return all fills for a bot owned by this session, oldest first."""
    bot = get_dca_bot(bot_id, session_id)
    if not bot:
        return []
    _ensure_tables()
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT id, bot_id, order_num, fill_price, fill_size_usdt, "
            "okx_order_id, filled_at, status FROM dca_fills "
            "WHERE bot_id = ? ORDER BY order_num, id",
            (bot_id,),
        ).fetchall()
    return [
        {
            "id": r[0], "bot_id": r[1], "order_num": r[2],
            "fill_price": r[3], "fill_size_usdt": r[4],
            "okx_order_id": r[5], "filled_at": r[6], "status": r[7],
        }
        for r in rows
    ]


def get_dca_bot_with_fills(
    bot_id: str, session_id: str
) -> Optional[dict[str, Any]]:
    """Bot detail + fills + computed running average / current safety order
    count — used by the dashboard detail view.
    """
    bot = get_dca_bot(bot_id, session_id)
    if not bot:
        return None
    fills = list_dca_fills(bot_id, session_id)
    open_fills = [f for f in fills if f["status"] == "open"]
    if open_fills:
        total_usdt = sum(f["fill_size_usdt"] for f in open_fills)
        # Average entry weighted by usdt size (notional-weighted)
        avg_entry = (
            sum(f["fill_price"] * f["fill_size_usdt"] for f in open_fills)
            / total_usdt
            if total_usdt > 0
            else 0.0
        )
    else:
        total_usdt = 0.0
        avg_entry = 0.0
    return {
        **bot,
        "fills": fills,
        "open_position_usdt": total_usdt,
        "avg_entry_price": avg_entry,
        "safety_orders_used": max(0, len(open_fills) - 1) if open_fills else 0,
    }


def compute_preview(
    bot: dict[str, Any], mark_price: float
) -> dict[str, Any]:
    """Read-only computation: given a bot config and current mark price,
    what's the next trigger price, would the next safety order fire now,
    where is the TP, and how far is mark from each?

    No DB writes, no orders. Used by GET /dca-bots/:id/preview so the user
    can dry-run their config against live market data before flipping
    is_active on. Math mirrors the simulator + executor.
    """
    direction = bot.get("direction", "long")
    base_price = float(bot.get("base_price_usdt", 0.0)) or mark_price
    step_pct = float(bot["price_step_pct"]) / 100.0
    tp_pct = float(bot["tp_pct"]) / 100.0
    stop = float(bot.get("stop_scaling_price", 0.0))

    if direction == "long":
        next_trigger = base_price * (1.0 - step_pct)
        tp_price = base_price * (1.0 + tp_pct)
        distance_to_trigger_pct = (
            (mark_price - next_trigger) / mark_price * 100.0
            if mark_price > 0
            else 0.0
        )
        distance_to_tp_pct = (
            (tp_price - mark_price) / mark_price * 100.0
            if mark_price > 0
            else 0.0
        )
        would_fire_next = mark_price <= next_trigger
        scaling_halted = stop > 0 and mark_price <= stop
    else:  # short
        next_trigger = base_price * (1.0 + step_pct)
        tp_price = base_price * (1.0 - tp_pct)
        distance_to_trigger_pct = (
            (next_trigger - mark_price) / mark_price * 100.0
            if mark_price > 0
            else 0.0
        )
        distance_to_tp_pct = (
            (mark_price - tp_price) / mark_price * 100.0
            if mark_price > 0
            else 0.0
        )
        would_fire_next = mark_price >= next_trigger
        scaling_halted = stop > 0 and mark_price >= stop

    return {
        "mark_price": mark_price,
        "base_price": base_price,
        "next_trigger_price": next_trigger,
        "tp_price": tp_price,
        "distance_to_trigger_pct": distance_to_trigger_pct,
        "distance_to_tp_pct": distance_to_tp_pct,
        "would_fire_next_safety": would_fire_next,
        "scaling_halted": scaling_halted,
        "direction": direction,
    }
