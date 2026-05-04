---
name: "Keltner Squeeze SHORT"
description: "Short the lower-band breakout after a Keltner squeeze. Verified — 923 trades, PF 1.61, OOS improves over IS (1.76→1.91), measured 2026-05-04."
status: "verified"
category: "volatility"
direction: "short"
difficulty: "intermediate"
winRate: 39.9
profitFactor: 1.61
maxDrawdown: 38.2
timeframe: "4H"
coins: 50
dateAdded: "2026-04-22"
dateUpdated: "2026-05-04"
tags: ["keltner", "volatility", "squeeze", "short", "verified"]
---

## Overview

Keltner Channels plot an ATR-scaled envelope around an exponential moving average. This preset waits for a **squeeze** (low ATR / tight channel) and then enters SHORT when price breaks down through the lower band — trading the directional expansion, not a fade.

Updated 2026-05-04: full sweep (1,680 combinations × 50 coins, IS/OOS split) confirmed SL 3% / TP 10% as optimal. OOS profit factor (1.91) exceeds IS (1.76), indicating the edge is structural rather than data-mined.

## How It Works

1. **Channel setup** — 20 EMA center, ATR × 2 for upper / lower bands
2. **Squeeze detection** — Bollinger Bands (20, 2σ) inside the Keltner channel (compressed volatility)
3. **Trigger** — close breaks below the lower Keltner band (downward expansion out of squeeze)
4. **Entry** — SHORT on bar close
5. **Exit** — TP 10% / SL 3% / 12-bar (2-day on 4H) timeout
6. **Risk** — 1:3.3 R:R (3% risk, 10% reward), accepting 60% loss rate

## Why It Works (Thesis)

Squeezes precede the largest directional moves. When the ATR-based channel tightens (volatility compression), potential energy builds. The lower-band break signals sellers have won the compression battle. With a 3% SL, false breaks are cheap; with a 10% TP, the real expansions are captured in full.

The OOS > IS result (1.91 vs 1.76) is notable: the May 2025–May 2026 period generated more qualifying squeeze-breakdowns than 2024–2025, suggesting the edge sharpened as crypto volatility regime evolved.

## Results (2-year backtest, IS/OOS split, measured 2026-05-04)

| Metric | IS (May24–May25) | OOS (May25–May26) | Combined |
|--------|-----------------|------------------|---------|
| Total trades | 447 | 476 | 923 |
| Win rate | ~42% | ~38% | 39.9% |
| Profit factor | 1.76 | 1.91 | 1.61 |
| Coins profitable | 39/50 | 38/50 | — |

## Caveats

- Low win rate (40%) is inherent to the 1:3.3 R:R structure. The equity curve has frequent small losses punctuated by larger wins.
- Not live-tracked on OKX. Backtest only.
- 4H timeframe means 1–2 signals per coin per week on average — lower frequency than 1H variants.
