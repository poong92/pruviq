---
title: "Feb 2026 Crash: What Our SHORT System Did"
description: "BTC dropped 48% from ATH. 311K traders got liquidated in one day. Our SHORT-only system ran through it all. Here's what actually happened."
date: "2026-02-15"
category: "market"
tags: ["market-review", "btc", "crash", "feb-2026", "real-data"]
---

## Market Context

February 2026 was brutal for crypto:

- **BTC**: ATH $126K → $60K (-48% from highs)
- **Feb 7**: $233M in short liquidations in one day. Fear & Greed Index hit 6 (near all-time low).
- **Feb 5**: 311,000+ traders liquidated in 24 hours ([CoinGlass](https://www.coinglass.com/liquidations))
- **Altcoins**: Relative strength vs BTC (mean reversion from oversold)

For context: derivatives make up ~79% of all crypto trading volume ([CoinMarketCap](https://coinmarketcap.com/charts/derivatives-market/)). Most of those liquidated traders were using leverage they didn't fully understand.

## What Our System Did

BB Squeeze SHORT runs automatically. It doesn't know about news, doesn't read Twitter, doesn't panic. It follows rules.

**Week 1 (Feb 7-12):**
- The short squeeze on Feb 7 hit hard. 75 positions were open.
- 16 stop-losses triggered. 4 take-profits.
- Unrealized PnL: -$190
- Portfolio dropped -6% in 48 hours
- Daily loss limit reached 86% of the 7% cap

**Week 2 (Feb 12-15):**
- 48-hour timeout wave: 62+ positions hit max holding period
- Positions dropped from 79 → 14 → 10
- Average timeout PnL: -2.14%
- Total drawdown reached -8.3%

## Was This Normal?

We checked the 2-year backtest (762 trading days):

| Metric | Feb 2026 (worst 3 days) | Backtest (worst 3 days) | Ratio |
|--------|-------------------|----------------------|-------|
| Loss | -6.4% | -33% | 17% of worst case |
| Max consecutive loss days | 3 | 10 | Much better |
| MDD | 4.5% | 33% | Well within range |
| 3-day periods worse than ours | — | 84 out of 762 (11.1%) | 1 in 9 days |

**Conclusion: The worst period was in the bottom 17% of what the backtest showed was possible.** The system is performing within expected parameters.

## What We Did NOT Do

1. **Did not turn off the system** — The temptation to "stop the bleeding" is real. But the backtest shows 10+ consecutive loss days happen, and the system recovers.

2. **Did not add a BTC regime filter** — 6 expert analysts recommended it. We backtested it. All 4 variations made things worse. ([Read the full analysis](/blog/tp8-decision-process))

3. **Did not reduce position size** — Risk analysis showed $60 is the Calmar-optimal size. Reducing to $30 would cut both risk and upside equally.

4. **Did not add time filters for 16-18 UTC** — The 7-day live data suggested these hours were bad. 2-year backtest showed this was noise. Adding the filter would have cost -$1,234 in PnL.

## Key Takeaway

Markets crash. Systems get tested. The question isn't "did it lose money during the crash?" — it's "did it lose more than the backtest predicted?"

In our case: no. Not even close.

This doesn't guarantee future performance. But it means the system is working as designed, within the risk parameters we set.

**That's what verification looks like in practice.**

---

*All data sourced from backtests run on 535 coins with 2+ years of hourly OHLCV data on Binance Futures. Full methodology documented in our [changelog](/changelog).*

*Not financial advice. Past performance does not guarantee future results.*
