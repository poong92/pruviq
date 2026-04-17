"""
PRUVIQ OKX — Merkle audit log (Moat-2).

Every successful OKX order contributes a leaf hash. The daily Merkle root
is published at /trust/merkle/{YYYYMMDD} so a user who kept their own
(session_id, ts, symbol, side, qty, price, broker_code) tuple can verify
their leaf was included in that day's root — meaning their order was
recorded and not selectively hidden.

Design (explicitly NOT a blockchain):
- Canonical leaf: sha256("|".join([session_id, ts_iso, inst_id, side, sz,
  fill_price, broker_code])).  String-based so reproducible by user scripts.
- Tree: standard pairwise sha256; odd last leaf duplicates itself.
- Storage: a single `order_audit` table in the OKX SQLite. We compute the
  root on-demand from that table; there's no need to cache a tree the way
  Bitcoin does.
- Privacy: we do NOT publish the leaves. Users only see their own pre-image
  because they kept it themselves. External observers see only the root.
"""
from __future__ import annotations

import hashlib
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from .storage import _get_conn

logger = logging.getLogger("okx_merkle")


def _ensure_audit_table() -> None:
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS order_audit (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id   TEXT NOT NULL,
                ts_iso       TEXT NOT NULL,
                inst_id      TEXT NOT NULL,
                side         TEXT NOT NULL,
                sz           TEXT NOT NULL,
                fill_price   TEXT NOT NULL,
                broker_code  TEXT NOT NULL,
                leaf_hash    TEXT NOT NULL,
                created_at   REAL NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_order_audit_created ON order_audit(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_order_audit_leaf ON order_audit(leaf_hash)")


def compute_leaf(
    session_id: str,
    ts_iso: str,
    inst_id: str,
    side: str,
    sz: str | float,
    fill_price: str | float,
    broker_code: str,
) -> str:
    """Canonical leaf hash. Users MUST compute this the same way off-line to
    verify inclusion. Input order and separator are fixed forever — never
    change them without a versioning scheme."""
    payload = "|".join([
        str(session_id),
        str(ts_iso),
        str(inst_id),
        str(side),
        str(sz),
        str(fill_price),
        str(broker_code),
    ]).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def record_order(
    *,
    session_id: str,
    ts_iso: str,
    inst_id: str,
    side: str,
    sz: str | float,
    fill_price: str | float,
    broker_code: str,
) -> Optional[str]:
    """Compute the leaf hash and persist it. Returns the hash on success.

    Duplicate leaves are possible when a retry lands the same fill — we
    keep only the first (UNIQUE on leaf_hash would be stricter but a unique
    index rejection would leak through to the caller; silent skip is safer
    for an audit trail that shouldn't affect the trading path)."""
    try:
        _ensure_audit_table()
        leaf = compute_leaf(session_id, ts_iso, inst_id, side, sz, fill_price, broker_code)
        with _get_conn() as conn:
            existing = conn.execute(
                "SELECT 1 FROM order_audit WHERE leaf_hash = ? LIMIT 1",
                (leaf,),
            ).fetchone()
            if existing:
                return leaf
            conn.execute(
                """INSERT INTO order_audit
                   (session_id, ts_iso, inst_id, side, sz, fill_price,
                    broker_code, leaf_hash, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (session_id, ts_iso, inst_id, side, str(sz), str(fill_price),
                 broker_code, leaf, time.time()),
            )
        return leaf
    except Exception as e:
        logger.warning("merkle record_order failed (non-fatal): %s", e)
        return None


def _pair_hash(a: str, b: str) -> str:
    return hashlib.sha256((a + b).encode("utf-8")).hexdigest()


def _merkle_root(leaves: list[str]) -> str | None:
    if not leaves:
        return None
    level = list(leaves)
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])  # duplicate last leaf
        level = [_pair_hash(level[i], level[i + 1]) for i in range(0, len(level), 2)]
    return level[0]


def compute_daily_root(date_yyyymmdd: str) -> dict:
    """Return {root, leaf_count, date} for all leaves created on that UTC day.

    `date_yyyymmdd` format is `YYYYMMDD`. Returns root=None if no orders
    recorded that day (legitimate — published as evidence of an empty day,
    not silently omitted)."""
    _ensure_audit_table()
    try:
        day = datetime.strptime(date_yyyymmdd, "%Y%m%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise ValueError("date must be YYYYMMDD")
    start = day.timestamp()
    end = start + 86400
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT leaf_hash FROM order_audit "
            "WHERE created_at >= ? AND created_at < ? "
            "ORDER BY created_at ASC, id ASC",
            (start, end),
        ).fetchall()
    leaves = [r[0] for r in rows]
    return {
        "date": f"{date_yyyymmdd[:4]}-{date_yyyymmdd[4:6]}-{date_yyyymmdd[6:]}",
        "leaf_count": len(leaves),
        "root": _merkle_root(leaves),
        "algorithm": "sha256-pairwise-v1",
    }
