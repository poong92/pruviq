---
name: pipeline
description: Monitor and manage the PRUVIQ data pipeline (OHLCV updates, demo data)
user-invocable: true
---

# /pipeline - Data Pipeline Management

Check the status of the daily data pipeline or trigger a manual run.

## Pipeline Flow
1. Update OHLCV data from Binance (535+ coins, 1H candles)
2. Generate demo data for frontend
3. Refresh API data cache
4. Git push updated data
5. Health check

## Usage
```
/pipeline status   # Check last run and data freshness
/pipeline run      # Manually execute the full pipeline
```

## Schedule
- Automatic: Daily at 02:30 UTC (cron on Mac Mini)
- Manual: Via this skill when needed

## Prerequisites
- SSH access to Mac Mini (jepo@172.30.1.16)
- Tailscale VPN connection
