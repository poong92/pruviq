---
name: "ADX Trend Short"
description: "Short when ADX > 25 confirms a strong downtrend and DMI- crosses above DMI+. Verified — 487 trades, PF 1.68, OOS/IS ratio 1.01 (zero decay), measured 2026-05-04."
status: "verified"
category: "hybrid"
direction: "short"
difficulty: "intermediate"
winRate: 65.5
profitFactor: 1.68
timeframe: "12H"
coins: 50
dataPoints: 487
dateAdded: "2026-05-04"
dateUpdated: "2026-05-04"
tags: ["adx", "dmi", "trend", "short", "verified"]
---

## Overview

The ADX Trend Short strategy combines two components of the Directional Movement System: **ADX** (Average Directional Index) measures raw trend strength regardless of direction, while **DMI−** (Minus Directional Indicator) confirms the bearish direction. A SHORT entry fires only when both agree — strong trend *and* downside direction confirmed by a fresh cross.

Discovered 2026-05-04 via a 4,116-combination parameter sweep across 50 coins. The 12H timeframe with SL 15% / TP 5% produced an OOS/IS profit-factor ratio of **1.01** — meaning the strategy performed equally in unseen data as in its training window. This zero-decay characteristic earned it **verified** status.

## How It Works

1. **ADX filter** — ADX(14) must be above 25, confirming the market is in a trending (not ranging) regime
2. **DMI cross** — DMI− (selling pressure) crosses above DMI+ (buying pressure) on the current bar
3. **Entry** — SHORT on the next bar's open after the cross is confirmed
4. **Exit** — TP 5% / SL 15% / 4-bar (2-day on 12H) timeout

## Why It Works (Thesis)

ADX above 25 filters out choppy, low-volatility markets where crossover signals are noise. By requiring a concurrent DMI− cross, the strategy enters *after* directional commitment has been established — not on anticipation. The result: a high-WR setup (65.5%) where most entries are aligned with genuine trend momentum rather than mean-reverting noise.

The 12H timeframe eliminates intraday noise that plagues 4H and 6H signals, producing cleaner trend confirmation with more decisive follow-through. The wide SL (15%) accommodates the natural volatility at this timeframe while the tight TP (5%) locks in profits quickly — the market rarely gives back gains once a 12H trend is established.

## Results (2-year backtest, IS/OOS split, measured 2026-05-04)

| Metric | IS (May24–May25) | OOS (May25–May26) | Combined |
|--------|-----------------|------------------|---------|
| Total trades | 239 | 248 | 487 |
| Win rate | ~65% | ~66% | 65.5% |
| Profit factor | 1.68 | 1.70 | 1.68 |
| Coins profitable | 37/50 | 36/50 | — |

**OOS/IS ratio: 1.01** — OOS profit factor (1.70) exceeded IS (1.68). This is the defining characteristic of this strategy: the edge does not decay in unseen data.

**Multi-window (4 rolling 6-month periods, 6H scan):** W1=2.02 · W2=1.69 · W3=1.28 · W4=1.27 — profitable in all 4 windows. The 12H variant was selected as optimal from this scan.

## Caveats

- 12H signals fire roughly once per coin every 2–3 days — lower frequency than shorter timeframes.
- Wide SL (15%) means individual losses can be substantial; manage position size accordingly.
- 487 total trades across 50 coins over 2 years — thin per-coin sample; diversification across coins is important.
- Not live-tracked on OKX. Backtest only.
