"""
Regression guard for OHLCV per-symbol failure classification + status file.

Covers the 2026-04-20 feature (update_ohlcv_okx.py):
  - `_classify_failure` maps exceptions to one of 5 bounded buckets
  - The classify helper is used (not shadowed by future refactors)
  - `/metrics` gauge refresh helper pulls the status file if present
    and zero-fills missing reasons (prevents stale labels)

Not exercised here: the full end-to-end refresh against OKX. That path
is covered by the existing `test_okx_market_fetcher.py` live suite.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
import pytest


def _import_script_module():
    """Import `update_ohlcv_okx` as a module without running main()."""
    import importlib.util
    script = Path(__file__).parent.parent / "scripts" / "update_ohlcv_okx.py"
    spec = importlib.util.spec_from_file_location("update_ohlcv_okx_test", script)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestClassifyFailure:
    """_classify_failure must only ever return one of 5 known buckets.
    This keeps Prometheus label cardinality bounded."""

    def setup_method(self):
        self.mod = _import_script_module()

    def test_rate_limit_on_429(self):
        req = httpx.Request("GET", "https://www.okx.com/api/v5/market/candles")
        resp = httpx.Response(429, request=req)
        exc = httpx.HTTPStatusError("429", request=req, response=resp)
        assert self.mod._classify_failure(exc) == "rate_limit"

    def test_http_error_on_5xx(self):
        req = httpx.Request("GET", "https://www.okx.com")
        resp = httpx.Response(503, request=req)
        exc = httpx.HTTPStatusError("503", request=req, response=resp)
        assert self.mod._classify_failure(exc) == "http_error"

    def test_http_error_on_4xx_non_429(self):
        req = httpx.Request("GET", "https://www.okx.com")
        resp = httpx.Response(404, request=req)
        exc = httpx.HTTPStatusError("404", request=req, response=resp)
        assert self.mod._classify_failure(exc) == "http_error"

    def test_network_on_timeout(self):
        exc = httpx.ReadTimeout("timed out")
        assert self.mod._classify_failure(exc) == "network"

    def test_network_on_connect_error(self):
        exc = httpx.ConnectError("connect refused")
        assert self.mod._classify_failure(exc) == "network"

    def test_network_on_asyncio_timeout(self):
        exc = asyncio.TimeoutError()
        assert self.mod._classify_failure(exc) == "network"

    def test_delisted_from_okx_code(self):
        exc = RuntimeError("OKX market error code=51000 msg=Instrument not exist")
        assert self.mod._classify_failure(exc) == "delisted"

    def test_other_as_fallback(self):
        exc = ValueError("unexpected shape")
        assert self.mod._classify_failure(exc) == "other"

    def test_bounded_cardinality(self):
        """Every reason this classifier can return must be in the 5-bucket
        set. If someone adds a new bucket they must update the zero-fill
        list in api/main.py:_refresh_ohlcv_metrics_from_status_file too —
        this test + the matching list comparison keeps the two in sync."""
        expected = {"rate_limit", "network", "http_error", "delisted", "other"}
        main_src = (Path(__file__).parent.parent / "api" / "main.py").read_text()
        # Extract the reason tuple from main.py's zero-fill loop
        # (inline check — tolerates formatting variation but requires the
        # canonical set to appear as a single parenthesized sequence).
        import re
        match = re.search(
            r'for reason in \(([^)]+)\):',
            main_src,
        )
        assert match, "zero-fill loop pattern not found in api/main.py"
        reasons_in_main = {
            r.strip().strip('"').strip("'") for r in match.group(1).split(",")
        }
        assert reasons_in_main == expected, (
            f"main.py zero-fill buckets {reasons_in_main} diverged from "
            f"classifier buckets {expected}. Update both or Grafana labels drift."
        )


class TestMetricsEndpointOhlcvRefresh:
    """The /metrics endpoint must surface ohlcv status file contents as
    gauges so Grafana can alert on staleness or failure surge."""

    def test_refresh_reads_status_file(self, monkeypatch, tmp_path):
        status_file = tmp_path / "ohlcv_last_run.json"
        status_file.write_text(json.dumps({
            "timestamp": 1713600000.0,
            "total_updated": 230,
            "failures_by_reason": {"rate_limit": 2, "network": 1},
        }))
        monkeypatch.setenv("PRUVIQ_OHLCV_STATUS_FILE", str(status_file))

        import importlib
        import api.main as main
        importlib.reload(main)
        main._refresh_ohlcv_metrics_from_status_file()

        # Verify the gauges got set. `_pm` is the metrics module alias.
        pm = main._pm
        # prometheus_client's Gauge stores per-label values; read back via
        # `_value.get()` on the default-no-label gauge and `.labels().get()`
        # for the labeled one.
        ts_value = pm.OHLCV_LAST_RUN_TIMESTAMP._value.get()
        assert ts_value == 1713600000.0

        updated_value = pm.OHLCV_LAST_RUN_UPDATED._value.get()
        assert updated_value == 230.0

        # Failure gauges: all 5 buckets must have a value (zero-fill)
        for reason in ("rate_limit", "network", "http_error", "delisted", "other"):
            v = pm.OHLCV_LAST_RUN_ERRORS.labels(reason=reason)._value.get()
            assert v is not None, f"{reason} bucket not populated"

        # Specific known values
        rate = pm.OHLCV_LAST_RUN_ERRORS.labels(reason="rate_limit")._value.get()
        assert rate == 2.0
        net = pm.OHLCV_LAST_RUN_ERRORS.labels(reason="network")._value.get()
        assert net == 1.0
        # Missing reasons → zero (not stale)
        http_err = pm.OHLCV_LAST_RUN_ERRORS.labels(reason="http_error")._value.get()
        assert http_err == 0.0

    def test_refresh_noop_when_file_missing(self, monkeypatch, tmp_path):
        """If the file doesn't exist, the helper must not raise — it's an
        observability channel, failures there must never affect /metrics
        availability."""
        monkeypatch.setenv(
            "PRUVIQ_OHLCV_STATUS_FILE", str(tmp_path / "absent.json"),
        )
        import importlib
        import api.main as main
        importlib.reload(main)
        # Should not raise
        main._refresh_ohlcv_metrics_from_status_file()

    def test_refresh_noop_on_corrupt_file(self, monkeypatch, tmp_path):
        """Corrupt JSON should not crash /metrics either."""
        status_file = tmp_path / "ohlcv_last_run.json"
        status_file.write_text("{not valid json")
        monkeypatch.setenv("PRUVIQ_OHLCV_STATUS_FILE", str(status_file))
        import importlib
        import api.main as main
        importlib.reload(main)
        main._refresh_ohlcv_metrics_from_status_file()  # must not raise
