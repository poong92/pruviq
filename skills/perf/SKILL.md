---
name: perf
description: Performance benchmark for PRUVIQ API endpoints and frontend pages
user-invocable: true
---

# /perf - Performance Benchmark

Measure response times across all PRUVIQ API endpoints and frontend pages.

## Usage
```
/perf
```

## Endpoints Tested

### API (api.pruviq.com)
| Endpoint | Expected | Warning |
|----------|----------|---------|
| /health | < 500ms | > 2s |
| /coins/stats | < 2s | > 5s |
| /strategies | < 1s | > 3s |
| /market | < 2s | > 5s |
| /builder/presets | < 1s | > 3s |
| /ohlcv/BTCUSDT | < 1s | > 3s |
| /simulate (POST) | < 10s | > 30s |

### Frontend (pruviq.com)
| Page | Expected TTFB | Warning |
|------|---------------|---------|
| / | < 1s | > 3s |
| /coins/ | < 2s | > 5s |
| /simulate/ | < 2s | > 5s |

## Output
Shows response time in ms with status indicators (✅ OK / ⚠️ Slow / ❌ Error).
