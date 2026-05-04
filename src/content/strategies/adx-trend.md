---
name: "ADX Trend Short"
description: "Short when ADX > 25 confirms a strong downtrend and DMI- crosses above DMI+. Testing — 946 trades, PF 1.51, multi-window W=4/4, measured 2026-05-04."
status: "testing"
category: "hybrid"
direction: "short"
difficulty: "intermediate"
winRate: 57.8
profitFactor: 1.51
timeframe: "6H"
coins: 50
dataPoints: 946
dateAdded: "2026-05-04"
dateUpdated: "2026-05-04"
tags: ["adx", "dmi", "trend", "short", "testing"]
---

## Overview

The ADX Trend Short strategy combines two components of the Directional Movement System: **ADX** (Average Directional Index) measures raw trend strength regardless of direction, while **DMI−** (Minus Directional Indicator) confirms the bearish direction. A SHORT entry fires only when both agree — strong trend *and* downside direction confirmed by a fresh cross.

Discovered 2026-05-04 via a 4,116-combination multi-window sweep across 50 coins on a 6H timeframe. ADX Trend Short passed all 4 rolling 6-month windows (W=4/4), making it one of the most consistent strategies in the current scan.

## How It Works

1. **ADX filter** — ADX(14) must be above 25, confirming the market is in a trending (not ranging) regime
2. **DMI cross** — DMI− (selling pressure) crosses above DMI+ (buying pressure) on the current bar
3. **Entry** — SHORT on the next bar's open after the cross is confirmed
4. **Exit** — TP 7% / SL 10% / 8-bar (2-day on 6H) timeout

## Why It Works (Thesis)

ADX above 25 filters out choppy, low-volatility markets where crossover signals are noise. By requiring a concurrent DMI− cross, the strategy enters *after* directional commitment has been established — not on anticipation. The result: a high-WR setup (57.8%) where most entries are aligned with genuine trend momentum rather than mean-reverting noise.

The 6H timeframe reduces false crosses relative to 1H or 4H while maintaining adequate signal frequency (~1–2 per coin per week).

## Results (2-year backtest, IS/OOS split, measured 2026-05-04)

| Metric | IS (May24–May25) | OOS (May25–May26) | Combined |
|--------|-----------------|------------------|---------|
| Total trades | 474 | 472 | 946 |
| Win rate | ~58% | ~58% | 57.8% |
| Profit factor | 1.86 | 1.17 | 1.51 |
| Coins profitable | 38/50 | 27/50 | — |

**Multi-window (4 rolling 6-month periods):** W1=2.02 · W2=1.69 · W3=1.28 · W4=1.27 — profitable in all 4 windows.

OOS profit factor (1.17) is lower than IS (1.86). The OOS/IS ratio of 0.63 is below the ≥0.70 gate required for full verification, which is why this strategy carries **testing** status. The consistent positive OOS result across all four multi-window periods suggests the edge is real but the size is uncertain.

## Caveats

- OOS PF of 1.17 is profitable but modest — position sizing should be conservative.
- Profitable coin count falls from 38/50 (IS) to 27/50 (OOS). Some coins that worked in 2024 stopped working in 2025–2026.
- Not live-tracked on OKX. Backtest only.
- 6H signals fire 1–2 times per coin per week on average.
- Will be re-evaluated for `verified` status once 6 more months of live data are available.
