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
    """Bot list with two computed liveness fields per row:
      - `last_fill_at` (epoch sec) or 0 if no fills
      - `hours_since_last_fill` (float) — useful to flag stale active bots

    Computed in one extra LEFT JOIN so the dashboard list can render
    "active 36h with no fills" warnings without N+1 queries.
    """
    _ensure_tables()
    with _get_conn() as conn:
        rows = conn.execute(
            f"SELECT {', '.join('b.' + c for c in _DCA_COLUMNS)}, "
            "       MAX(f.filled_at) AS last_fill_at "
            "FROM dca_bots b "
            "LEFT JOIN dca_fills f ON f.bot_id = b.id "
            "WHERE b.session_id = ? "
            "GROUP BY b.id "
            "ORDER BY b.updated_at DESC, b.id",
            (session_id,),
        ).fetchall()
    now = time.time()
    out: list[dict[str, Any]] = []
    for r in rows:
        bot = _row_to_dca(r[: len(_DCA_COLUMNS)])
        last_fill_at = r[len(_DCA_COLUMNS)] or 0.0
        bot["last_fill_at"] = float(last_fill_at) if last_fill_at else 0.0
        bot["hours_since_last_fill"] = (
            (now - last_fill_at) / 3600.0 if last_fill_at else -1.0
        )
        out.append(bot)
    return out


def session_dca_summary(session_id: str, hours: int = 24) -> dict[str, Any]:
    """Rolling-window activity KPIs for the dashboard. Returns counts +
    a rough simulated P&L estimate. The P&L is approximate: each
    tp_closed fill contributes `fill_size_usdt × bot.tp_pct / 100`
    which is exact for paper mode (the loop closes at avg × (1+tp))
    and directionally right for any future real mode. Real numbers
    will come from a future fills.realized_pnl column."""
    _ensure_tables()
    hours = max(1, min(int(hours), 168))  # cap at 7 days
    cutoff = time.time() - hours * 3600
    with _get_conn() as conn:
        # Counts grouped by base/safety/tp
        rows = conn.execute(
            """
            SELECT f.order_num, f.status, f.fill_size_usdt, b.tp_pct
            FROM dca_fills f
            JOIN dca_bots b ON b.id = f.bot_id
            WHERE b.session_id = ? AND f.filled_at >= ?
            """,
            (session_id, cutoff),
        ).fetchall()
        active = conn.execute(
            "SELECT COUNT(*) FROM dca_bots "
            "WHERE session_id = ? AND is_active = 1",
            (session_id,),
        ).fetchone()[0]
        # Cumulative max-notional exposure across ALL active bots — sum of
        # each bot's cap (base × (m^(n+1)-1)/(m-1) for m≠1, base × (n+1)
        # for m=1). Mirrors validate_dca_params so the number matches the
        # backend 50k-per-bot cap math. Real safety value: owner sees
        # "$X total max exposure" without doing the multiplication by hand.
        active_rows = conn.execute(
            "SELECT position_size_usdt, size_multiplier, max_safety_orders "
            "FROM dca_bots WHERE session_id = ? AND is_active = 1",
            (session_id,),
        ).fetchall()
        open_bots = conn.execute(
            """
            SELECT COUNT(DISTINCT f.bot_id)
            FROM dca_fills f
            JOIN dca_bots b ON b.id = f.bot_id
            WHERE b.session_id = ? AND f.status = 'open'
            """,
            (session_id,),
        ).fetchone()[0]
    base = safety = tp_closes = 0
    paper_pnl = 0.0
    for order_num, status, size, tp_pct in rows:
        if status == "tp_closed":
            tp_closes += 1
            paper_pnl += float(size) * float(tp_pct) / 100.0
        elif order_num == 0:
            base += 1
        else:
            safety += 1

    # Cumulative max-notional across all active bots
    cumulative_max_exposure = 0.0
    for base_size, mult, max_safe in active_rows:
        try:
            b = float(base_size)
            m = float(mult)
            n = int(max_safe)
            if b > 0 and n >= 0 and m > 0:
                cumulative_max_exposure += (
                    b * (n + 1) if abs(m - 1.0) < 1e-9
                    else b * (m ** (n + 1) - 1.0) / (m - 1.0)
                )
        except (TypeError, ValueError, OverflowError):
            # Skip bots with malformed params; doesn't affect the sum for
            # well-formed peers. validate_dca_params guards on the way in
            # so this branch is defensive only.
            continue

    return {
        "window_hours": hours,
        "total_fills": base + safety + tp_closes,
        "base_fills": base,
        "safety_fills": safety,
        "tp_closes": tp_closes,
        "active_bots": int(active),
        "bots_with_open_position": int(open_bots),
        "paper_pnl_usdt": round(paper_pnl, 2),
        "cumulative_max_exposure_usdt": round(cumulative_max_exposure, 2),
    }


