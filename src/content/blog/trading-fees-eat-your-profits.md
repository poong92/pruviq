---
title: "Trading Fees Ate 24% of This Strategy's Profits"
description: "We ran two real backtests and measured exactly how much fees and funding costs eat. BB Squeeze lost 24% of gross profit to fees. MACD Cross lost 13%. Here's the math."
date: "2026-04-03"
category: "education"
tags: ["fees", "trading costs", "backtest", "crypto", "futures"]
---

Everyone talks about win rate and profit factor. Nobody talks about how much you're paying to trade. We measured it.

## Two Strategies, Real Numbers

We ran BB Squeeze SHORT and MACD Cross SHORT 4H on 50 coins over ~2.3 years (Nov 2023 - Apr 2026). Same market, same cost model: 0.04% maker / 0.06% taker per side, plus actual funding rates.

| Metric | BB Squeeze SHORT | MACD Cross SHORT 4H |
|--------|-----------------|---------------------|
| Total Trades | 2,183 | 2,945 |
| Gross Return | ~29.31% | ~72.65% |
| Fees Paid | -6.99% | -9.42% |
| Funding Costs | -1.64% | -7.76% |
| **Net Return** | **+20.68%** | **+55.47%** |
| Fees as % of Gross | **23.8%** | **13.0%** |
| Total Cost Drag | **8.63%** | **17.18%** |

BB Squeeze made ~29% gross but only kept ~21% after costs. Fees alone took 7 percentage points. That's nearly a quarter of the gross profit gone to the exchange.

MACD Cross 4H traded more (2,945 vs 2,183) and held positions longer (4H timeframe = more funding). The funding cost alone was -7.76% — more than BB Squeeze's total fee bill.

## The Funding Rate Trap

Fees are predictable. Funding rates are not.

| Cost Type | BB Squeeze 1H | MACD Cross 4H |
|-----------|--------------|----------------|
| Trading Fees | -6.99% | -9.42% |
| Funding Rates | -1.64% | -7.76% |
| **Total** | **-8.63%** | **-17.18%** |

MACD Cross holds positions for hours on a 4H timeframe. Every 8 hours, funding rates apply. In a bullish market, short positions pay funding to longs. Over 2,945 trades across 2+ years, that added up to -7.76%.

BB Squeeze on 1H enters and exits faster. Less exposure to funding. The funding cost was only -1.64%.

## What This Means for Your Strategy

A strategy with PF 1.20 and 2,000+ trades sounds profitable. But after costs:

- **Gross PF 1.20** at these fee levels becomes a much thinner edge
- **Higher frequency = more fees** — 2,183 trades x 2 sides x 0.05% avg = ~2.18% in round-trip costs alone, multiplied across positions
- **Longer holds = more funding** — 4H strategies pay 3x more funding than 1H

The break-even point shifts. A strategy that shows +5% gross return might be negative after costs.

## How to Reduce the Damage

1. **Trade less frequently** — Fewer trades = fewer fee events. But too few trades means low statistical significance.
2. **Use limit orders** — 0.04% maker vs 0.06% taker. On 2,000 trades, that's a meaningful difference.
3. **Watch funding rates** — Short in a bull market or long in a bear market = paying funding. Factor this in before you pick a direction.
4. **Get fee discounts** — Exchange referral programs cut fees 10-20%. On 2,000+ trades, that compounds.

## The Number to Remember

For high-frequency strategies on crypto futures: expect 5-10% of your capital to go to fees over a 2-year period. If your strategy doesn't gross more than that, you're trading for the exchange, not for yourself.

Run your own cost analysis on the [PRUVIQ Simulator](https://pruviq.com/simulate) — every result includes fees and funding breakdowns.
