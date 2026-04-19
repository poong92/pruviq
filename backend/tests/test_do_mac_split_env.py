"""
DO/Mac split regression guard (PR 2026-04-19).

Two classes of bug this PR closes:

1. Hardcoded Mac paths in DO-hosted code paths. `api/main.py:3800` and
   `:4270` already use `os.environ.get` with Mac-path fallbacks, but the
   systemd units that run them on DO (pruviq-api.service,
   pruviq-daily-ranking.service) did not inject the env vars. Result: the
   handlers silently hit `/Users/jepo/...` → PermissionError → `/rankings/daily`
   served 4-day-old JSON and `/api/subscribe` rejected every write.
2. `daily_strategy_ranking.py:729` wrote archival JSON to the same Mac path
   as a hardcoded string. Every DO cron run PermissionError-ed; the failure
   cascaded into E2E `Rankings_daily_structure` FAIL ("date 4.3 days old")
   which blocked every backend PR automerge.

Verified:
- The three systemd unit files in repo declare the two env vars.
- `daily_strategy_ranking.py` now reads `RANKING_DIR` (same name as
  api/main.py) with a Mac-only home-relative fallback — never the
  autotrader-legacy path.
- Bash syntax for `staleness-watch.sh` passes after the JSON-dedup → file-lock
  rewrite (previous state file corrupted under concurrent writes → alert
  every 10 min instead of once per day).
"""
from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
SYSTEMD_DIR = REPO / "deploy" / "systemd"
API_MAIN = REPO / "api" / "main.py"
DAILY_RANKING = REPO / "scripts" / "daily_strategy_ranking.py"
STALENESS_WATCH = SYSTEMD_DIR / "bin" / "staleness-watch.sh"


def test_pruviq_api_service_injects_ranking_and_subscribers():
    """pruviq-api.service must set both env vars — api/main.py uses these at
    module import time, so the uvicorn process inherits them or nothing."""
    unit = (SYSTEMD_DIR / "pruviq-api.service").read_text()
    assert re.search(r"^Environment=RANKING_DIR=", unit, re.M), (
        "pruviq-api.service missing RANKING_DIR. /rankings/daily will read "
        "from /Users/jepo/Desktop/autotrader on DO → PermissionError → 4-day "
        "stale JSON served."
    )
    assert re.search(r"^Environment=SUBSCRIBERS_FILE=", unit, re.M), (
        "pruviq-api.service missing SUBSCRIBERS_FILE. /api/subscribe will "
        "try to create /Users/jepo/pruviq-data on DO → PermissionError → "
        "every signup silently drops."
    )
    # Both must point into /opt/pruviq/shared (pruviq user has write there).
    for m in re.finditer(r"^Environment=(RANKING_DIR|SUBSCRIBERS_FILE)=(.+)$", unit, re.M):
        assert m.group(2).startswith("/opt/pruviq/shared"), (
            f"{m.group(1)} must live under /opt/pruviq/shared (the only dir "
            f"the pruviq systemd user can write to on DO). Got: {m.group(2)!r}"
        )


def test_pruviq_daily_ranking_service_injects_ranking_dir():
    """pruviq-daily-ranking.service must set RANKING_DIR for save_results()."""
    unit = (SYSTEMD_DIR / "pruviq-daily-ranking.service").read_text()
    assert re.search(r"^Environment=RANKING_DIR=", unit, re.M), (
        "pruviq-daily-ranking.service missing RANKING_DIR. save_results() "
        "will fall back to /Users/jepo/Desktop/autotrader — PermissionError "
        "every 00:05 UTC → rankings-daily.json stale → E2E fail."
    )


def test_daily_strategy_ranking_reads_env_not_hardcoded_mac_path():
    """`save_results` must read RANKING_DIR. Previous hardcoded string broke
    the entire DO pipeline."""
    src = DAILY_RANKING.read_text()
    # Old hardcoded path must be gone (no bare literal in the save_results site).
    # It can still appear in comments/docstrings mentioning the legacy bug,
    # but not as the default value of the env lookup.
    bad_literal_pattern = re.compile(
        r'out_dir\s*=\s*["\']/Users/jepo/Desktop/autotrader'
    )
    assert not bad_literal_pattern.search(src), (
        "daily_strategy_ranking.py still hardcodes the Mac autotrader path "
        "as the save target. Use os.environ.get('RANKING_DIR', ...) instead."
    )
    assert "os.environ.get(" in src and '"RANKING_DIR"' in src, (
        "daily_strategy_ranking.py save_results must consult RANKING_DIR env."
    )


