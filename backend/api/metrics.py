"""
Prometheus metrics instrumentation for PRUVIQ API.

Exposes `/metrics` in the Prometheus text format so Grafana Cloud (or
self-hosted Prometheus) can scrape request latency, OKX API call counts,
signal scan duration, and SQLite lock-retry rates.

Guiding principles:
  - Bounded cardinality. Label values are enumerable (method, endpoint
    template, status class) — never raw paths or user IDs.
  - Low overhead. prometheus_client uses atomic counters + lock-free
    histograms; measured <1µs per observation.
  - Safe defaults. If instrumentation itself fails, the caller is not
    affected (try/except around observation sites).

Scrape: `curl http://127.0.0.1:8080/metrics`. Content-type is
`text/plain; version=0.0.4` (Prometheus exposition format).

architecture-audit HIGH #8: previously only `/health` + 5-min
`pruviq-monitor.timer` cron. Today's 13-min hang would have shown up
as request_duration_seconds p99 spike 10+ minutes earlier.
"""
from __future__ import annotations

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

# ── Request-level metrics ────────────────────────────────────

# Latency per endpoint template. Template path (e.g. `/rankings/daily`
# not `/rankings/daily?period=30d`) keeps cardinality bounded.
# Buckets tuned to our user-facing SLOs: <100ms fast, 1-5s normal,
# 30s timeout sentinel. Anything >30s bucket shows as uvicorn hang.
HTTP_REQUEST_DURATION = Histogram(
    "pruviq_http_request_duration_seconds",
    "HTTP request duration by method + endpoint + status class",
    ["method", "endpoint", "status_class"],
    buckets=(
        0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0,
        2.5, 5.0, 10.0, 30.0, 60.0,
    ),
)

HTTP_REQUESTS_IN_FLIGHT = Gauge(
    "pruviq_http_requests_in_flight",
    "Concurrent in-flight requests (uvicorn worker saturation canary)",
)

# ── Signal scanner ──────────────────────────────────────────

# Captures the scan duration — if the auto-trading loop is clamped to
# 60s, p99 here > 45s means scans are running up against timeout.
SIGNAL_SCAN_DURATION = Histogram(
    "pruviq_signal_scan_duration_seconds",
    "signal_scanner.scan() wall-clock duration",
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 90.0, 120.0),
)

SIGNAL_SCAN_TIMEOUTS = Counter(
    "pruviq_signal_scan_timeouts_total",
    "Count of scans that hit the wait_for timeout (caller: which loop)",
    ["caller"],
)

SIGNAL_CACHE_SIZE = Gauge(
    "pruviq_signal_cache_active",
    "Active signals currently in scanner cache",
)

# ── OKX API calls ───────────────────────────────────────────

# Per-method counter — detects rate-limit burn (429s from OKX) and
# broken endpoints (5xx spikes).
OKX_API_CALLS = Counter(
    "pruviq_okx_api_calls_total",
    "OKX v5 REST calls by category + status class",
    ["category", "status_class"],
)

OKX_ORDER_EXECUTIONS = Counter(
    "pruviq_okx_order_executions_total",
    "End-to-end order execution attempts (NOT just API calls) by outcome",
    ["outcome"],  # executed, rate_limited, position_cap, error, rollback
)

# ── SQLite storage ──────────────────────────────────────────

# Observes how often busy_timeout kicks in. Steady non-zero = we're
# hitting the write-lock ceiling; uvicorn workers >=2 or move to
# async storage becomes justified.
SQLITE_BUSY_RETRIES = Counter(
    "pruviq_sqlite_busy_retries_total",
    "Times SQLite BUSY was retried (writer contention)",
)

# ── Auto-trading state ──────────────────────────────────────

AUTO_SESSIONS_ENABLED = Gauge(
    "pruviq_auto_sessions_enabled",
    "Current count of OKX sessions with auto-trading enabled",
)


# ── OHLCV refresh observability (2026-04-20) ──────────────────
#
# The OHLCV update script (update_ohlcv_okx.py) runs every 4h as a
# one-shot systemd oneshot. Because it isn't a long-lived process, it
# can't host a /metrics endpoint of its own. Instead it writes a status
# JSON at PRUVIQ_OHLCV_STATUS_FILE; /metrics on this API process reads
# it (via _refresh_ohlcv_metrics_from_status_file below) and re-emits
# as gauges so Alloy/Prometheus/Grafana can alert on staleness or
# per-reason failure surges.

OHLCV_LAST_RUN_TIMESTAMP = Gauge(
    "pruviq_ohlcv_last_run_timestamp_seconds",
    "Unix timestamp of the last completed OHLCV refresh run",
)

OHLCV_LAST_RUN_ERRORS = Gauge(
    "pruviq_ohlcv_last_run_failures",
    "Per-symbol failures from the last OHLCV refresh run, labeled by reason",
    ["reason"],
)

OHLCV_LAST_RUN_UPDATED = Gauge(
    "pruviq_ohlcv_last_run_updated_symbols",
    "How many symbol CSVs actually grew in the last refresh (progress signal)",
)


def render_exposition() -> tuple[bytes, str]:
    """Return (body, content_type) for the /metrics endpoint."""
    return generate_latest(), CONTENT_TYPE_LATEST