def recent_dca_fills(session_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Cross-bot fills feed for the dashboard. Joins dca_fills × dca_bots
    so each row carries enough context (bot name, symbol, direction) to
    render without a second query per row."""
    _ensure_tables()
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT f.id, f.bot_id, f.order_num, f.fill_price, f.fill_size_usdt,
                   f.okx_order_id, f.filled_at, f.status,
                   b.name AS bot_name, b.symbol, b.direction, b.paper_mode
            FROM dca_fills f
            JOIN dca_bots b ON b.id = f.bot_id
            WHERE b.session_id = ?
            ORDER BY f.filled_at DESC
            LIMIT ?
            """,
            (session_id, max(1, min(limit, 100))),
        ).fetchall()
    return [
        {
            "id": r[0],
            "bot_id": r[1],
            "order_num": r[2],
            "fill_price": r[3],
            "fill_size_usdt": r[4],
            "okx_order_id": r[5],
            "filled_at": r[6],
            "status": r[7],
            "bot_name": r[8],
            "symbol": r[9],
            "direction": r[10],
            "paper_mode": bool(r[11]) if r[11] is not None else True,
        }
        for r in rows
    ]


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


def pause_all_dca_bots(session_id: str) -> dict[str, Any]:
    """User-facing emergency stop — deactivates every active DCA bot
    owned by this session in a single SQL UPDATE. Returns the number
    of bots flipped. Existing fills are NOT auto-closed; the loop
    simply stops adding new ones on the next tick.

    Use case: paper-mode dog-foot review uncovers a bad config, owner
    wants every bot paused at once instead of toggling each row.
    """
    _ensure_tables()
    now = time.time()
    with _get_conn() as conn:
        cur = conn.execute(
            "UPDATE dca_bots SET is_active = 0, updated_at = ? "
            "WHERE session_id = ? AND is_active = 1",
            (now, session_id),
        )
        paused = cur.rowcount
    if paused:
        logger.warning(
            "DCA pause-all session=%s paused=%d", session_id[:8], paused
        )
    return {"paused": paused}


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
    bot: dict[str, Any],
    mark_price: float,
    open_fills: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """Read-only computation: given a bot config + current mark + (optionally)
    its currently-open fills, what's the next trigger price, would the next
    safety order fire now, where is TP, and how far is mark from each?

    Two modes:
      - `open_fills` empty / None → "pre-activation" preview keyed off
        `base_price_usdt` (or mark when 0). Used in the Save/Test flow
        before the bot has any fills.
      - `open_fills` present → "running" preview keyed off the LAST fill
        price for the trigger and the weighted average for TP. Mirrors
        `dca_loop._tick_bot` exactly so the dashboard row's "next trigger"
        matches what the loop will actually evaluate against on its next
        tick. Without this, an active bot with 3 safeties would still
        show base-relative numbers and confuse owners during dog-foot.

    No DB writes, no orders.
    """
    direction = bot.get("direction", "long")
    step_pct = float(bot["price_step_pct"]) / 100.0
    tp_pct = float(bot["tp_pct"]) / 100.0
    stop = float(bot.get("stop_scaling_price", 0.0))
    base_price = float(bot.get("base_price_usdt", 0.0)) or mark_price

    running = bool(open_fills)
    if running:
        # Last fill = trigger reference; weighted avg = TP reference
        last_price = float(open_fills[-1]["fill_price"])
        total_size = sum(float(f["fill_size_usdt"]) for f in open_fills)
        weighted_avg = (
            sum(
                float(f["fill_price"]) * float(f["fill_size_usdt"])
                for f in open_fills
            )
            / total_size
            if total_size > 0
            else last_price
        )
        trigger_ref = last_price
        tp_ref = weighted_avg
    else:
        trigger_ref = base_price
        tp_ref = base_price
        weighted_avg = 0.0

    if direction == "long":
        next_trigger = trigger_ref * (1.0 - step_pct)
        tp_price = tp_ref * (1.0 + tp_pct)
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
        next_trigger = trigger_ref * (1.0 + step_pct)
        tp_price = tp_ref * (1.0 - tp_pct)
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
        "running": running,
        "weighted_avg_entry": weighted_avg,
        "open_fills_count": len(open_fills) if open_fills else 0,
        "next_trigger_price": next_trigger,
        "tp_price": tp_price,
        "distance_to_trigger_pct": distance_to_trigger_pct,
        "distance_to_tp_pct": distance_to_tp_pct,
        "would_fire_next_safety": would_fire_next,
        "scaling_halted": scaling_halted,
        "direction": direction,
    }
