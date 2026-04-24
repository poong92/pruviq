---
name: health
description: PRUVIQ full system health check - API, frontend, data freshness
user-invocable: true
---

# /health - PRUVIQ System Health Check

Run a comprehensive health check across the entire PRUVIQ platform.

## What it checks
1. **API** (api.pruviq.com) - HTTP status, response time, coins loaded, uptime
2. **Frontend** (pruviq.com) - HTTP status, TTFB
3. **Key Pages** - /coins/, /simulate/, /strategies/
4. **Data Freshness** - Coin count from /coins/stats

## Usage
```
/health
```

## Output format
Reports each component with status emoji (✅/⚠️/❌), response time in ms, and details.

## Thresholds
- API response > 2s = WARNING
- API response > 5s = CRITICAL
- Frontend TTFB > 3s = WARNING
- Coin count < 530 = WARNING (expected 535+)
