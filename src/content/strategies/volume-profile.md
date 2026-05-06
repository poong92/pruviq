---
name: "Volume Profile POC"
description: "Mean reversion to Volume Profile Point of Control. Enters when price deviates >3% from POC. Verified — 10/10 coins profitable, OOS 6/6 windows PASS, PF 1.14, WR 53%, independent edge (correlation ~0 with other strategies), measured 2026-03-27."
status: "verified"
category: "mean-reversion"
direction: "both"
difficulty: "intermediate"
winRate: 53.0
profitFactor: 1.14
timeframe: "1H"
coins: 10
dateAdded: "2026-03-27"
dateUpdated: "2026-03-27"
tags: ["volume-profile", "poc", "mean-reversion", "both", "verified"]
---

## Overview

The Volume Profile POC strategy exploits the principle that price gravitates back toward the area of highest traded volume — the **Point of Control (POC)**. When price drifts too far from the POC, the strategy enters a counter-trend position expecting reversion.

Discovered 2026-03-27 during a multi-strategy sweep. Key finding: it shows near-zero correlation with the other 16 strategies in the system — a genuinely **independent edge**, not a variant of existing signals.

## How It Works

1. **Volume Profile** — computed over a rolling 168-bar (1-week) window using only completed bars (no look-ahead bias)
2. **POC identification** — the price level with the highest traded volume in the window
3. **Deviation trigger** — entry fires when current price deviates >3% from POC
4. **LONG** — price is below POC (sell pressure pushed it too far down; expect recovery)
5. **SHORT** — price is above POC (buy pressure pushed it too far up; expect reversion)
6. **Exit** — TP 5% / SL 2% / reversion to 70% of the deviation from POC

## Why It Works (Thesis)

High-volume price levels represent market consensus — prices where the most participants are comfortable transacting. When price departs significantly from this consensus zone, it is often driven by short-term momentum or thin-liquidity moves rather than a genuine change in fair value. The 3% deviation filter keeps the strategy out of small, noisy moves. The 1-week volume window is long enough to identify stable equilibrium zones but short enough to adapt to changing market regimes.

The near-zero correlation with trend and breakout strategies makes it valuable for portfolio construction: it profits during choppy, range-bound markets when trend strategies underperform.

## Results (2026-03-27 backtest)

| Metric | Value |
|--------|-------|
| Coins tested | 10 |
| Coins profitable | 10/10 |
| Win rate | 53.0% |
| Profit factor | 1.14 |
| Sharpe ratio | 2.76 |
| PF range | 1.02–1.37 |

**OOS 6/6 windows PASS** — all 6 out-of-sample rolling windows produced PF > 1.00 (range: 1.03–1.15). This is the key validation criterion for **verified** status.

**Portfolio correlation ≈ 0** with other 16 strategies. Adding this strategy to a portfolio provides genuine diversification, not just a differently-parameterized version of existing signals.

## Default Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Volume window | 168 bars | 1 week of 1H candles |
| Deviation threshold | 3.0% | Minimum drift from POC to enter |
| Reversion target | 70% | Exit when 70% reversion is achieved |
| Stop loss | 2% | Tight SL appropriate for high-WR mean reversion |
| Take profit | 5% | 2.5:1 reward-to-risk ratio |

## Caveats

- Thin edge (PF 1.14) — meaningful but not large. Position sizing should reflect this.
- Based on 10-coin backtest as of 2026-03-27; not yet validated on the full 238-coin universe.
- Works best in range-bound markets; may underperform during strong sustained trends.
- Not live-tracked on OKX. Backtest only.
