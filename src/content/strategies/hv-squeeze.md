---
name: "Historical Volatility Squeeze"
description: "Uses Historical Volatility instead of Bollinger Bands to detect squeeze. Shelved — 85% signal overlap with BB Squeeze, no additional edge."
status: "shelved"
category: "volatility"
direction: "short"
difficulty: "advanced"
winRate: 58.1
profitFactor: 1.42
timeframe: "1H"
coins: 577
dateAdded: "2026-01-15"
tags: ["historical-volatility", "squeeze", "shelved"]
---

## Overview

HV Squeeze replaces Bollinger Bands with Historical Volatility (HV) percentile to detect compression. When HV drops below its 20th percentile and then expands, a trade is triggered.

The hypothesis: HV might capture volatility compression that Bollinger Bands miss, since HV is a direct measure of realized price dispersion rather than a band-width proxy.

## How It Works

1. **Calculate HV Percentile** — Compute 20-period historical volatility, rank against 100-period lookback
2. **Detect Compression** — HV drops below 20th percentile (extreme low volatility)
3. **Wait for Expansion** — HV rises back above 30th percentile
4. **Volume + Direction Filters** — Same as BB Squeeze (2.0x volume, EMA trend)
5. **Enter Short** — Same risk management (SL 10%, TP 8%, 48h max hold)

## Test Results

| Metric | HV Squeeze | BB Squeeze | Difference |
|--------|-----------|-----------|------------|
| Win Rate | 58.1% | 68.6% | -10.5%p |
| Profit Factor | 1.42 | 2.22 | -36% |
| Signal Overlap | 85% | — | — |
| Unique Signals | 15% | — | — |

The 15% of unique HV signals (those BB Squeeze missed) had a win rate of 47% — below breakeven.

## Why It Was Shelved

1. **85% signal overlap** — HV and BB Squeeze fire at nearly the same time, making HV redundant
2. **Unique signals underperform** — The 15% of signals only HV catches are actually losers
3. **Complexity without edge** — Adding a second volatility measure doubles code maintenance but adds zero PnL
4. **BB Squeeze already validated** — 2+ years, 535 coins, 2,898 trades. No reason to replace a working system with an equivalent one

## Lesson Learned

> Not every variation of a working idea is an improvement. Sometimes the first implementation is also the best one.

HV Squeeze taught us that indicator substitution is not optimization. The edge in BB Squeeze comes from the squeeze-to-expansion transition pattern, not from the specific method of measuring volatility. BB and HV measure the same underlying phenomenon — price compression — just with different math.

## Potential Revisit

HV Squeeze could become relevant if:
- BB Squeeze edge degrades below profitability threshold
- Market microstructure changes (e.g., new exchange mechanisms alter BB behavior)
- Combining both as an ensemble shows uncorrelated alpha on the 15% unique signals

For now, simplicity wins. One validated signal is better than two redundant ones.

## Status: SHELVED

Not actively traded. Last tested: January 2026 on 577 coins with 2+ years of data.
