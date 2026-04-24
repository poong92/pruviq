---
name: "Ichimoku Bearish"
description: "Short crypto below the Ichimoku cloud on a Tenkan/Kijun cross. Verified — 953 trades, PF 1.21, Sharpe 0.85, measured 2026-04-22."
status: "verified"
category: "hybrid"
direction: "short"
difficulty: "intermediate"
winRate: 40.61
profitFactor: 1.21
maxDrawdown: 42.2
timeframe: "4H"
coins: 235
dateAdded: "2026-04-22"
tags: ["ichimoku", "trend", "short", "verified"]
---

## Overview

Ichimoku Kinko Hyo ("equilibrium chart at a glance") is a multi-component indicator that paints a forward-projected "cloud" (Kumo) from price-range midpoints. This preset inverts the classic long setup: it enters SHORT when price is trading **below the cloud** AND the Tenkan-sen (9) crosses below the Kijun-sen (26), confirming downside momentum against a bearish structural backdrop.

## How It Works

1. **Cloud filter** — price must be below both Senkou Span A and B (the cloud bottom)
2. **Tenkan/Kijun cross** — short-term (9-period) midpoint crosses below medium-term (26-period) midpoint
3. **Confirmation** — Chikou Span (lagging close, displaced −26) clear of cloud
4. **Entry** — SHORT on bar close after the cross
5. **Exit** — fixed TP 15% / SL 3% (tested tightest of the 5 verified presets)

## Why It Works (Thesis)

Crypto downtrends are often multi-week. The cloud catches regime; the Tenkan/Kijun cross catches timing. Combining them filters out bear-trap countertrends that break simpler moving-average systems.

## Results (2-year backtest, measured 2026-04-22)

| Metric | Value |
|--------|-------|
| Total trades | 953 |
| Win rate | 40.61% |
| Profit factor | 1.21 |
| Sharpe | 0.85 |
| Total return | +155.05% |
| Max drawdown | 42.2% |

Low win rate is expected for trend-following shorts — edge comes from average win size > average loss, visible in PF > 1.

## Caveats

- 42.2% max drawdown is substantial. Position-size accordingly.
- Not live-tracked on OKX (backtest only). See the simulator's TrustGap panel for the difference this matters.
- Tight 3% stop-loss means frequent stop-outs during noise — this is a feature (preserves capital for clean breaks), not a bug.
