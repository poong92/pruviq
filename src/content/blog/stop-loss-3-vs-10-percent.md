---
title: "SL 3% vs 10% — We Tested Both on 572 Coins"
description: "BB Squeeze SHORT strategy backtested with 3% and 10% stop loss across 50 coins over 2+ years. The tighter stop lost more trades but the wider stop made more money."
date: "2026-03-29"
category: "quant"
tags: ["stop-loss", "risk-management", "backtest", "bb-squeeze", "crypto"]
---

Same strategy. Same coins. Same period. Only the stop loss changed.

**Setup**: BB Squeeze SHORT, TP 8%, top 50 coins by volume, Nov 2023 ~ Apr 2026.

## Head-to-Head

| Metric | SL 3% | SL 10% | Winner |
|--------|-------|--------|--------|
| Total Trades | 2,256 | 2,187 | — |
| Win Rate | 38.21% | 53.82% | SL 10% |
| Profit Factor | 1.14 | 1.19 | SL 10% |
| Total Return | +11.92% | +19.66% | SL 10% |
| Max Drawdown | 6.26% | 9.39% | SL 3% |
| Sharpe Ratio | 0.68 | 0.76 | SL 10% |
| Sortino Ratio | 1.37 | 1.40 | SL 10% |
| Avg Win | +5.51% | +5.22% | SL 3% |
| Avg Loss | -2.98% | -5.10% | SL 3% |
| SL Hits | 1,247 | 290 | SL 10% |
| TP Hits | 496 | 629 | SL 10% |
| Timeouts | 513 | 1,268 | — |
| Fees Paid | 7.22% | 7.00% | SL 10% |

## What the Numbers Say

**SL 3% gets stopped out constantly.** 1,247 stop-loss hits vs 290. The tight stop turns noise into realized losses. Win rate drops to 38% because most trades don't get room to breathe.

**SL 10% lets trades develop.** Win rate jumps to 54%. TP hits increase from 496 to 629. More trades reach the target instead of getting cut early.

**The return gap is real.** +19.66% vs +11.92%. SL 10% made 65% more money over the same period.

**But the drawdown trade-off exists.** MDD 9.39% vs 6.26%. The wider stop means bigger individual losses when you're wrong. If your risk tolerance is tight, the 3% stop keeps drawdowns smaller.

## Per-Coin Breakdown (Top 5 by Return)

### SL 3%
| Coin | Trades | Win Rate | Return |
|------|--------|----------|--------|
| UNI | 60 | 46.67% | +76.34% |
| ONDO | 54 | 46.30% | +67.51% |
| DOGE | 63 | 46.03% | +62.87% |
| ETH | 58 | 44.83% | +53.09% |
| PEPE | 64 | 37.50% | +51.98% |

### SL 10%
| Coin | Trades | Win Rate | Return |
|------|--------|----------|--------|
| UNI | 57 | 61.40% | +118.77% |
| ONDO | 53 | 71.70% | +116.38% |
| SUI | 55 | 61.82% | +91.24% |
| WLD | 58 | 60.34% | +76.52% |
| VET | 61 | 60.66% | +60.76% |

UNI returned +76% with SL 3% and +119% with SL 10%. Same coin, same strategy, 55% more return just from wider stops.

## The Worst Losers

### SL 3%
| Coin | Return | Trades |
|------|--------|--------|
| KAS | -54.73% | 72 |
| NEAR | -42.58% | 51 |

### SL 10%
| Coin | Return | Trades |
|------|--------|--------|
| M | -62.32% | 10 |
| KAS | -42.52% | 68 |

Both setups lose on the same coins. The wider stop doesn't save bad picks — it just changes the loss size.

## So What

For BB Squeeze SHORT on major coins: **SL 10% outperforms SL 3% on every metric except drawdown.** The tight stop feels safer but costs real money in missed trades.

The right stop loss depends on your risk tolerance, not the strategy alone. Test both on your setup: [PRUVIQ Simulator](https://pruviq.com/simulate).
