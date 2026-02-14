---
title: "How to Backtest a Crypto Trading Strategy (The Right Way)"
description: "A practical guide to backtesting crypto trading strategies. Learn to avoid look-ahead bias, overfitting, and the common mistakes that make 90% of backtests worthless."
date: "2026-02-15"
category: "quant"
tags: ["backtesting", "python", "crypto", "algorithmic-trading"]
---

Most crypto backtests are worthless. They show astronomical returns because they're full of hidden bugs that would never survive live trading. Here's how to do it right.

## What Is Backtesting?

Backtesting means testing a trading strategy against historical market data to see how it would have performed. You define rules (when to buy, when to sell, position size, stop-loss) and simulate executing those rules on past price data.

**Why it matters**: Without backtesting, you're gambling. With proper backtesting, you have statistical evidence for whether a strategy has an edge.

**Why most backtests lie**: The gap between a backtest and live trading is enormous. Our own Momentum LONG strategy backtested at +400% but lost $14,115 in live trading. The difference? Bugs that only show up when you trade with real money.

## The 5 Critical Rules of Honest Backtesting

### Rule 1: Only Use Completed Candles

This is the most common and most dangerous mistake in crypto backtesting.

When your bot runs at 10:01 UTC, the 9:00-10:00 candle is complete (confirmed data). The 10:00-11:00 candle is still forming (unknown data).

**Wrong approach**: Using the current candle's volume, close price, or indicators as entry conditions. In a backtest, the "current" candle is already complete — but in live trading, you only have 1 minute of data.

**Right approach**: All signal conditions must use the previous (completed) candle. The current candle's close price is only used as the entry price.

```
# Correct: Use prev candle for signals, curr for entry price
signal = prev_candle['bb_squeeze'] == True and prev_candle['volume_ratio'] > 2.0
entry_price = curr_candle['close']

# Wrong: Using current candle data (look-ahead bias)
signal = curr_candle['bb_squeeze'] == True  # This data doesn't exist yet!
```

### Rule 2: Match Backtest Logic to Live Logic Exactly

Your backtest code and live trading code must produce identical signals given the same data. Any difference — even a single index offset — can completely change results.

**Our lesson**: We once had `prev` vs `prev2` candle comparison in our backtest that differed from live code. The backtest showed -20.6% loss. When we fixed it to match live logic exactly, it showed +$794 profit. One index difference. Completely opposite results.

**How to verify**:
1. Extract the signal function from your live code
2. Use that exact function in your backtest
3. Run both on the same data and compare signals

### Rule 3: Include All Costs

A strategy showing +3% average return per trade becomes unprofitable when you account for:

- **Trading fees**: 0.04% maker / 0.04% taker on Binance Futures = 0.08% round trip
- **Slippage**: Market orders don't fill at the displayed price. Budget 0.05-0.1% per trade
- **Funding rates**: For perpetual futures, funding rates can add up to 0.1% every 8 hours
- **Spread**: Low-liquidity altcoins can have 0.1-0.5% bid-ask spreads

**Minimum cost assumption**: 0.15% per round-trip trade for liquid coins on Binance.

### Rule 4: Test on Enough Data

A strategy that works on 6 months of data proves nothing. Markets have regimes — bull, bear, sideways, high volatility, low volatility. Your backtest needs to cover multiple regimes.

**Our standard**: 2+ years of data across 500+ coins. That gives us 2,898 trades across multiple market conditions.

**Out-of-sample validation**: Split your data into training (optimize parameters) and testing (validate results). If it works on both, it's more likely real. If it only works on training data, you've overfit.

### Rule 5: Use Realistic Position Sizing

Don't calculate returns as percentages and add them up. Simulate actual capital allocation.

```
# Wrong: Simple percentage addition (fantasy)
total_return = sum(trade_returns)  # Shows +2,090%

# Right: Simulate actual account balance
balance = 3000  # Starting capital
for trade in trades:
    position_size = min(60, balance * 0.02)  # $60 or 2% of balance
    pnl = position_size * trade_return * leverage
    balance += pnl
# Shows +103% (reality)
```

The difference? Simple addition ignores that losing trades reduce your capital for future trades. Realistic simulation shows what your actual P&L would be.

## What Good Backtest Results Look Like

After running an honest backtest, here's what healthy metrics look like:

| Metric | Healthy Range | Red Flag |
|--------|--------------|----------|
| Win Rate | 50-70% | >80% (probably overfit) |
| Profit Factor | 1.5-3.0 | >5.0 (too good to be true) |
| Max Drawdown | 10-30% | >50% (too risky) |
| Sharpe Ratio | 1.0-3.0 | >5.0 (check your math) |
| Sample Size | 500+ trades | <100 (insufficient data) |

**Our live strategy (BB Squeeze SHORT)**: 70.4% win rate, 2.55 profit factor, 2,898 trades across 536 coins. These numbers survived out-of-sample validation across 2024, 2025, and 2026 data.

## Common Backtesting Mistakes

### Overfitting

Adding more and more conditions to improve backtest results. Each added condition makes the strategy fit historical data better but generalizes worse to new data.

**Test**: If removing one condition destroys your results, you're probably overfit. A robust strategy should survive small parameter changes.

### Survivorship Bias

Only testing on coins that still exist today. Coins that got delisted (often after crashing 99%) are excluded, making results look better than reality.

**Fix**: Include delisted coins in your dataset, or at least acknowledge this limitation.

### Ignoring Market Regime

A strategy that works in a bear market may fail completely in a bull market. We tested 4 different BTC regime filters to see if adapting to market conditions helps. All 4 failed — the overhead of missed trades outweighed the loss prevention.

**Lesson**: Sometimes the best filter is no filter. Let the data decide.

## Getting Started

1. **Get data**: Download OHLCV (Open, High, Low, Close, Volume) candle data from your exchange's API
2. **Define rules**: Write clear, unambiguous entry and exit conditions
3. **Simulate**: Run through historical data candle by candle, tracking positions and P&L
4. **Validate**: Split data into training/testing periods. Check for look-ahead bias
5. **Go small**: If results survive validation, test with minimum position size on live markets

The gap between backtest and live trading is where most strategies die. Honest backtesting narrows that gap.

---

*At PRUVIQ, every strategy is backtested on 500+ coins across 2+ years before risking real capital. [See our killed strategies](/graveyard) and [version history](/changelog) for the full transparency trail.*
