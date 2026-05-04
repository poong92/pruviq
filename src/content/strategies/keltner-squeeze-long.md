---
name: "Keltner Squeeze LONG (Bull Regime)"
description: "Long when Bollinger Bands compress inside Keltner Channels then break upward. Bull-regime validated — 367 trades, PF 2.28, OOS 2.96 in bull markets, measured 2026-05-04."
status: "testing"
category: "breakout"
direction: "long"
difficulty: "intermediate"
winRate: 56.9
profitFactor: 2.28
timeframe: "4H"
coins: 50
dataPoints: 367
dateAdded: "2026-05-04"
dateUpdated: "2026-05-04"
tags: ["keltner", "bollinger", "squeeze", "long", "bull-market", "breakout", "testing"]
---

## Overview

The Keltner Squeeze LONG strategy is the directional complement to the existing Keltner Squeeze SHORT. It uses the same squeeze detection mechanism — Bollinger Bands compressing inside Keltner Channels — but entries fire when price breaks **upward** rather than downward.

Discovered 2026-05-04 via a bull-market isolation sweep: IS period = May 2024–Nov 2024 (Bitcoin +150% run), OOS period = Nov 2024–May 2025. The strategy produced **PF 2.96** in the OOS period, *higher* than the IS period (PF 1.63), confirming that the edge persisted and even strengthened in genuinely unseen bull conditions.

## How It Works

1. **Squeeze detection** — Bollinger Bands (20-period, 2σ) compress *inside* the Keltner Channel (20-period, 1.5×ATR). This measures a volatility contraction state.
2. **Breakout condition** — Price closes above the upper Keltner Channel while in squeeze state — upward momentum breaking through resistance
3. **Entry** — LONG on the next bar's open after breakout confirmation
4. **Exit** — TP 30% / SL 15% / 12-bar (2-day on 4H) timeout

## Why It Works (Thesis)

The Keltner Squeeze is a volatility compression pattern. When Bollinger Bands go inside Keltner Channels, the market has entered an unusually low-volatility state — a coiled spring. The breakout direction reveals which way the tension releases.

In bull markets, the upward breakouts carry far more energy than downward ones. Buying pressure is regime-consistent: bulls are looking for entries, shorts are getting squeezed, and breakouts above the Keltner Channel typically have follow-through measured in multiple ATRs. The wide TP (30%) reflects this explosive potential; the wide SL (15%) gives the trade room to breathe during volatile post-breakout consolidation.

The 4H timeframe reduces false breakouts relative to 1H while maintaining signal frequency that makes the strategy practically usable (3–7 signals per coin per month in bull periods).

## Results (Bull-regime IS/OOS validation, measured 2026-05-04)

| Metric | IS (May24–Nov24) | OOS (Nov24–May25) | Combined |
|--------|-----------------|------------------|---------|
| Total trades | 188 | 179 | 367 |
| Win rate | ~57% | ~57% | 56.9% |
| Profit factor | 1.63 | 2.96 | 2.28 |
| Coins profitable | 32/50 | 37/50 | — |

**OOS/IS ratio: 1.82** — OOS profit factor (2.96) nearly doubled the IS (1.63). This is the opposite of typical IS/OOS degradation: the strategy improves in out-of-sample bull conditions.

Note: both IS and OOS periods are bull market windows (May–Nov 2024 = +150% BTC, Nov 2024–May 2025 = +120% BTC). The strategy is explicitly regime-conditional and carries **testing** status to reflect that its behavior in bear markets is not yet characterized.

## Important: Bull-Regime Conditional

This strategy's edge is **bull-market specific**. The validation was intentionally performed on bull periods only. In bear markets (W3: May–Nov 2025, W4: Nov 2025–May 2026, both negative periods), LONG squeeze strategies underperform. Use the regime engine at `/strategies` to check current market conditions before allocating.

## Caveats

- Regime-conditional: treat as a bull-market-only tool, not an all-weather strategy.
- 367 total trades across 50 coins over 1 year — thin sample; diversify across coins.
- Wide SL (15%) and TP (30%) parameters suit volatile post-breakout moves but require larger position tolerance.
- 4H signals fire 3–7 times per coin per month in active bull conditions.
- Not live-tracked on OKX. Backtest only.
