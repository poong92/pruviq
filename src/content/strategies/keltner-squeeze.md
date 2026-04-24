---
name: "Keltner Fade"
description: "Fade breakouts through the Keltner upper band back into the channel. Verified — 735 trades, PF 1.14, Sharpe 0.71, measured 2026-04-22."
status: "verified"
category: "volatility"
direction: "short"
difficulty: "intermediate"
winRate: 53.47
profitFactor: 1.14
maxDrawdown: 44.8
timeframe: "4H"
coins: 235
dateAdded: "2026-04-22"
tags: ["keltner", "volatility", "mean-reversion", "short", "verified"]
---

## Overview

Keltner Channels plot an ATR-scaled envelope around an exponential moving average. This preset takes the **counter-trend** side: when price pushes through the upper band, we fade the breakout and ride it back into the channel. It's a mean-reversion play on momentum exhaustion, not a breakout play.

## How It Works

1. **Channel setup** — 20 EMA center, ATR × 2 for upper / lower bands
2. **Trigger** — close above the upper band
3. **Entry** — SHORT on next-bar close (avoids intrabar wicks)
4. **Exit** — TP when price re-enters the channel (~5% target) / SL at 7%
5. **Filter** — only take signals when the center EMA is flat-to-down (no trend-following fades)

## Why It Works (Thesis)

Crypto overshoots. Momentum funds chase breakouts on the Keltner upper, but without a supporting structural trend the move often reverses within 1–3 bars. The ATR scaling keeps the edge stable across volatility regimes — tighter channels in calm markets, wider in stormy ones.

## Results (2-year backtest, measured 2026-04-22)

| Metric | Value |
|--------|-------|
| Total trades | 735 |
| Win rate | 53.47% |
| Profit factor | 1.14 |
| Sharpe | 0.71 |
| Total return | +88.22% |
| Max drawdown | 44.8% |

## Caveats

- Fade strategies bleed hard in trending markets — the 44.8% drawdown sits in exactly those regimes.
- Not live-tracked on OKX. Forward performance can diverge — see TrustGap.
- Lower PF than Ichimoku but tighter win-rate dispersion (53% WR vs Ichimoku's 41%) makes the equity curve smoother.
