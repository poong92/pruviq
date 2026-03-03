# Reddit r/algotrading Post Draft

**Title**: I backtested 5 crypto strategies on 535 coins over 2 years. Only 1 survived. Here's the data.

**Flair**: Strategy / Show & Tell

---

I spent the last few months building and testing crypto futures strategies systematically. Wanted to share the results because I think the data is interesting, especially the failures.

## Setup

- **Data**: 535 USDT perpetual futures (Binance), 1H candles, 2+ years
- **Backtesting**: Realistic simulation with $60 positions, 5x leverage, 0.04% fees, slippage modeling
- **Validation**: Out-of-sample testing across 3 independent time periods (2024, 2025, 2026)

## Results

| Strategy | Direction | Win Rate | Profit Factor | Trades | Verdict |
|----------|-----------|----------|---------------|--------|---------|
| BB Squeeze SHORT | Short | 70.4% | 2.55 | 2,898 | Live trading |
| BB Squeeze LONG | Long | 51.0% | 0.98 | ~800 | Killed |
| Momentum Breakout LONG | Long | 37.5% | 0.42 | ~2,000 | Killed |
| ATR Breakout LONG | Long | 48.7% | 0.91 | ~1,500 | Shelved |
| HV Squeeze SHORT | Short | 58.1% | 1.42 | ~1,200 | Shelved |

## Key Finding: LONG strategies systematically fail in crypto futures

I tested 88+ parameter combinations for LONG strategies. Not a single one produced a reliable edge. The best LONG result was PF 1.07 (basically break-even after costs).

This makes sense structurally:
- Funding rates in bear/neutral markets favor shorts
- Leverage liquidations cascade more on longs
- BB Squeeze signals are direction-neutral, but short-side execution has an inherent advantage

## The surviving strategy: BB Squeeze SHORT

Bollinger Band squeeze (compression then expansion) with bearish confirmation. Parameters:

```
Entry:
- BB(20, 2.0) squeeze detected + expansion rate >= 10%
- Volume ratio >= 2.0 (vs 20-period average)
- EMA(9) < EMA(21)
- Bearish candle
- Time filter: avoid [2,3,10,20,21,22,23] UTC

Exit:
- SL: 10%, TP: 8%, Timeout: 48H (LIMIT IOC + MARKET fallback)
```

**Live trading results** (37 days, $3K account, Binance Futures):
- 1,317 trades
- 54.59% win rate (backtest: 70.4%)
- PF: 1.01 (backtest: 2.55)
- P&L: +$9.72

The live-backtest gap is mostly explained by one problematic coin (GUNUSDT, -$378) and some Docker restart issues causing premature timeouts. After fixing these, recent performance (last 100+ trades) shows 61% WR.

## Biggest lessons

1. **Look-ahead bias killed my first backtest** — using `curr` instead of `prev` candle data flipped results from +$794 to -20.6%
2. **Time filters can be overfitting traps** — a filter that added +43% in backtests was pure noise in OOS
3. **Test on ALL coins** — every time I "curated" a coin list, I was overfitting
4. **TP > SL matters more than SL** — changing TP from 6% to 8% improved PnL by 24.3%. Changing SL barely moved the needle.

## Tool

I built a free backtesting tool that runs these strategies: [pruviq.com](https://pruviq.com). No code needed — you select indicators and conditions visually, and it tests across all 535 coins in ~3 seconds.

All 5 strategies are published on the site with interactive demos, including the failed ones.

Happy to discuss methodology, answer questions about the BB Squeeze logic, or share more detailed data.
