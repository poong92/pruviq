# Disabled systemd units

Units here are **not synced** to DO by `backend-deploy.yml` (the sync glob is
`pruviq-*.{service,timer}` at the `systemd/` top level, which doesn't match
subdirectories).

Files are preserved — not deleted — so the design can be revived if Phase 5
assumptions change.

## pruviq-refresh-data.{service,timer} + bin/refresh-data.sh

**Why disabled (2026-04-18 audit):**

- Intended for a full-DO data-fetch (Phase 5): Binance + CoinGecko + news RSS
  refreshed every 20 min from DO instead of Mac cron.
- **Blocker:** Binance geo-restricts DigitalOcean IPs (HTTP 451). Fetching
  from DO fails unless routed through a proxy.
- Current workaround: Mac cron (`*/20 * * * * refresh_static.sh`) fetches +
  builds + deploys. DO only owns OKX-native paths (OHLCV) via
  `pruviq-update-ohlcv.timer`.
- Keeping the unused unit on DO caused confusion (e.g. `staleness-watch.sh`
  tried to `systemctl start pruviq-refresh-data.service` — removed in PR #1137
  as part of the "no fake self-heal" refactor).

**Re-enable when:**

- Binance fetch is routed through a persistent CF Worker proxy
  (`binance-proxy.pruviq.com`) that can survive without Mac, **and**
- We decide to retire Mac cron for data fetch (currently retained as a
  deliberate split per the 2026-04-18 architectural decision).

**To re-enable:**

1. `git mv backend/deploy/systemd/disabled/pruviq-refresh-data.{service,timer} backend/deploy/systemd/`
2. `git mv backend/deploy/systemd/disabled/bin/refresh-data.sh backend/deploy/systemd/bin/`
3. Verify unit `EnvironmentFile=/opt/pruviq/shared/.env` has `BINANCE_PROXY_URL` set.
4. Merge PR, backend-deploy.yml syncs the files, then on DO:
   ```
   systemctl daemon-reload
   systemctl enable --now pruviq-refresh-data.timer
   ```
5. Remove the Mac cron entry for `refresh_static.sh` to avoid dual-write.
