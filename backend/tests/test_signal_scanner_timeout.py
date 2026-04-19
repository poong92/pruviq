"""
signal_scanner.scan timeout regression guard.

2026-04-19 CRITICAL: DO uvicorn pegged at 100% CPU for 13 minutes — the
`asyncio.to_thread(_signal_scanner.scan)` call sites in api/main.py had
no timeout, so a hung/slow scan pinned the single worker indefinitely.
/health stopped responding (Cloudflare Tunnel "context canceled"); the
architecture-audit agent confirmed the symptom live.

This guard ensures every scan call site is wrapped in `asyncio.wait_for`
with a finite timeout.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

REPO = Path(__file__).resolve().parent.parent
API_MAIN = REPO / "api" / "main.py"


def test_every_scan_to_thread_has_wait_for():
    """Every `asyncio.to_thread(*scan)` or `asyncio.to_thread(_scan)` call
    must be wrapped in `asyncio.wait_for(...)` on the same or immediately
    preceding line. Raw `await asyncio.to_thread(scan)` = potential hang."""
    src = API_MAIN.read_text()
    lines = src.splitlines()

    scan_patterns = [
        # _signal_scanner.scan direct
        re.compile(r"asyncio\.to_thread\(\s*_signal_scanner\.scan\s*[,)]"),
        # local _scan wrapper (e.g. in /signals/live)
        re.compile(r"asyncio\.to_thread\(\s*_scan\s*[,)]"),
    ]

    findings: list[tuple[int, str]] = []
    for i, line in enumerate(lines, start=1):
        for p in scan_patterns:
            if p.search(line):
                # Look at a 3-line window (this line + 2 preceding) for
                # an `asyncio.wait_for(` enclosing the to_thread call.
                window = "\n".join(lines[max(0, i - 3):i])
                if "asyncio.wait_for(" not in window:
                    findings.append((i, line.strip()[:120]))

    assert not findings, (
        "Unwrapped signal scan call(s) found — each must be inside "
        "asyncio.wait_for(..., timeout=N). A hung scan will peg uvicorn at "
        "100% CPU and break /health. Locations:\n"
        + "\n".join(f"  api/main.py:{n}: {code}" for n, code in findings)
    )


def test_timeout_values_are_bounded():
    """Timeouts must be finite (not None, not huge). Sanity check the
    numeric values we chose fit the 300s scheduler tick."""
    src = API_MAIN.read_text()
    # Extract every timeout= literal on a wait_for line that mentions scan.
    timeouts: list[int] = []
    for match in re.finditer(
        r"asyncio\.wait_for\(\s*asyncio\.to_thread\([^)]*scan[^)]*\)[^)]*timeout\s*=\s*(\w+)",
        src,
        re.DOTALL,
    ):
        val = match.group(1)
        if val.isdigit():
            timeouts.append(int(val))
        # Env-derived timeouts (scan_timeout_sec) are accepted; we can't
        # know the runtime value here but the variable name check is below.
    # At least one numeric timeout present
    assert timeouts or "scan_timeout_sec" in src, (
        "Expected at least one numeric timeout on wait_for(to_thread(scan)). "
        "Either hardcode one (30-120) or read from env (scan_timeout_sec)."
    )
    for t in timeouts:
        assert 10 <= t <= 300, (
            f"Scan timeout {t}s is out of reasonable range. "
            "Too short → false timeouts under load; too long → 5-min "
            "scheduler tick can overlap itself."
        )


def test_timeout_handlers_are_explicit():
    """Each wait_for site must handle asyncio.TimeoutError explicitly, not
    let it bubble up to the generic `except Exception` — that loses the
    signal about hung scans vs real errors."""
    src = API_MAIN.read_text()
    # Count `asyncio.wait_for` with `scan` near it
    wait_for_sites = len(
        re.findall(
            r"asyncio\.wait_for\(\s*asyncio\.to_thread\([^)]*scan",
            src,
            re.DOTALL,
        )
    )
    # Count TimeoutError catches inside /signals|/internal|_okx_auto_trading|_prewarm
    timeout_catches = src.count("asyncio.TimeoutError")
    assert timeout_catches >= wait_for_sites, (
        f"Have {wait_for_sites} wait_for(scan) sites but only "
        f"{timeout_catches} asyncio.TimeoutError handlers — "
        "some paths swallow timeouts as generic errors."
    )