def test_api_main_env_names_match_systemd_units():
    """Env var names in code and systemd unit must be byte-identical; a typo
    like RANKING_DIR vs RANKINGS_DIR silently reverts to the Mac fallback."""
    src = API_MAIN.read_text()
    code_names = set()
    for pattern in (
        r'os\.environ\.get\(\s*["\'](RANKING_DIR|SUBSCRIBERS_FILE)["\']',
        r'os\.environ\[\s*["\'](RANKING_DIR|SUBSCRIBERS_FILE)["\']',
    ):
        code_names.update(re.findall(pattern, src))
    assert "RANKING_DIR" in code_names, "api/main.py no longer reads RANKING_DIR"
    assert "SUBSCRIBERS_FILE" in code_names, "api/main.py no longer reads SUBSCRIBERS_FILE"

    api_unit = (SYSTEMD_DIR / "pruviq-api.service").read_text()
    for name in code_names:
        assert re.search(rf"^Environment={name}=", api_unit, re.M), (
            f"api/main.py reads {name} but pruviq-api.service does not set it."
        )


def test_staleness_watch_bash_syntax_clean():
    """The staleness-watch rewrite changes dedup from a shared JSON file to
    per-key flag files. A syntax slip would silently fail and re-introduce
    the alert-every-10-min storm — run `bash -n` to catch it."""
    result = subprocess.run(
        ["bash", "-n", str(STALENESS_WATCH)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"staleness-watch.sh fails bash syntax check:\n{result.stderr}"
    )


def test_staleness_watch_uses_per_key_lock_not_shared_json():
    """Regression guard for the JSON-dedup bug. Multiple concurrent runs of
    the old mark_alerted appended instead of overwriting (observed: four
    `{"market_stale": true}` objects concatenated). The new scheme uses
    one flag file per key per day — inherently atomic."""
    src = STALENESS_WATCH.read_text()
    # The old design had a shared JSON state file; the new one uses LOCK_DIR.
    assert "LOCK_DIR=" in src, (
        "staleness-watch.sh must use per-key lock files, not a shared JSON."
    )
    # Extract just the already_alerted + mark_alerted function bodies. The
    # script still does json.load elsewhere (parsing market.json from CF) —
    # that is a different concern. The dedup functions must not.
    dedup_fns = re.search(
        r"already_alerted\(\)\s*\{(.*?)\}\s*#\s*Records an alert.*?mark_alerted\(\)\s*\{(.*?)\}",
        src,
        re.DOTALL,
    )
    assert dedup_fns, "Could not locate already_alerted / mark_alerted blocks"
    dedup_body = dedup_fns.group(1) + dedup_fns.group(2)
    assert "json.load" not in dedup_body, (
        "staleness-watch.sh dedup functions still load JSON state. The 2026-04-19 "
        "bug concatenated four JSON objects under concurrent writes; stick to "
        "file-existence semantics (`: > $FLAG` / `[ -f $FLAG ]`)."
    )
    assert "json.dump" not in dedup_body, (
        "staleness-watch.sh dedup functions still write JSON state."
    )


def test_env_fallback_is_home_relative_not_autotrader():
    """The archive-path fallback must not reference the autotrader legacy
    directory. The legacy path was the source of the original bug; future
    refactors could silently reintroduce it."""
    # daily_strategy_ranking.py fallback
    src = DAILY_RANKING.read_text()
    fallback = re.search(
        r'os\.environ\.get\(\s*["\']RANKING_DIR["\'],\s*([^)]+)\)',
        src,
    )
    assert fallback, "Could not find RANKING_DIR env fallback expression"
    fallback_expr = fallback.group(1)
    assert "autotrader" not in fallback_expr.lower(), (
        f"RANKING_DIR fallback references autotrader legacy path: "
        f"{fallback_expr!r}. Use a home-relative path under ~/pruviq-data "
        f"or similar — autotrader is frozen per project_pruviq_core_intent."
    )
    assert "Desktop" not in fallback_expr, (
        f"RANKING_DIR fallback references Mac Desktop: {fallback_expr!r}."
    )
