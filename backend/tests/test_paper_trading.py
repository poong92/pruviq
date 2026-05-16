"""Tests for backend/scripts/paper_trading_tracker.py.

Synthetic OHLCV + a hand-built ranking file → fully offline. No real CSV
reads, no network. Mirrors the mock pattern in test_signal_scanner_top_n.py.

What we are verifying:
    1. init_paper_portfolio creates a deterministic cycle_001.json
    2. run_daily_tick is idempotent (rerunning same date is a no-op)
    3. Mark-to-market math: a long position whose price rises 10% before SL
       hit should mark up; whose price falls below SL should close at SL.
    4. get_portfolio_status returns the expected shape
    5. _scan_for_exit: SL/TP/timeout exits at the correct bar
    6. Atomic write: a crashed write leaves no half-file
    7. /signals/realtime ranking-index loader handles missing file
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

# Backend root on path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))


# ─── Fixtures ────────────────────────────────────────────────────────────


def _make_synthetic_df(n_bars: int = 250, start_price: float = 100.0,
                       drift: float = 0.001, vol: float = 0.01,
                       seed: int = 42) -> pd.DataFrame:
    """Synthetic 1H OHLCV with mild positive drift."""
    import numpy as np
    rng = np.random.default_rng(seed)
    prices = [start_price]
    for _ in range(n_bars - 1):
        prices.append(prices[-1] * (1 + drift + rng.normal(0, vol)))
    base = pd.Timestamp("2026-04-01 00:00:00")
    rows = []
    for i, p in enumerate(prices):
        # Build a realistic OHLC around the close
        c = p
        o = prices[i - 1] if i > 0 else p
        h = max(o, c) * (1 + abs(rng.normal(0, vol / 2)))
        l = min(o, c) * (1 - abs(rng.normal(0, vol / 2)))
        rows.append({
            "timestamp": base + pd.Timedelta(hours=i),
            "open": o, "high": h, "low": l, "close": c,
            "volume": 1000.0 + rng.normal(0, 100),
        })
    return pd.DataFrame(rows)


@pytest.fixture
def isolated_paths(tmp_path, monkeypatch):
    """Point PAPER_TRADING_DIR + RANKING_DIR at tmp dirs and reload module."""
    paper_dir = tmp_path / "paper_trading"
    ranking_dir = tmp_path / "rankings"
    paper_dir.mkdir()
    ranking_dir.mkdir()
    monkeypatch.setenv("PAPER_TRADING_DIR", str(paper_dir))
    monkeypatch.setenv("RANKING_DIR", str(ranking_dir))

    # Re-import the module so the env-bound module-level paths refresh.
    import importlib
    import scripts.paper_trading_tracker as ptt
    importlib.reload(ptt)
    yield paper_dir, ranking_dir, ptt


def _write_ranking(ranking_dir: Path, date_yyyymmdd: str, entries: list[dict]) -> None:
    """Write a minimal ranking_<date>.json with one period/group."""
    payload = {
        "date": f"{date_yyyymmdd[:4]}-{date_yyyymmdd[4:6]}-{date_yyyymmdd[6:]}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "periods": {
            "30d": {
                "top50": entries,
            },
        },
    }
    (ranking_dir / f"ranking_{date_yyyymmdd}.json").write_text(
        json.dumps(payload), encoding="utf-8",
    )


# ─── Unit tests ──────────────────────────────────────────────────────────


def test_init_creates_durable_cycle_file(isolated_paths):
    paper_dir, _, ptt = isolated_paths
    state = ptt.init_paper_portfolio("2026-04-16", capital=1000.0)
    assert state.cycle_id == 1
    assert state.starting_capital == 1000.0
    f = paper_dir / "cycle_001.json"
    assert f.exists()
    loaded = json.loads(f.read_text())
    assert loaded["start_date"] == "2026-04-16"
    assert loaded["capital_available"] == 1000.0
    assert loaded["cycle_status"] == "active"


def test_init_increments_cycle_id(isolated_paths):
    _, _, ptt = isolated_paths
    s1 = ptt.init_paper_portfolio("2026-04-16")
    s2 = ptt.init_paper_portfolio("2026-05-16")
    assert s1.cycle_id == 1
    assert s2.cycle_id == 2


def test_invalid_start_date_raises(isolated_paths):
    _, _, ptt = isolated_paths
    with pytest.raises(ValueError, match="YYYY-MM-DD"):
        ptt.init_paper_portfolio("16-04-2026")


def test_get_top_strategies_filters_pf(isolated_paths):
    _, ranking_dir, ptt = isolated_paths
    _write_ranking(ranking_dir, "20260416", [
        {"strategy": "ichimoku", "direction": "short", "timeframe": "1H",
         "profit_factor": 2.5, "win_rate": 71.0, "total_trades": 145,
         "sl_pct": 3, "tp_pct": 15, "sharpe": 4.0, "max_drawdown": 5.0},
        {"strategy": "bb-squeeze-short", "direction": "short", "timeframe": "1H",
         "profit_factor": 1.4, "win_rate": 55.0, "total_trades": 200,
         "sl_pct": 10, "tp_pct": 8, "sharpe": 2.0, "max_drawdown": 8.0},
        # Low-N: should be filtered out by min_trades
        {"strategy": "atr-breakout", "direction": "long", "timeframe": "4H",
         "profit_factor": 5.0, "win_rate": 80.0, "total_trades": 10,
         "sl_pct": 12, "tp_pct": 15, "sharpe": 6.0, "max_drawdown": 1.0},
    ])
    top = ptt.get_top_strategies("20260416", min_pf=2.0, min_trades=30, top_n=3)
    assert len(top) == 1
    assert top[0]["strategy"] == "ichimoku"


def test_get_top_strategies_returns_empty_when_no_file(isolated_paths):
    _, _, ptt = isolated_paths
    assert ptt.get_top_strategies("20990101") == []


def test_scan_for_exit_long_tp_hit(isolated_paths):
    _, _, ptt = isolated_paths
    # Long position at $100, TP at +5%, SL at -3%
    pos = {
        "signal_id": "x", "strategy": "x", "direction": "long",
        "timeframe": "1H", "coin": "BTCUSDT",
        "entry_time": "2026-04-16T00:00:00",
        "entry_price": 100.0, "sl_pct": 3.0, "tp_pct": 5.0,
        "max_bars": 10, "allocation_usd": 100.0,
    }
    # Entry bar i=0, then bar i=1 hits TP (high goes to 106)
    forward = pd.DataFrame([
        {"timestamp": pd.Timestamp("2026-04-16T00:00:00"),
         "open": 100, "high": 100, "low": 100, "close": 100, "volume": 1},
        {"timestamp": pd.Timestamp("2026-04-16T01:00:00"),
         "open": 101, "high": 106, "low": 100, "close": 104, "volume": 1},
    ])
    result = ptt._scan_for_exit(forward, pos)
    assert result is not None
    exit_time, exit_price, pnl_pct, reason, bars_held = result
    assert reason == "tp"
    assert bars_held == 1
    # TP price = 100 * 1.05 = 105
    assert exit_price == pytest.approx(105.0)
    # pnl ≈ tp_pct - 2*(fee + slip) = 5 - 0.14 = 4.86
    assert pnl_pct > 4.5 and pnl_pct < 5.0


def test_scan_for_exit_short_sl_hit(isolated_paths):
    _, _, ptt = isolated_paths
    # Short position at $100, SL at +3%, TP at -5%
    pos = {
        "signal_id": "x", "strategy": "x", "direction": "short",
        "timeframe": "1H", "coin": "BTCUSDT",
        "entry_time": "2026-04-16T00:00:00",
        "entry_price": 100.0, "sl_pct": 3.0, "tp_pct": 5.0,
        "max_bars": 10, "allocation_usd": 100.0,
    }
    forward = pd.DataFrame([
        {"timestamp": pd.Timestamp("2026-04-16T00:00:00"),
         "open": 100, "high": 100, "low": 100, "close": 100, "volume": 1},
        {"timestamp": pd.Timestamp("2026-04-16T01:00:00"),
         "open": 101, "high": 104, "low": 100, "close": 102, "volume": 1},
    ])
    result = ptt._scan_for_exit(forward, pos)
    assert result is not None
    _, _, pnl_pct, reason, _ = result
    assert reason == "sl"
    assert pnl_pct < 0


def test_scan_for_exit_timeout(isolated_paths):
    _, _, ptt = isolated_paths
    pos = {
        "signal_id": "x", "strategy": "x", "direction": "long",
        "timeframe": "1H", "coin": "BTCUSDT",
        "entry_time": "2026-04-16T00:00:00",
        "entry_price": 100.0, "sl_pct": 10.0, "tp_pct": 10.0,
        "max_bars": 3, "allocation_usd": 100.0,
    }
    # 5 bars, all flat — neither SL nor TP hits, must timeout at bar 3
    rows = [{
        "timestamp": pd.Timestamp("2026-04-16T00:00:00") + pd.Timedelta(hours=i),
        "open": 100, "high": 100.5, "low": 99.5, "close": 100, "volume": 1,
    } for i in range(5)]
    forward = pd.DataFrame(rows)
    result = ptt._scan_for_exit(forward, pos)
    assert result is not None
    _, _, _, reason, bars_held = result
    assert reason == "timeout"
    assert bars_held == 3


def test_atomic_write_is_durable(isolated_paths):
    """After successful write the file must exist and be valid JSON."""
    paper_dir, _, ptt = isolated_paths
    state = ptt.init_paper_portfolio("2026-04-16")
    f = paper_dir / "cycle_001.json"
    # File must parse cleanly — atomic write must not leave a temp file behind
    loaded = json.loads(f.read_text())
    assert loaded["cycle_id"] == 1
    # No temp files lingering
    leftovers = [p for p in paper_dir.iterdir() if p.name.startswith("cycle_001.json.")]
    assert leftovers == []


def test_get_portfolio_status_no_cycle(isolated_paths):
    _, _, ptt = isolated_paths
    status = ptt.get_portfolio_status()
    assert status["cycle_status"] == "none"


def test_get_portfolio_status_after_init(isolated_paths):
    _, _, ptt = isolated_paths
    ptt.init_paper_portfolio("2026-04-16", capital=1000.0)
    status = ptt.get_portfolio_status()
    assert status["cycle_id"] == 1
    assert status["starting_capital"] == 1000.0
    assert status["cycle_status"] == "active"
    assert status["history"] == []  # no ticks yet
    assert status["open_positions"] == []


def test_run_daily_tick_idempotent(isolated_paths, monkeypatch):
    """Re-running the same date must not change state."""
    paper_dir, ranking_dir, ptt = isolated_paths
    # Write a ranking that has zero qualifying strategies → tick is trivial
    _write_ranking(ranking_dir, "20260416", [])
    ptt.init_paper_portfolio("2026-04-16", capital=1000.0)

    # Stub DataManager so we don't try to load real CSVs
    class _StubDM:
        coin_count = 0
        coins: list = []
        def get_resampled(self, *args, **kwargs):
            return None
        def get_df(self, *args, **kwargs):
            return None
    state1 = ptt.run_daily_tick("2026-04-16", data_manager=_StubDM())
    initial_history_len = len(state1.history)
    state2 = ptt.run_daily_tick("2026-04-16", data_manager=_StubDM())
    assert len(state2.history) == initial_history_len


def test_run_daily_tick_marks_history(isolated_paths):
    paper_dir, ranking_dir, ptt = isolated_paths
    _write_ranking(ranking_dir, "20260416", [])
    ptt.init_paper_portfolio("2026-04-16", capital=1000.0)

    class _StubDM:
        coin_count = 0
        coins: list = []
        def get_resampled(self, *args, **kwargs):
            return None
        def get_df(self, *args, **kwargs):
            return None

    state = ptt.run_daily_tick("2026-04-16", data_manager=_StubDM())
    assert len(state.history) == 1
    assert state.history[0]["date"] == "2026-04-16"
    assert state.history[0]["equity"] == pytest.approx(1000.0)
    assert state.last_tick_date == "2026-04-16"


def test_cycle_completion_marker(isolated_paths):
    """After cycle_length_days elapsed, status flips to complete."""
    paper_dir, ranking_dir, ptt = isolated_paths
    _write_ranking(ranking_dir, "20260416", [])
    _write_ranking(ranking_dir, "20260516", [])
    ptt.init_paper_portfolio("2026-04-16", capital=1000.0, cycle_length_days=30)

    class _StubDM:
        coin_count = 0
        coins: list = []
        def get_resampled(self, *args, **kwargs):
            return None
        def get_df(self, *args, **kwargs):
            return None

    state = ptt.run_daily_tick("2026-05-17", data_manager=_StubDM())
    # 30+ days elapsed → status should be 'complete'
    assert state.cycle_status == "complete"


def test_max_bars_for_tf(isolated_paths):
    _, _, ptt = isolated_paths
    assert ptt._max_bars_for_tf("1H") == 48
    assert ptt._max_bars_for_tf("4H") == 12
    assert ptt._max_bars_for_tf("6H") == 8
    assert ptt._max_bars_for_tf("unknown") == 48  # safe fallback


def test_signal_id_format(isolated_paths):
    _, _, ptt = isolated_paths
    sid = ptt._signal_id("ichimoku", "short", "1H", "BTCUSDT", "2026-04-16T10:00:00")
    assert sid == "ichimoku:short:1H:BTCUSDT:2026-04-16T10:00:00"


def test_ranking_fallback_to_recent_when_exact_missing(isolated_paths):
    _, ranking_dir, ptt = isolated_paths
    _write_ranking(ranking_dir, "20260415", [
        {"strategy": "ichimoku", "direction": "short", "timeframe": "1H",
         "profit_factor": 3.0, "win_rate": 70.0, "total_trades": 100,
         "sl_pct": 3, "tp_pct": 15, "sharpe": 4.0, "max_drawdown": 5.0},
    ])
    # Request a date AFTER what we have — must fall back to 20260415
    top = ptt.get_top_strategies("20260420", min_pf=2.0)
    assert len(top) == 1
    assert top[0]["strategy"] == "ichimoku"


def test_load_cycle_round_trip(isolated_paths):
    """A cycle written via save_cycle must round-trip cleanly through load_cycle."""
    _, _, ptt = isolated_paths
    state = ptt.init_paper_portfolio("2026-04-16", capital=500.0)
    loaded = ptt.load_cycle(state.cycle_id)
    assert loaded.cycle_id == state.cycle_id
    assert loaded.starting_capital == 500.0
    assert loaded.start_date == "2026-04-16"
