---
name: "ATR Breakout SHORT"
description: "Short when ATR spike signals a volatility expansion to the downside. Verified — 2,839 trades, PF 1.42, OOS-validated (IS→OOS: 1.57→1.28), measured 2026-05-04."
status: "verified"
category: "breakout"
direction: "short"
difficulty: "intermediate"
winRate: 35.9
profitFactor: 1.42
maxDrawdown: 42.1
timeframe: "1H"
coins: 50
dateAdded: "2026-01-18"
dateUpdated: "2026-05-04"
tags: ["atr", "breakout", "short", "verified"]
---

## Overview

ATR Breakout SHORT fires when the Average True Range (14-period) spikes above its moving average threshold — signalling a volatility expansion — and price is moving downward. Unlike BB Squeeze which waits for compression first, this strategy catches the early momentum of a directional volatility burst.

Re-verified 2026-05-04 via full sweep (1,680 combinations × 50 coins, IS/OOS split). Prior shelved status was based on comparison with BB Squeeze (now killed) using ATR-multiple configs. Fixed SL/TP format reveals a clear short-side edge.

## How It Works

1. **ATR spike** — 14-period ATR crosses above 1.5× its 20-period moving average
2. **Directional filter** — price below its 20-period MA confirms downward bias
3. **Volume confirmation** — volume ≥ 1.5× 20-period average
4. **Entry** — SHORT on bar close
5. **Exit** — TP 10% / SL 3% / 48-bar (2-day) timeout
6. **Risk** — asymmetric: 1:3.3 R:R (3% risk, 10% reward)

## Why It Works (Thesis)

ATR spikes in crypto typically mean one of two things: a genuine directional move, or a wick-spike that reverts. On a 1H timeframe with the 3% SL, you get stopped out quickly when it's a wick. When it's a real downward expansion — an altcoin breaks support, a leverage cascade starts — the 10% TP captures the bulk of the move.

The SHORT edge (not LONG) is structural: in crypto, downward volatility expansions tend to be sharper and less frequently faded by new buyers in the first 2 hours. Upward expansions attract FOMO buyers that compress the follow-through.

## Results (2-year backtest, IS/OOS split, measured 2026-05-04)

| Metric | IS (May24–May25) | OOS (May25–May26) | Combined |
|--------|-----------------|------------------|---------|
| Total trades | 1,513 | 1,326 | 2,839 |
| Win rate | ~38% | ~34% | 35.9% |
| Profit factor | 1.57 | 1.28 | 1.42 |
| Coins profitable | 48/50 | 36/50 | — |

Low win rate is by design — the 1:3.3 R:R means each win covers 3+ losses.

## Caveats

- OOS PF (1.28) is lower than IS (1.57) — some IS outperformance did not carry forward. This is the weakest of the three sweep survivors.
- Tight 3% SL generates frequent stop-outs. Requires accepting 64% loss rate.
- Not live-tracked. Backtest only.
- All LONG configurations remain unprofitable on OOS data.
