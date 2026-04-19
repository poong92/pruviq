# PRUVIQ — Grafana Cloud Observability

Versioned Grafana artifacts for the DO-hosted pruviq-api:

| File | Purpose | Import path |
|------|---------|-------------|
| `dashboard-pruviq-api.json` | Single-page overview — HTTP, Signal Scanner, OKX, SQLite, Auto-trading | Grafana → Dashboards → Import → Upload JSON |
| `alerts-pruviq-api.yaml` | 5 alert rules (API Down, 5xx spike, scan slow, OKX error rate, SQLite contention) | Grafana → Alerting → Alert rules → Import |

## Data flow

```
pruviq-api :8080 /metrics  ──scraped by──►  Alloy (localhost)  ──remote_write──►  Grafana Cloud Prometheus (ap-northeast-0)
```

Alloy config lives on DO at `/etc/alloy/config.alloy`. Grafana stack: `pruviq`.
Prometheus remote_write URL: `https://prometheus-prod-49-prod-ap-northeast-0.grafana.net/api/prom/push`.

## Panels covered by `dashboard-pruviq-api.json`

Row 1 — **Overview**:
- Request rate (sum by status_class)
- p95 latency (overall)
- In-flight requests gauge
- Auto-trading sessions enabled
- Active signals in cache

Row 2 — **HTTP**:
- Request duration heatmap (by endpoint)
- Top 5 slowest endpoints table
- Error rate (4xx vs 5xx)

Row 3 — **Signal Scanner**:
- Scan duration p50/p95/p99 timeseries
- Scan timeouts per minute (by caller)

Row 4 — **OKX**:
- API calls by category (rate)
- Order execution outcomes (stacked area)

Row 5 — **SQLite**:
- busy_retries rate

## Alerts (`alerts-pruviq-api.yaml`)

| Name | PromQL | Threshold | For | Severity |
|------|--------|-----------|-----|----------|
| `PruviqApiDown` | `up{job="pruviq_api"}` | `== 0` | 2m | critical |
| `PruviqHttp5xxSpike` | `sum(rate(pruviq_http_request_duration_seconds_count{status_class="5xx"}[5m]))` | `> 0.05` (3 per min) | 5m | warning |
| `PruviqScanSlow` | `histogram_quantile(0.95, sum(rate(pruviq_signal_scan_duration_seconds_bucket[5m])) by (le))` | `> 45s` | 10m | warning |
| `PruviqOkxErrorRate` | `sum(rate(pruviq_okx_api_calls_total{status_class!="2xx"}[5m])) / sum(rate(pruviq_okx_api_calls_total[5m]))` | `> 0.1` (10%) | 5m | warning |
| `PruviqSqliteContention` | `rate(pruviq_sqlite_busy_retries_total[5m])` | `> 1.0/s` | 5m | warning |

Contact point: Telegram (via webhook → `PRUVIQ_TELEGRAM_CHAT_ID`) — wire in Grafana UI under Alerting → Contact points.

## Updating the dashboard

1. Edit panels in Grafana UI
2. Export JSON: Dashboard settings → JSON Model → copy
3. Overwrite `dashboard-pruviq-api.json`
4. Commit with `feat(grafana): ...` prefix
5. On next import, use "Replace" option to overwrite live dashboard

Dashboards in Grafana Cloud can also be provisioned via API, but manual import works fine at current scale (single environment, single dashboard).
