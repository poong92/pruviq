"""
B2-B: _session_daily_loss_check real PnL tests.

Verifies that the daily loss circuit-breaker correctly accumulates
realized PnL from exit_price on tp_closed fills and trips when
|loss| >= limit_usdt.
"""
import sqlite3
import tempfile
import time
import types
import unittest.mock as mock
from pathlib import Path

import pytest

# We monkey-patch _get_conn so tests never touch the real DB.
import backend.okx.dca_loop as loop


@pytest.fixture
def tmp_db(tmp_path):
    """Isolated in-memory-backed SQLite with the DCA schema."""
    db_file = tmp_path / "test.db"
    with sqlite3.connect(str(db_file)) as conn:
        conn.execute("""
            CREATE TABLE dca_bots (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                direction TEXT NOT NULL DEFAULT 'long',
                daily_loss_limit_usdt REAL NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE dca_fills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id TEXT NOT NULL,
                order_num INTEGER NOT NULL,
                fill_price REAL NOT NULL,
                fill_size_usdt REAL NOT NULL,
                okx_order_id TEXT,
                filled_at REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                exit_price REAL DEFAULT NULL
            )
        """)
        conn.commit()
    return db_file


@pytest.fixture
def patched_db(tmp_db, monkeypatch):
    """Patch _get_conn in dca_loop to use tmp_db."""
    import contextlib

    @contextlib.contextmanager
    def _fake_conn():
        conn = sqlite3.connect(str(tmp_db))
        conn.row_factory = None
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    monkeypatch.setattr(loop, "_get_conn", _fake_conn)
    return tmp_db


def _insert_bot(db_file, bot_id, session_id, direction="long"):
    with sqlite3.connect(str(db_file)) as conn:
        conn.execute(
            "INSERT INTO dca_bots (id, session_id, direction) VALUES (?, ?, ?)",
            (bot_id, session_id, direction),
        )


def _insert_fill(
    db_file,
    bot_id,
    fill_price,
    fill_size_usdt,
    status="open",
    exit_price=None,
    filled_at=None,
):
    if filled_at is None:
        filled_at = time.time()
    with sqlite3.connect(str(db_file)) as conn:
        conn.execute(
            "INSERT INTO dca_fills "
            "(bot_id, order_num, fill_price, fill_size_usdt, filled_at, status, exit_price) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (bot_id, 0, fill_price, fill_size_usdt, filled_at, status, exit_price),
        )


# ── Tests ──────────────────────────────────────────────────────────────────


