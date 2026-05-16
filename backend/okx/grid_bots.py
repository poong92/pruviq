"""
Grid bot — per-session CRUD + activation state.

Different paradigm from DCA + signal-based strategies:
- Bot owns a price range [lower_price, upper_price] divided into
  grid_count cells.
- N buy limit orders + N sell limit orders sit on the grid lines.
- A fill on one side immediately triggers an opposite-side replacement
  one grid above (long) / below (short) the filled price.
- Profits accumulate from variance within the range; trend moves beyond
  the range trap capital — `stop_loss_price` is the breach-out kill.

This module covers schema + CRUD only. The execution loop (limit-order
placement via OKX, fill detection via REST polling or WebSocket, rebalance
on each fill) is Phase E2 and lands separately so it can be reviewed +
backtested before any orders touch the exchange.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Optional

from .storage import _get_conn

logger = logging.getLogger("okx_grid_bots")


DEFAULT_GRID: dict[str, Any] = {
    "name": "Untitled Grid",
    "symbol": "BTC-USDT-SWAP",
    "direction": "neutral",         # long | short | neutral
    "upper_price": 0.0,
    "lower_price": 0.0,
    "grid_count": 20,
    "investment_usdt": 500.0,
    "leverage": 1,
    "stop_loss_price": 0.0,         # 0 = no SL
    "is_active": 0,
}

_VALID_DIRECTION = {"long", "short", "neutral"}

_BOUNDS = {
    "grid_count": (4, 100),
    "investment_usdt": (50.0, 50000.0),
    "leverage": (1, 10),
}


def validate_grid_params(p: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    if not isinstance(p.get("name"), str) or not p["name"].strip():
        errs.append("name: required")
    elif len(p["name"]) > 80:
        errs.append("name: max 80 chars")
    if not isinstance(p.get("symbol"), str) or "-" not in p.get("symbol", ""):
        errs.append("symbol: must look like 'BTC-USDT-SWAP'")
    if p.get("direction") not in _VALID_DIRECTION:
        errs.append("direction: must be 'long', 'short', or 'neutral'")
    for key, (lo, hi) in _BOUNDS.items():
        if key not in p:
            continue
        v = p[key]
        if not isinstance(v, (int, float)):
            errs.append(f"{key}: must be a number")
        elif v < lo or v > hi:
            errs.append(f"{key}: must be between {lo} and {hi}")
    up = p.get("upper_price")
    lo = p.get("lower_price")
    if not isinstance(up, (int, float)) or up <= 0:
        errs.append("upper_price: must be a positive number")
    if not isinstance(lo, (int, float)) or lo <= 0:
        errs.append("lower_price: must be a positive number")
    if (
        isinstance(up, (int, float))
        and isinstance(lo, (int, float))
        and up > 0
        and lo > 0
    ):
        if up <= lo:
            errs.append("upper_price must be > lower_price")
        else:
            spread_pct = (up - lo) / lo * 100.0
            if spread_pct < 1.0:
                errs.append(
                    f"grid range too narrow ({spread_pct:.2f}%) — "
                    "fees will eat profits; need ≥ 1%"
                )
    sl = p.get("stop_loss_price")
    if sl is not None and not isinstance(sl, (int, float)):
        errs.append("stop_loss_price: must be a number")
    elif isinstance(sl, (int, float)) and sl < 0:
        errs.append("stop_loss_price: must be non-negative (0 = disabled)")
    return errs


_GRID_COLUMNS = [
    "id", "session_id", "name", "symbol", "direction",
    "upper_price", "lower_price", "grid_count",
    "investment_usdt", "leverage", "stop_loss_price",
    "is_active", "created_at", "updated_at",
]


def _row_to_grid(row: tuple) -> dict[str, Any]:
    return dict(zip(_GRID_COLUMNS, row))


def _ensure_tables() -> None:
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS grid_bots (
                id              TEXT PRIMARY KEY,
                session_id      TEXT NOT NULL,
                name            TEXT NOT NULL,
                symbol          TEXT NOT NULL,
                direction       TEXT NOT NULL DEFAULT 'neutral',
                upper_price     REAL NOT NULL,
                lower_price     REAL NOT NULL,
                grid_count      INTEGER NOT NULL,
                investment_usdt REAL NOT NULL,
                leverage        INTEGER NOT NULL DEFAULT 1,
                stop_loss_price REAL NOT NULL DEFAULT 0,
                is_active       INTEGER NOT NULL DEFAULT 0,
                created_at      REAL NOT NULL,
                updated_at      REAL NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_grid_bots_session "
            "ON grid_bots(session_id)"
        )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS grid_orders (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id        TEXT NOT NULL,
                side          TEXT NOT NULL,
                price         REAL NOT NULL,
                size_usdt     REAL NOT NULL,
                okx_order_id  TEXT,
                status        TEXT NOT NULL DEFAULT 'pending',
                placed_at     REAL NOT NULL,
                filled_at     REAL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_grid_orders_bot "
            "ON grid_orders(bot_id)"
        )


def _merge_defaults(data: dict[str, Any]) -> dict[str, Any]:
    out = dict(DEFAULT_GRID)
    for k, v in data.items():
        if k in DEFAULT_GRID:
            out[k] = v
    return out


def create_grid_bot(session_id: str, data: dict[str, Any]) -> dict[str, Any]:
    _ensure_tables()
    merged = _merge_defaults(data)
    errs = validate_grid_params(merged)
    if errs:
        raise ValueError("; ".join(errs))
    bot_id = uuid.uuid4().hex
    now = time.time()
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO grid_bots ("
            "id, session_id, name, symbol, direction, upper_price, "
            "lower_price, grid_count, investment_usdt, leverage, "
            "stop_loss_price, is_active, created_at, updated_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
            (
                bot_id, session_id, merged["name"], merged["symbol"],
                merged["direction"], float(merged["upper_price"]),
                float(merged["lower_price"]), int(merged["grid_count"]),
                float(merged["investment_usdt"]), int(merged["leverage"]),
                float(merged["stop_loss_price"]), now, now,
            ),
        )
    logger.info("Grid bot created id=%s session=%s", bot_id[:8], session_id[:8])
    bot = get_grid_bot(bot_id, session_id)
    if bot is None:
        raise RuntimeError("grid bot vanished after insert")
    return bot


def get_grid_bot(bot_id: str, session_id: str) -> Optional[dict[str, Any]]:
    _ensure_tables()
    with _get_conn() as conn:
        row = conn.execute(
            f"SELECT {', '.join(_GRID_COLUMNS)} FROM grid_bots "
            "WHERE id = ? AND session_id = ?",
            (bot_id, session_id),
        ).fetchone()
    return _row_to_grid(row) if row else None


def list_grid_bots(session_id: str) -> list[dict[str, Any]]:
    _ensure_tables()
    with _get_conn() as conn:
        rows = conn.execute(
            f"SELECT {', '.join(_GRID_COLUMNS)} FROM grid_bots "
            "WHERE session_id = ? ORDER BY updated_at DESC, id",
            (session_id,),
        ).fetchall()
    return [_row_to_grid(r) for r in rows]


def update_grid_bot(
    bot_id: str, session_id: str, data: dict[str, Any]
) -> dict[str, Any]:
    existing = get_grid_bot(bot_id, session_id)
    if not existing:
        raise ValueError("grid bot not found")
    if existing["is_active"]:
        raise ValueError("cannot edit an active grid bot — deactivate first")
    merged = _merge_defaults({**existing, **data})
    errs = validate_grid_params(merged)
    if errs:
        raise ValueError("; ".join(errs))
    now = time.time()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE grid_bots SET "
            "name=?, symbol=?, direction=?, upper_price=?, lower_price=?, "
            "grid_count=?, investment_usdt=?, leverage=?, stop_loss_price=?, "
            "updated_at=? "
            "WHERE id=? AND session_id=?",
            (
                merged["name"], merged["symbol"], merged["direction"],
                float(merged["upper_price"]), float(merged["lower_price"]),
                int(merged["grid_count"]), float(merged["investment_usdt"]),
                int(merged["leverage"]), float(merged["stop_loss_price"]),
                now, bot_id, session_id,
            ),
        )
    updated = get_grid_bot(bot_id, session_id)
    if updated is None:
        raise RuntimeError("grid bot vanished after update")
    return updated


def delete_grid_bot(bot_id: str, session_id: str) -> bool:
    existing = get_grid_bot(bot_id, session_id)
    if not existing:
        return False
    if existing["is_active"]:
        raise ValueError("cannot delete an active grid bot — deactivate first")
    with _get_conn() as conn:
        conn.execute("DELETE FROM grid_orders WHERE bot_id = ?", (bot_id,))
        cur = conn.execute(
            "DELETE FROM grid_bots WHERE id = ? AND session_id = ?",
            (bot_id, session_id),
        )
        return cur.rowcount > 0


def activate_grid_bot(bot_id: str, session_id: str) -> dict[str, Any]:
    existing = get_grid_bot(bot_id, session_id)
    if not existing:
        raise ValueError("grid bot not found")
    now = time.time()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE grid_bots SET is_active = 1, updated_at = ? "
            "WHERE id = ? AND session_id = ?",
            (now, bot_id, session_id),
        )
    logger.info(
        "Grid bot activated id=%s session=%s", bot_id[:8], session_id[:8]
    )
    activated = get_grid_bot(bot_id, session_id)
    if activated is None:
        raise RuntimeError("grid bot vanished after activate")
    return activated


def deactivate_grid_bot(bot_id: str, session_id: str) -> dict[str, Any]:
    existing = get_grid_bot(bot_id, session_id)
    if not existing:
        raise ValueError("grid bot not found")
    now = time.time()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE grid_bots SET is_active = 0, updated_at = ? "
            "WHERE id = ? AND session_id = ?",
            (now, bot_id, session_id),
        )
    logger.info(
        "Grid bot deactivated id=%s session=%s", bot_id[:8], session_id[:8]
    )
    deactivated = get_grid_bot(bot_id, session_id)
    if deactivated is None:
        raise RuntimeError("grid bot vanished after deactivate")
    return deactivated


def list_grid_orders(bot_id: str, session_id: str) -> list[dict[str, Any]]:
    bot = get_grid_bot(bot_id, session_id)
    if not bot:
        return []
    _ensure_tables()
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT id, bot_id, side, price, size_usdt, okx_order_id, "
            "status, placed_at, filled_at FROM grid_orders "
            "WHERE bot_id = ? ORDER BY placed_at DESC, id DESC",
            (bot_id,),
        ).fetchall()
    return [
        {
            "id": r[0], "bot_id": r[1], "side": r[2], "price": r[3],
            "size_usdt": r[4], "okx_order_id": r[5], "status": r[6],
            "placed_at": r[7], "filled_at": r[8],
        }
        for r in rows
    ]


def compute_grid_lines(bot: dict[str, Any]) -> list[float]:
    """Return the grid_count + 1 price levels evenly spaced between
    lower_price and upper_price (inclusive). Used by both UI preview
    and the executor loop so they share one definition."""
    upper = float(bot["upper_price"])
    lower = float(bot["lower_price"])
    count = int(bot["grid_count"])
    if upper <= lower or count < 2:
        return []
    step = (upper - lower) / count
    return [lower + i * step for i in range(count + 1)]


def get_grid_bot_with_orders(
    bot_id: str, session_id: str
) -> Optional[dict[str, Any]]:
    bot = get_grid_bot(bot_id, session_id)
    if not bot:
        return None
    orders = list_grid_orders(bot_id, session_id)
    return {
        **bot,
        "orders": orders,
        "grid_lines": compute_grid_lines(bot),
        "per_grid_size_usdt": (
            float(bot["investment_usdt"]) / (2.0 * int(bot["grid_count"]))
            if int(bot["grid_count"]) > 0
            else 0.0
        ),
    }
