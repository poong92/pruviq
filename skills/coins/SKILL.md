---
name: coins
description: View PRUVIQ coin data - total count, top/bottom performers, search
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["curl", "jq"] }, "emoji": "🪙", "os": ["darwin", "linux"] } }
---

# /coins - Coin Data Explorer

Browse and search PRUVIQ coin statistics.

## Usage
```
/coins summary           # Overview + top 5 / bottom 5
/coins search BTCUSDT    # Search specific coin stats
```

## Summary Output
- Total coin count
- Top 5 by win rate (with PF, trade count)
- Bottom 5 by win rate

## Search Output
- Win Rate
- Profit Factor
- Total Trades
- Average PnL %

## Data Source
Fetches from api.pruviq.com/coins/stats (pre-computed statistics for 535+ coins).