class TestSessionDailyLossCheck:
    def test_limit_zero_skips(self, patched_db):
        """limit=0 always returns (False, 0.0) — no DB query needed."""
        _insert_bot(patched_db, "b1", "s1")
        tripped, pnl = loop._session_daily_loss_check("s1", 0.0)
        assert tripped is False
        assert pnl == 0.0

    def test_no_fills_today_no_trip(self, patched_db):
        """No tp_closed fills today → pnl=0, no trip."""
        _insert_bot(patched_db, "b1", "s1")
        tripped, pnl = loop._session_daily_loss_check("s1", 50.0)
        assert tripped is False
        assert pnl == pytest.approx(0.0)

    def test_long_tp_profit_no_trip(self, patched_db):
        """Long TP fill: exit > entry → positive PnL, no trip."""
        _insert_bot(patched_db, "b1", "s1", direction="long")
        # Entry $100, exit $105, size $100 → PnL = 5% × $100 = $5
        _insert_fill(
            patched_db, "b1",
            fill_price=100.0, fill_size_usdt=100.0,
            status="tp_closed", exit_price=105.0,
        )
        tripped, pnl = loop._session_daily_loss_check("s1", 50.0)
        assert tripped is False
        assert pnl == pytest.approx(5.0, rel=1e-4)

    def test_short_tp_profit_no_trip(self, patched_db):
        """Short TP fill: exit < entry → positive PnL, no trip."""
        _insert_bot(patched_db, "b1", "s1", direction="short")
        # Entry $100, exit $95, size $100 → PnL = 5% × $100 = $5
        _insert_fill(
            patched_db, "b1",
            fill_price=100.0, fill_size_usdt=100.0,
            status="tp_closed", exit_price=95.0,
        )
        tripped, pnl = loop._session_daily_loss_check("s1", 50.0)
        assert tripped is False
        assert pnl == pytest.approx(5.0, rel=1e-4)

    def test_long_loss_trips_limit(self, patched_db):
        """Long fill where exit < entry produces negative PnL; trips limit."""
        _insert_bot(patched_db, "b1", "s1", direction="long")
        # Entry $100, exit $90, size $100 → PnL = -10% × $100 = -$10
        _insert_fill(
            patched_db, "b1",
            fill_price=100.0, fill_size_usdt=100.0,
            status="tp_closed", exit_price=90.0,
        )
        # limit = $8 (less than $10 loss)
        tripped, pnl = loop._session_daily_loss_check("s1", 8.0)
        assert tripped is True
        assert pnl == pytest.approx(-10.0, rel=1e-4)

    def test_loss_below_limit_no_trip(self, patched_db):
        """Loss smaller than limit does not trip."""
        _insert_bot(patched_db, "b1", "s1", direction="long")
        _insert_fill(
            patched_db, "b1",
            fill_price=100.0, fill_size_usdt=100.0,
            status="tp_closed", exit_price=97.0,  # -$3 loss
        )
        tripped, pnl = loop._session_daily_loss_check("s1", 5.0)
        assert tripped is False
        assert pnl == pytest.approx(-3.0, rel=1e-4)

    def test_no_exit_price_excluded(self, patched_db):
        """Legacy fills without exit_price are excluded from PnL."""
        _insert_bot(patched_db, "b1", "s1", direction="long")
        _insert_fill(
            patched_db, "b1",
            fill_price=100.0, fill_size_usdt=100.0,
            status="tp_closed", exit_price=None,  # B2-A legacy row
        )
        tripped, pnl = loop._session_daily_loss_check("s1", 1.0)
        assert tripped is False
        assert pnl == pytest.approx(0.0)

    def test_old_fills_excluded(self, patched_db):
        """Fills from yesterday (before UTC midnight) are not counted."""
        _insert_bot(patched_db, "b1", "s1", direction="long")
        yesterday = time.time() - 86401  # >1 day ago
        _insert_fill(
            patched_db, "b1",
            fill_price=100.0, fill_size_usdt=100.0,
            status="tp_closed", exit_price=80.0,  # -$20 loss
            filled_at=yesterday,
        )
        # With a $5 limit, yesterday's loss should NOT trip today's check
        tripped, pnl = loop._session_daily_loss_check("s1", 5.0)
        assert tripped is False
        assert pnl == pytest.approx(0.0)

    def test_multiple_fills_summed(self, patched_db):
        """PnL from multiple fills in the cycle is summed correctly."""
        _insert_bot(patched_db, "b1", "s1", direction="long")
        # Two entry fills at different prices, all exiting at $105
        with sqlite3.connect(str(patched_db)) as conn:
            conn.execute(
                "INSERT INTO dca_fills "
                "(bot_id, order_num, fill_price, fill_size_usdt, filled_at, status, exit_price) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                ("b1", 0, 100.0, 50.0, time.time(), "tp_closed", 105.0),
            )
            conn.execute(
                "INSERT INTO dca_fills "
                "(bot_id, order_num, fill_price, fill_size_usdt, filled_at, status, exit_price) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                ("b1", 1, 98.0, 50.0, time.time(), "tp_closed", 105.0),
            )
        tripped, pnl = loop._session_daily_loss_check("s1", 50.0)
        # PnL = 5/100 × 50 + (105-98)/98 × 50 ≈ 2.5 + 3.57 = 6.07
        assert tripped is False
        assert pnl > 0

    def test_cross_session_isolation(self, patched_db):
        """Fills from a different session are not counted."""
        _insert_bot(patched_db, "b1", "s1", direction="long")
        _insert_bot(patched_db, "b2", "s2", direction="long")
        # s2 bot has a big loss
        _insert_fill(
            patched_db, "b2",
            fill_price=100.0, fill_size_usdt=200.0,
            status="tp_closed", exit_price=50.0,  # -$100 loss
        )
        # s1 has no fills — should not trip even with low limit
        tripped, pnl = loop._session_daily_loss_check("s1", 5.0)
        assert tripped is False
        assert pnl == pytest.approx(0.0)


if __name__ == "__main__":
    import sys
    import pytest as pt
    sys.exit(pt.main([__file__, "-v"]))
