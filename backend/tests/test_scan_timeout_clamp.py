"""
`_okx_auto_trading_loop` config-validation regression.

When operator lowers `OKX_AUTO_TRADE_INTERVAL_SEC` (e.g. 60s for
1-min signal latency) but leaves the default `OKX_SCAN_TIMEOUT_SEC`
(90s), successive ticks overlap: tick N+1 fires while tick N's thread
is still running → 2× CPU cost until both finish. Guard clamps timeout
to interval-15 (min 20s) with a WARN log.

Static regression: source contains the clamp. Runtime regression
exercising the loop requires `asyncio.run` and a mock scanner — skipped
here as it would re-test #1180 territory (already covered).
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
API_MAIN = REPO / "api" / "main.py"


def _loop_body() -> str:
    src = API_MAIN.read_text()
    m = re.search(
        r"async def _okx_auto_trading_loop.*?(?=^async def |\Z)",
        src,
        re.DOTALL | re.MULTILINE,
    )
    assert m, "_okx_auto_trading_loop not found"
    return m.group(0)


def test_clamp_present_when_timeout_exceeds_interval():
    body = _loop_body()
    # The clamp condition must compare timeout >= interval
    assert re.search(
        r"scan_timeout_sec\s*>=\s*interval_sec",
        body,
    ), "clamp must trigger when scan_timeout_sec >= interval_sec"


def test_clamp_adjusts_to_interval_minus_15():
    body = _loop_body()
    # Adjusted value = max(20, interval_sec - 15)
    assert re.search(
        r"max\(\s*20\s*,\s*interval_sec\s*-\s*15\s*\)",
        body,
    ), "clamp must use max(20, interval_sec - 15) so the timeout stays < interval"


def test_clamp_emits_warning_log():
    body = _loop_body()
    assert re.search(
        r"logger\.warning.*OKX_SCAN_TIMEOUT_SEC.*clamp",
        body,
        re.DOTALL,
    ), "operator must see a WARN when the clamp fires (silent adjustment hides misconfig)"


def test_default_values_unchanged():
    """Back-compat: existing production deploys (interval=300, timeout=90)
    must not trigger the clamp — 90 < 300 → pass."""
    body = _loop_body()
    # Default reads should still appear unchanged
    assert re.search(
        r'"OKX_AUTO_TRADE_INTERVAL_SEC"\s*,\s*"300"', body,
    )
    assert re.search(
        r'"OKX_SCAN_TIMEOUT_SEC"\s*,\s*"90"', body,
    )
