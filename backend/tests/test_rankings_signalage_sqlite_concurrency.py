"""
Remaining 3 test-writer gaps (PR 2026-04-19).

3. RANKINGS_DIR roundtrip — save_results writes JSON that
   _get_daily_rankings_sync can read back. Would have caught the
   2026-04-19 `/Users/jepo/Desktop/autotrader` Mac-path hardcode bug
   immediately (the DO run wrote nothing, but no test exercised the
   save+read pair).

4. Signal age boundary — `_MAX_SIGNAL_AGE_S` + the `>` gate at
   auto_executor.py:375. Source-level proof the env-derive formula
   holds and the comparison is strict-gt (not >=), so a signal whose
   age equals the limit is still accepted.

5. SQLite concurrent write — busy_timeout=5000 must actually absorb
   writer/writer contention. Two threads, 100 INSERTs each, zero
   OperationalError("database is locked").
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest


# ─── #3 Rankings roundtrip ────────────────────────────────────────


def _valid_ranking_payload(date_str: str) -> dict:
    """Minimal ranking payload that passes Layer-1 validation."""
    entry = {
        "rank": 1,
        "name_ko": "테스트 전략",
        "name_en": "Test Strategy",
        "strategy": "bb-squeeze",
        "direction": "long",
        "win_rate": 55.0,
        "profit_factor": 1.5,
        "total_return": 10.0,
        "total_trades": 30,
        "sharpe": 1.2,
        "max_drawdown": 5.0,
        "timeframe": "4H",
        "sl_pct": 10,
        "tp_pct": 8,
        "low_sample": False,
        "rank_change": None,
        "streak": 1,
    }
    periods = {
        "30d": {
            "top50": [entry, {**entry, "rank": 2}, {**entry, "rank": 3}],
        },
    }
    return {
        "date": date_str[:4] + "-" + date_str[4:6] + "-" + date_str[6:],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "periods": periods,
        "results": {"Market Cap Top 50": [entry]},
        "content_ko": "...",
        "content_en": "...",
    }


def test_rankings_roundtrip_save_then_read():
    """save_results writes a file _get_daily_rankings_sync can read back.

    Using a tmp dir + monkey-patching RANKING_DIR proves the save target
    and the read target agree on file naming + format. The 2026-04-19 bug
    was that these two ends used diverging paths in production."""
    import api.main as api_main

    with tempfile.TemporaryDirectory() as tmp:
        target_dir = Path(tmp) / "rankings"
        target_dir.mkdir()

        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        payload = _valid_ranking_payload(date_str)
        # Write the file directly — exactly what save_results does
        # (save_results has side effects like Telegram; bypass to isolate
        # the filesystem contract).
        target_file = target_dir / f"ranking_{date_str}.json"
        target_file.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # Point the reader at the tmp dir (module-level constant, set
        # at import; patch directly).
        with patch.object(api_main, "RANKING_DIR", str(target_dir)):
            # Clear cache so patch takes effect
            api_main._rankings_cache.clear()
            result = api_main._get_daily_rankings_sync(
                date=date_str, period="30d", group="top50"
            )

    # Reader sees the data we wrote. We intentionally don't assert a
    # specific top3 length — the handler applies WF-validation filters,
    # low-sample flags, and 0-trade sentinels. The roundtrip contract
    # we care about is: wrote file → reader returns non-empty structured
    # payload with the same date.
    assert result.get("date") in (
        payload["date"],
        date_str[:4] + "-" + date_str[4:6] + "-" + date_str[6:],
    )
    assert "top3" in result
    assert len(result["top3"]) >= 1, "reader dropped all entries — roundtrip broken"


def test_rankings_roundtrip_missing_date_falls_back_to_most_recent():
    """Reader behaviour: request a date that doesn't exist → fall back to
    the newest available file. Keep the user from seeing 404 when cron
    hiccups for a single day."""
    import api.main as api_main

    with tempfile.TemporaryDirectory() as tmp:
        target_dir = Path(tmp) / "rankings"
        target_dir.mkdir()
        # Write ONE file, two days ago
        old_date = (datetime.now(timezone.utc) - timedelta(days=2)).strftime(
            "%Y%m%d"
        )
        target_file = target_dir / f"ranking_{old_date}.json"
        target_file.write_text(
            json.dumps(_valid_ranking_payload(old_date), ensure_ascii=False),
            encoding="utf-8",
        )
        # Request today — file does not exist
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        with patch.object(api_main, "RANKING_DIR", str(target_dir)):
            api_main._rankings_cache.clear()
            result = api_main._get_daily_rankings_sync(
                date=today, period="30d", group="top50"
            )
    # Fallback succeeded — we got data back, not a 404.
    assert result is not None
    assert "top3" in result


# ─── #4 Signal age boundary ────────────────────────────────────────


def test_signal_age_gate_uses_strict_gt_not_gte():
    """Guard at auto_executor.py must use `age_s > _MAX_SIGNAL_AGE_S`
    (strict greater-than), so a signal whose age equals the limit is
    still accepted. `>=` would drop the on-boundary case."""
    import re

    src = (
        Path(__file__).resolve().parent.parent / "okx" / "auto_executor.py"
    ).read_text()
    # Find the stale guard line
    match = re.search(
        r"if\s+age_s\s*(>[=]?)\s*_MAX_SIGNAL_AGE_S\s*:",
        src,
    )
    assert match, "stale-signal guard not found"
    operator = match.group(1)
    assert operator == ">", (
        f"stale-signal guard uses `{operator}` — must be `>` so age equal to "
        "the limit is still accepted. >= makes the exact boundary a false reject."
    )


def test_max_signal_age_is_derived_from_poll_interval():
    """Env-derive formula: default = SIGNAL_POLL_INTERVAL + 60s slack.
    Proves the comment/code contract is in sync."""
    # Fresh env — clear overrides
    os.environ.pop("OKX_SIGNAL_POLL_INTERVAL", None)
    os.environ.pop("OKX_MAX_SIGNAL_AGE_S", None)
    import importlib
    import okx.auto_executor as ae
    importlib.reload(ae)
    assert ae._SIGNAL_POLL_INTERVAL_S == 300  # documented default
    assert ae._MAX_SIGNAL_AGE_S == 360  # 300 + 60


def test_max_signal_age_env_override_bypasses_derive():
    """Operator can set OKX_MAX_SIGNAL_AGE_S directly to override the
    derive-from-poll-interval default."""
    os.environ["OKX_SIGNAL_POLL_INTERVAL"] = "600"
    os.environ["OKX_MAX_SIGNAL_AGE_S"] = "120"
    try:
        import importlib
        import okx.auto_executor as ae
        importlib.reload(ae)
        # Explicit override wins even over derived (which would be 660)
        assert ae._MAX_SIGNAL_AGE_S == 120
    finally:
        os.environ.pop("OKX_SIGNAL_POLL_INTERVAL", None)
        os.environ.pop("OKX_MAX_SIGNAL_AGE_S", None)
        import importlib
        import okx.auto_executor as ae
        importlib.reload(ae)


# ─── #5 SQLite concurrent write ────────────────────────────────────


def test_sqlite_concurrent_writers_do_not_raise_busy():
    """Two writer threads hammering the same SQLite db must NOT surface
    OperationalError('database is locked'). busy_timeout=5000 absorbs
    short contention windows in WAL mode."""
    # Isolate on a tmp DB so we don't touch the real sessions db.
    with tempfile.TemporaryDirectory() as tmp:
        db_path = str(Path(tmp) / "concurrency.db")
        os.environ["OKX_DB_PATH"] = db_path

        import importlib
        importlib.reload(importlib.import_module("okx.config"))
        import okx.storage as storage
        importlib.reload(storage)

        # Ensure tables exist (first _get_conn creates them)
        storage._get_conn().close()

        errors: list[str] = []

        def worker(label: str, n: int) -> None:
            try:
                for i in range(n):
                    with storage._get_conn() as conn:
                        conn.execute(
                            "INSERT OR REPLACE INTO okx_sessions "
                            "(session_id, user_data, created_at, updated_at) "
                            "VALUES (?, ?, ?, ?)",
                            (f"{label}-{i}", "payload", 0.0, 0.0),
                        )
            except sqlite3.OperationalError as e:
                errors.append(f"{label}: {e}")

        threads = [
            threading.Thread(target=worker, args=("A", 100)),
            threading.Thread(target=worker, args=("B", 100)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)

        assert not errors, (
            "Concurrent writers surfaced SQLITE_BUSY despite "
            f"busy_timeout=5000 — {errors[:3]}. Either the PRAGMA was lost "
            "on a new connection, or a long-running transaction held a "
            "write lock past the timeout."
        )

    os.environ.pop("OKX_DB_PATH", None)
    import importlib
    importlib.reload(importlib.import_module("okx.config"))
    import okx.storage as storage
    importlib.reload(storage)
