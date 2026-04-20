# PRUVIQ — Grafana Alloy config

Versioned source-of-truth for the Grafana Alloy agent running on DO
(`167.172.81.145:2222` — see SECURITY.md for disclosure scope).

Alloy collects:
- **Metrics**: `/metrics` on `pruviq-api` → Grafana Cloud Prometheus
- **Logs**: systemd-journald for all `pruviq-*` services + alloy + litestream → Grafana Cloud Loki

## Files

| File | Purpose |
|------|---------|
| `config.alloy` | Alloy configuration. Deploy to `/etc/alloy/config.alloy` on DO. |

## Deploy

```bash
# From repo root, on DO:
sudo cp /opt/pruviq/current/backend/deploy/alloy/config.alloy /etc/alloy/config.alloy
sudo systemctl restart alloy

# Verify within 30s:
sudo journalctl -u alloy -n 50 --no-pager | grep -E "Done replaying WAL|remote_write|loki"
```

Expected log lines after restart:
```
msg="Done replaying WAL" component_id=prometheus.remote_write.grafana_cloud ...
msg="Loki push endpoint" url=https://logs-prod-...grafana.net/loki/api/v1/push
```

## Environment variables (`/etc/alloy/env.conf`)

The systemd drop-in at `/etc/systemd/system/alloy.service.d/env.conf` must
define:

```ini
[Service]
Environment=GRAFANA_REMOTE_WRITE_URL=https://prometheus-prod-49-prod-ap-northeast-0.grafana.net/api/prom/push
Environment=GRAFANA_USERNAME=<prometheus instance id numeric>
Environment=GRAFANA_API_TOKEN=glc_xxxxxxxxxxxx
# NEW 2026-04-20 (Loki):
Environment=GRAFANA_LOKI_URL=https://logs-prod-<region>-ap-northeast-0.grafana.net/loki/api/v1/push
Environment=GRAFANA_LOKI_USERNAME=<loki instance id numeric — from Grafana Cloud portal "Loki" tab>
```

The token is the same cloud-access policy token used for Prometheus (needs
`metrics:write` + `logs:write` scopes).

## Label cardinality budget

Loki bills on active series; high-cardinality labels explode cost fast.
We keep the label set to **4 labels max** per stream:

- `host` (1 value: `app-server-01`)
- `unit` (~11 values: pruviq-api, pruviq-update-ohlcv, ... alloy, litestream)
- `service_name` (derived from unit)
- `level` (7 values: emerg/alert/crit/err/warning/notice/info/debug)

**Do NOT** add request-ID, session-ID, coin-symbol, or similar high-
cardinality fields as labels. Put them in the log line body and filter
with `|~` regex in Loki queries instead.

## Querying logs (once deployed)

In Grafana Cloud Explore:

```logql
# All errors from pruviq-api
{unit="pruviq-api.service", level="err"}

# OHLCV failures with specific symbol
{unit="pruviq-update-ohlcv.service"} |~ "ERROR\\[.*\\]"

# Signal scan timeouts across all auto-trade runs
{unit=~"pruviq-.*"} |~ "signal scan .* timed out"

# Alloy itself (self-monitoring)
{unit="alloy.service"} |~ "(error|fail)"
```

## Current coverage (2026-04-20)

11 units tailed — matches current `systemctl list-timers pruviq-*` +
always-on services. If a new timer/service is added to
`backend/deploy/systemd/`, update the `matches` field in `config.alloy`
and redeploy.
