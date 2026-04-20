"""
/signals/live stale-cache fallback regression guard.

Problem this guards against (2026-04-20):
  signal_scanner.scan() in a uvicorn worker competing with other CPU-bound
  requests can exceed the 30s timeout. The old behaviour returned `[]`,
  which the /signals front-end renders as the "No signals right now" empty
  state. Users saw an empty signals page whenever the scanner briefly hit
  its ceiling — even though the last successful scan result was already
  in `SignalScanner._cache` and perfectly usable as a tactical fallback.

Guards:
  1. Under TimeoutError, if `_cache` is populated and less than 1 hour old,
     /signals/live must return the cache (not []).
  2. Under TimeoutError, if `_cache` is empty OR older than 1 hour, the
     endpoint must return [] (honesty over stale data beyond useful).
  3. The auto-trade loop's scan call site (main.py:~266) must remain
     independent — the fallback must only live in /signals/live body.
     Serving stale-cache signals to the auto-trade loop = money-loss bug.
"""
from __future__ import annotations

import asyncio
import re
import sys
import time
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

REPO = Path(__file__).resolve().parent.parent
API_MAIN = REPO / "api" / "main.py"


# ── Test 1 + 2: behavioural test of /signals/live fallback ─────────────

class _FakeScanner:
    """Minimal stand-in for SignalScanner. scan() raises a configured delay;
    we invoke signals_live() with a patched module-level `_signal_scanner`."""

    def __init__(self, cache, cache_age_sec):
        self._cache = cache
        self._cache_ts = time.time() - cache_age_sec
        # Control: scan() blocks long enough to force wait_for timeout.
        # We use a tiny sleep + yield; the endpoint wraps it in asyncio.to_thread,
        # then wait_for(timeout=...) — tests monkey-patch the timeout down to
        # a fraction of a second for speed.
        self._scan_blocked_forever = True

    def scan(self):
        # Block long enough that the test-side wait_for definitely fires first.
        # (Real scan takes seconds; here we just need > the patched timeout.)
        time.sleep(1.0)
        return []


async def _invoke_signals_live_with_timeout(fake_scanner, timeout_sec):
    """Reproduce the endpoint body with a shorter timeout for fast tests."""
    # Keep the behaviour identical to api/main.py:signals_live() — any drift
    # from the real code here would silently pass the test while the endpoint
    # stays broken. If you change the endpoint, update this mirror.
    if fake_scanner is None:
        return []

    def _scan():
        return fake_scanner.scan()

    try:
        signals = await asyncio.wait_for(
            asyncio.to_thread(_scan), timeout=timeout_sec,
        )
    except asyncio.TimeoutError:
        cache = fake_scanner._cache
        cache_age = time.time() - fake_scanner._cache_ts
        if cache and cache_age < 3600:
            return cache
        return []
    return signals


def test_fallback_returns_cached_signals_when_scan_times_out():
    cached = [{"coin": "BTCUSDT", "direction": "long"}]
    scanner = _FakeScanner(cache=cached, cache_age_sec=120)  # 2 min old
    result = asyncio.run(_invoke_signals_live_with_timeout(scanner, 0.05))
    assert result == cached, (
        "Expected fallback to stale cache on TimeoutError, got empty. "
        "This means /signals flips to 'No signals right now' UX every time "
        "a scan hits the 30s ceiling — the regression this guard exists for."
    )


def test_fallback_returns_empty_when_cache_empty():
    scanner = _FakeScanner(cache=[], cache_age_sec=60)
    result = asyncio.run(_invoke_signals_live_with_timeout(scanner, 0.05))
    assert result == [], "Empty cache should fall through to []."


def test_fallback_returns_empty_when_cache_older_than_1h():
    cached = [{"coin": "BTCUSDT", "direction": "long"}]
    scanner = _FakeScanner(cache=cached, cache_age_sec=3700)  # 61 min old
    result = asyncio.run(_invoke_signals_live_with_timeout(scanner, 0.05))
    assert result == [], (
        "Cache older than 1h must return [] — serving 6-hour-old 'live' "
        "signals is more misleading than honest-empty."
    )


# ── Test 3: auto-trade loop must stay independent ──────────────────────

def test_auto_trade_loop_does_not_serve_stale_cache():
    """The /signals/live endpoint's stale-cache fallback must NOT be
    reachable from the auto-trade loop. If someone factors out a shared
    helper like `_signals_with_fallback()`, auto-trade could start placing
    real orders based on hour-old cached signals. Guard by grepping the
    auto-trade body for the known-safe `signals = []` pattern."""
    src = API_MAIN.read_text()

    # Locate the auto-trade loop body. It's an async def whose name matches.
    auto_trade_match = re.search(
        r"async def _okx_auto_trading_loop\b.*?(?=\nasync def |\Z)",
        src,
        re.DOTALL,
    )
    assert auto_trade_match, (
        "Could not locate async def _okx_auto_trading_loop in main.py. "
        "If it was renamed, update this guard."
    )
    auto_trade_body = auto_trade_match.group(0)

    # On timeout in auto-trade, the canonical safe behaviour is
    # `signals = []` (skip this tick). The stale-cache helper from
    # /signals/live must not appear here.
    assert "signals = []" in auto_trade_body, (
        "Auto-trade loop's TimeoutError handler no longer sets signals = [] "
        "on timeout. This might mean someone wired in the /signals/live "
        "stale-cache fallback — which would cause auto-trade to place real "
        "orders from hour-old cached signals (money loss). Revert."
    )

    # Negative assertion: the stale-cache fallback marker must not leak here.
    assert "serving stale cache" not in auto_trade_body, (
        "Stale-cache log message from /signals/live appears in auto-trade "
        "loop — the fallback was generalised and now affects real orders. "
        "Revert and keep the fallback confined to the user-facing endpoint."
    )


# ── Test 4: endpoint source itself has the fallback + cap ──────────────

def test_signals_live_endpoint_has_stale_cap():
    """Grep-level guard that the endpoint still has both the cache-fallback
    branch AND the 1-hour staleness cap. Protects against future edits that
    remove one half of the guard (e.g. drop the cap -> serve day-old data)."""
    src = API_MAIN.read_text()

    # Locate the /signals/live function body specifically (not /internal/signals).
    m = re.search(
        r'@app\.get\("/signals/live"\).*?(?=\n@app\.)',
        src, re.DOTALL,
    )
    assert m, "Could not locate /signals/live endpoint in main.py."
    body = m.group(0)

    assert "_signal_scanner._cache" in body, (
        "/signals/live no longer references _signal_scanner._cache on timeout "
        "— the stale-fallback branch was removed. Restore it; otherwise the "
        "/signals page flips to empty-state every time a scan exceeds 30s."
    )
    assert "3600" in body, (
        "/signals/live no longer caps stale cache at 3600s (1h). Without "
        "the cap, day-old signals can be served as 'live'."
    )
