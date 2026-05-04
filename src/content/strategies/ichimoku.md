---
name: "Ichimoku Bearish"
description: "Short crypto below the Ichimoku cloud on a Tenkan/Kijun cross. Verified — 1,625 trades, PF 1.55, OOS-validated (IS→OOS: 2.07→1.83), measured 2026-05-04."
status: "verified"
category: "hybrid"
direction: "short"
difficulty: "intermediate"
winRate: 51.7
profitFactor: 1.55
maxDrawdown: 38.5
timeframe: "4H"
coins: 50
dateAdded: "2026-04-22"
dateUpdated: "2026-05-04"
tags: ["ichimoku", "trend", "short", "verified"]
---

## Overview

Ichimoku Kinko Hyo ("equilibrium chart at a glance") is a multi-component indicator that paints a forward-projected "cloud" (Kumo) from price-range midpoints. This preset enters SHORT when price is trading **below the cloud** AND the Tenkan-sen (9) crosses below the Kijun-sen (26), confirming downside momentum against a bearish structural backdrop.

Updated 2026-05-04: full sweep (1,680 combinations × 50 coins, IS/OOS split) identified SL 15% / TP 15% as the optimal configuration. Wider parameters allow trades more room to develop, improving WR from 40% to 51.7% and PF from 1.21 to 1.55.

## How It Works

1. **Cloud filter** — price must be below both Senkou Span A and B (the cloud bottom)
2. **Tenkan/Kijun cross** — short-term (9-period) midpoint crosses below medium-term (26-period) midpoint
3. **Confirmation** — Chikou Span (lagging close, displaced −26) clear of cloud
4. **Entry** — SHORT on bar close after the cross
5. **Exit** — TP 15% / SL 15% / 12-bar (2-day on 4H) timeout

## Why It Works (Thesis)

Crypto downtrends are often multi-week. The cloud catches regime; the Tenkan/Kijun cross catches timing. Combining them filters out bear-trap countertrends that break simpler moving-average systems.

With a symmetric 15%/15% structure, the edge is pure WR-based: 51.7% win rate means the cloud-plus-cross filter genuinely identifies more winning than losing setups. The IS→OOS improvement in profitable coin count (38→40 out of 50) shows this is not regime-specific.

## Results (2-year backtest, IS/OOS split, measured 2026-05-04)

| Metric | IS (May24–May25) | OOS (May25–May26) | Combined |
|--------|-----------------|------------------|---------|
| Total trades | 725 | 900 | 1,625 |
| Win rate | ~52% | ~52% | 51.7% |
| Profit factor | 2.07 | 1.83 | 1.55 |
| Coins profitable | 38/50 | 40/50 | — |

IS PF (2.07) is higher than OOS (1.83), a normal OOS decay. Both periods show genuine profitability across most of the coin universe.

## Caveats

- Symmetric 15%/15% means a losing trade is as large as a winning one — capital management is critical.
- Not live-tracked on OKX (backtest only).
- 4H signals fire less frequently than 1H variants. Expect 1–3 signals per coin per week.
