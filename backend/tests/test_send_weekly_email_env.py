"""
send_weekly_email.py env guard (PR 2026-04-19).

Part of the DO/Mac split cleanup sweep. The earlier `SUBSCRIBERS_FILE =
Path("/Users/jepo/pruviq-data/subscribers.json")` hardcode paired with
`API_URL = "http://localhost:8080"` meant:
  - Run on Mac (via `com.pruviq.weekly-email` LaunchAgent): API_URL hits
    nothing (Phase 8 killed Mac uvicorn), SUBSCRIBERS_FILE happens to exist
    but is drift-prone.
  - Run on DO (if ever wired to systemd): SUBSCRIBERS_FILE unreadable
    (/Users not mounted, User=pruviq), API_URL works.
Both paths are broken in one direction. Env-driven is the only correct fix.
"""
from __future__ import annotations

import os
import re
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
SCRIPT = REPO / "scripts" / "send_weekly_email.py"


def test_subscribers_file_reads_from_env():
    src = SCRIPT.read_text()
    # Hard-coded Mac path must be gone as the default.
    assert not re.search(
        r'SUBSCRIBERS_FILE\s*=\s*Path\(\s*["\']/Users/jepo/',
        src,
    ), (
        "send_weekly_email.py still hardcodes a /Users/jepo path. The same "
        "file is shared with api/main.py:4270 and must be env-configured so "
        "DO (systemd) and Mac (LA) can both resolve it correctly."
    )
    assert "os.environ.get" in src and '"SUBSCRIBERS_FILE"' in src, (
        "send_weekly_email.py must read SUBSCRIBERS_FILE from env."
    )


def test_api_url_reads_from_env_and_defaults_public():
    src = SCRIPT.read_text()
    # Bare localhost:8080 default is broken on Mac post-Phase-8.
    assert not re.search(
        r'API_URL\s*=\s*["\']http://localhost:8080["\']',
        src,
    ), (
        "send_weekly_email.py still defaults API_URL to localhost:8080. "
        "After Phase 8, Mac has no uvicorn, so weekly-email silently fails "
        "on the LA run."
    )
    assert re.search(
        r'API_URL\s*=\s*os\.environ\.get\(\s*["\']PRUVIQ_API_URL["\']',
        src,
    ), "send_weekly_email.py must read PRUVIQ_API_URL from env."
    # Default must be the public CF-tunneled host (reachable from anywhere).
    m = re.search(
        r'API_URL\s*=\s*os\.environ\.get\(\s*["\']PRUVIQ_API_URL["\']\s*,\s*["\']([^"\']+)["\']',
        src,
    )
    assert m, "API_URL env lookup must have a default"
    default = m.group(1)
    assert "api.pruviq.com" in default, (
        f"API_URL default {default!r} must use api.pruviq.com (CF tunnel), "
        "not localhost — this script runs on Mac where there is no uvicorn."
    )


def test_fallback_paths_are_home_relative_not_autotrader():
    """Same rule as daily_strategy_ranking.py: no autotrader legacy refs in
    fallback paths."""
    src = SCRIPT.read_text()
    fallback = re.search(
        r'os\.environ\.get\(\s*["\']SUBSCRIBERS_FILE["\']\s*,\s*([^)]+)\)',
        src,
    )
    assert fallback, "Could not find SUBSCRIBERS_FILE env fallback"
    assert "autotrader" not in fallback.group(1).lower()
    assert "Desktop" not in fallback.group(1)
