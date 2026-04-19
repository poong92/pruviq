"""
/metrics endpoint + middleware instrumentation regression guard.

architecture-audit HIGH #8: today's 13-min uvicorn hang was invisible
in real-time (only caught via 5-min pruviq-monitor cron post-hoc).
/metrics with per-endpoint p99 latency would have shown saturation
within seconds.

This PR instruments request duration + in-flight gauge + named signal/OKX/
SQLite counters. Grafana Cloud scrape (separate ops item) turns them into
dashboards and alerts.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from fastapi.testclient import TestClient


def test_metrics_endpoint_serves_text_format():
    """/metrics must respond 200 with Prometheus text/plain content-type."""
    from api.main import app
    client = TestClient(app)
    resp = client.get("/metrics")
    assert resp.status_code == 200
    # Content-Type is `text/plain; version=0.0.4; charset=utf-8` or similar
    ctype = resp.headers.get("content-type", "")
    assert "text/plain" in ctype or "application/openmetrics" in ctype, (
        f"Content-Type {ctype!r} — Prometheus expects text/plain exposition"
    )
    body = resp.text
    # HELP + TYPE lines for each metric family
    assert "# HELP pruviq_http_request_duration_seconds" in body
    assert "# TYPE pruviq_http_request_duration_seconds histogram" in body


def test_metrics_endpoint_includes_signal_and_okx_counters():
    """The exposition must list every declared metric family so Grafana
    dashboards can be authored without a first-scrape chicken-and-egg."""
    from api.main import app
    client = TestClient(app)
    body = client.get("/metrics").text
    for name in (
        "pruviq_http_request_duration_seconds",
        "pruviq_http_requests_in_flight",
        "pruviq_signal_scan_duration_seconds",
        "pruviq_signal_scan_timeouts_total",
        "pruviq_signal_cache_active",
        "pruviq_okx_api_calls_total",
        "pruviq_okx_order_executions_total",
        "pruviq_sqlite_busy_retries_total",
        "pruviq_auto_sessions_enabled",
    ):
        assert name in body, f"{name} missing from /metrics exposition"


def test_middleware_records_request_duration():
    """After one probe, the histogram for that endpoint must have observations."""
    from api.main import app
    client = TestClient(app)
    # Probe a known endpoint (should be 200 without auth)
    resp = client.get("/health")
    assert resp.status_code == 200
    # Scrape
    body = client.get("/metrics").text
    # Expect a sample line for /health, method GET, 2xx
    # Metric format: pruviq_http_request_duration_seconds_count{...} N
    pattern = re.compile(
        r'pruviq_http_request_duration_seconds_count\{[^}]*endpoint="/health"[^}]*method="GET"[^}]*status_class="2xx"[^}]*\}\s+([0-9.]+)'
    )
    m = pattern.search(body)
    assert m, (
        "No histogram sample for /health after GET. Middleware may not be "
        "recording or the route-template extraction returned a different "
        "endpoint label."
    )
    assert float(m.group(1)) >= 1, (
        f"Histogram count {m.group(1)} expected >= 1 after one GET /health"
    )


def test_metrics_endpoint_excluded_from_its_own_measurement():
    """If /metrics were itself instrumented, every scrape would double-count
    and histograms would be self-contaminating. Middleware must skip it."""
    from api.main import app
    client = TestClient(app)
    # Hit /metrics twice
    _ = client.get("/metrics").text
    body = client.get("/metrics").text
    # Look for samples with endpoint="/metrics" — should NOT exist
    assert 'endpoint="/metrics"' not in body, (
        "/metrics itself is being instrumented — creates self-referential "
        "histograms that grow every scrape."
    )


def test_requirements_lists_prometheus_client():
    """Regression: dropping prometheus-client from requirements.txt would
    make the metrics module import succeed in dev (.venv has it) but fail
    on DO fresh deploy. Pin explicit in requirements."""
    reqs = (Path(__file__).resolve().parent.parent / "requirements.txt").read_text()
    assert re.search(r"^\s*prometheus-client\b", reqs, re.MULTILINE), (
        "prometheus-client missing from requirements.txt — /metrics will "
        "503 on fresh DO deploys."
    )


def test_metrics_endpoint_noauth_but_bounded_cardinality():
    """No auth by design (internal-only via DO). The real risk is label
    cardinality explosion — source-level check that we never use raw
    query strings or user IDs as labels."""
    src = (Path(__file__).resolve().parent.parent / "api" / "metrics.py").read_text()
    # All Histogram/Counter label lists enumerable
    for bad_label in ("session_id", "user_id", "ip", "email", "token"):
        assert bad_label not in src.lower() or f'"{bad_label}"' not in src, (
            f"metrics.py uses forbidden high-cardinality label {bad_label!r}"
        )
    # At most 10 labels total across all instruments (sanity)
    labels = re.findall(r'\["([^"\]]+)"\]', src)
    # Each match is a single-label list — count unique label names
    unique = set()
    for m in re.finditer(r'\[(.*?)\]', src):
        for part in m.group(1).split(","):
            p = part.strip().strip('"').strip("'")
            if p and p.isidentifier():
                unique.add(p)
    assert len(unique) <= 15, (
        f"Too many distinct label names {sorted(unique)} — risk of "
        "cardinality explosion"
    )
