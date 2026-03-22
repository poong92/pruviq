---
title: "Crypto Perpetual Futures: Complete Beginner's Guide (2026)"
description: "Everything you need to know about crypto perpetual futures. How leverage works, what funding rates are, and how to avoid getting liquidated."
date: "2026-02-15"
category: "education"
tags: ["futures", "leverage", "beginners", "perpetual-contracts"]
---

Perpetual futures are the most traded instrument in crypto — over $100 billion in daily volume. But most beginners lose money because they don't understand how leverage, margin, and liquidation actually work.

## What Are Perpetual Futures?

A perpetual futures contract lets you bet on the price of a cryptocurrency going up (long) or down (short) without owning the actual asset. Unlike traditional futures, they have no expiry date — they trade "perpetually."

**Key difference from spot trading**: With spot, you buy 1 BTC at $70,000 and sell it later. With futures, you open a position that profits or loses based on price movement, amplified by leverage.

**Why they exist**: They allow traders to go short (profit when prices drop), use leverage (trade with borrowed money), and trade without holding the underlying asset.

## How Leverage Works

Leverage multiplies your exposure. With 5x leverage and $100 margin:

- You control a $500 position
- If the price moves +10%, you make $50 (50% on your $100)
- If the price moves -10%, you lose $50 (50% of your $100)
- At -20%, you've lost $100 (100% of your margin) and get **liquidated**

| Leverage | $100 Margin Controls | Liquidation Distance |
|----------|---------------------|---------------------|
| 1x | $100 | -100% (impossible for crypto) |
| 5x | $500 | -20% |
| 10x | $1,000 | -10% |
| 20x | $2,000 | -5% |
| 50x | $5,000 | -2% |
| 100x | $10,000 | -1% |

**The reality**: At 100x leverage, a 1% price move against you wipes out your entire margin. In crypto, 1% moves happen in minutes.

## What Is Funding Rate?

Since perpetual futures have no expiry, they need a mechanism to keep their price close to the spot price. This mechanism is the **funding rate**.

- **Positive funding rate**: Longs pay shorts (meaning the futures price is above spot — bullish sentiment)
- **Negative funding rate**: Shorts pay longs (futures below spot — bearish sentiment)
- **Payment frequency**: Every 8 hours on most exchanges (Binance: 00:00, 08:00, 16:00 UTC)
- **Typical rate**: 0.01% per 8 hours (~0.03% daily, ~10.95% annually)

**Why it matters**: If you hold a position for days or weeks, funding rates add up. A 0.03% daily funding rate costs ~1% per month. On a leveraged position, this can be significant.

## How Liquidation Works

When your unrealized loss approaches your margin, the exchange forcefully closes your position. This is liquidation.

**Isolated margin**: Each position has its own margin. If Position A gets liquidated, Position B is unaffected. Safer for managing risk.

**Cross margin**: All positions share one margin pool. More capital-efficient but riskier — one bad position can liquidate everything.

**Liquidation price example** (Isolated, 5x leverage, SHORT):
- Entry: $70,000
- Margin: $100 ($500 position)
- Liquidation at ~$84,000 (+20% move against you)

## The Most Common Mistakes

### Mistake 1: Using Too Much Leverage

Beginners see 100x leverage and think "I'll make 100x profits." What actually happens: a 1% move liquidates them.

**Our approach**: We use 5x leverage. This gives us a 20% buffer before liquidation, which is reasonable for hourly positions on altcoins.

### Mistake 2: No Stop-Loss

"It'll come back" is the most expensive sentence in trading. Without a stop-loss, a position can go from -5% to -100% in a single candle.

**Our approach**: Every position has a stop-loss set before entry. Currently 10% for our BB Squeeze strategy. No exceptions, no manual overrides.

### Mistake 3: Oversizing Positions

Putting 50% of your account into one trade means one bad trade wipes half your capital.

**Example**: $200 per position with $10,000 capital = 2% per trade. Even 10 consecutive losses only cost 20%.

### Mistake 4: Ignoring Fees

Futures trading fees compound quickly with leverage:

- Binance Futures: 0.02% maker / 0.04% taker (with BNB discount)
- 5x leverage: Effective fee = 0.1-0.2% of your margin per round trip
- 100 trades/month at 0.15% = 15% of capital gone to fees alone

**How to reduce fees**:
- Use limit orders (maker fee) instead of market orders (taker fee)
- Pay fees in BNB (25% discount on Binance)
- Use a [referral code for additional discounts](/fees)

## Getting Started Safely

1. **Start with paper trading**: Most exchanges offer testnet or paper trading. Practice here first.
2. **Use isolated margin**: Limit your risk per position.
3. **Keep leverage low**: 3-5x maximum for beginners. Even professional algo traders rarely use more than 10x.
4. **Set stop-losses immediately**: Before entering any position, know your maximum acceptable loss.
5. **Start small**: Your first 100 trades are tuition. Use minimum position sizes.
6. **Track everything**: Log every trade, every reason, every outcome. You can't improve what you don't measure.

## Choosing an Exchange

The exchange matters. Fees, liquidity, leverage options, and reliability all differ.

| Factor | Why It Matters |
|--------|---------------|
| Fees | At 100+ trades/month, a 0.01% fee difference = real money |
| Liquidity | Low liquidity = wider spreads = worse fills |
| API reliability | For algo trading, API downtime = missed trades |
| Coin selection | More coins = more strategy opportunities |

We use Binance Futures (highest liquidity, 500+ perpetual pairs). See our [full exchange comparison](/fees) for alternatives.

## Perpetual vs Quarterly Futures

Not all futures contracts are the same. The two main types in crypto are **perpetual** and **quarterly** (also called delivery or expiry futures).

**Perpetual futures** have no expiry date. You can hold a position indefinitely, but you pay or receive funding rates every 8 hours to keep the contract price anchored to spot. This is what most retail traders use.

**Quarterly futures** expire on a fixed date — typically the last Friday of March, June, September, or December. There are no funding rates, but the contract trades at a premium or discount to spot that converges to zero at expiry.

**When to use each**:

- **Perpetuals** are better for short-term trades (hours to days) where you want simplicity and maximum liquidity. Over 95% of crypto futures volume is in perpetuals.
- **Quarterly futures** are better for longer-term hedging or basis trading strategies. If you plan to hold a position for weeks and funding rates are high (say 0.05%+ per 8 hours), quarterlies can be cheaper since you avoid funding entirely.
- **Basis trading** involves buying spot and shorting the quarterly future to capture the premium — a relatively low-risk strategy that yields 10-30% annualized in bull markets.

For most beginners, perpetuals are the right choice. They are simpler, more liquid, and supported on every major exchange. Quarterly futures become relevant when you start building more sophisticated strategies or want to avoid funding rate drag. You can explore strategy options on our [strategy builder](/simulate).

## Understanding Funding Rates in Depth

Funding rates are the heartbeat of the perpetual futures market. Understanding them deeply separates informed traders from those who bleed money without knowing why.

**How the calculation works**: The funding rate has two components — the interest rate (usually fixed at 0.01% per 8 hours) and the premium index (how far the futures price deviates from spot). When futures trade above spot, the premium is positive, pushing the total funding rate higher. When futures trade below spot, the premium turns negative.

**Historical ranges**: During the 2024-2025 bull run, BTC funding rates regularly hit 0.05-0.1% per 8 hours (36-109% annualized). During the May 2024 correction, rates went as negative as -0.03% per 8 hours. In sideways markets, rates hover near the baseline 0.01%.

**The impact on your strategy**:

- **For longs in a bull market**: You are paying funding. At 0.05% per 8 hours, a 5x leveraged long position pays ~0.75% of margin per day. Hold for a week and you have lost 5.25% just in funding — before any price movement.
- **For shorts in a bull market**: You are receiving funding. This creates a tailwind. Even if the price moves slightly against you, funding payments can offset losses.
- **For range-bound markets**: Funding oscillates near zero and has minimal impact on short-term trades.

**Funding rate as a sentiment indicator**: Extremely high positive funding (>0.05%) often signals overleveraged longs and can precede liquidation cascades and price drops. Extremely negative funding (<-0.02%) can signal a bottom as shorts become crowded. Many traders use funding rate extremes as contrarian signals.

**Practical tip**: Before opening any position, check the current funding rate and the next payment time. If you are going long and funding is 0.08%, you might want to wait until just after the funding payment to avoid paying. Conversely, if you are going short, entering just before a high positive funding payment means you collect immediately. For deeper strategies around funding, see our [funding rate arbitrage guide](/blog/funding-rate-arbitrage-practical-guide).

## Risk Management for Futures Trading

Leverage amplifies everything — gains, losses, and mistakes. Without a disciplined risk framework, futures trading is just gambling with extra steps. For a comprehensive deep dive, see our dedicated [risk management guide](/blog/risk-management-101).

### Position Sizing Rules

The foundation of risk management is position sizing. Here is a framework that keeps you in the game:

- **Max risk per trade**: 1-2% of total account equity. With a $10,000 account, you risk $100-$200 per trade maximum.
- **Position size formula**: `Position Size = (Account × Risk %) / (Stop-Loss % × Leverage)`. For a $10,000 account, 2% risk, 10% stop-loss, and 5x leverage: Position = ($10,000 × 0.02) / (0.10 × 5) = $400 margin.
- **Max open positions**: Limit to 5-10 simultaneous positions. More than that and you cannot monitor them effectively.

### Portfolio Heat

Portfolio heat measures your total risk across all open positions. If you have 8 positions each risking 2%, your portfolio heat is 16%. This means if everything hits stop-loss simultaneously (which happens during black swan events), you lose 16%.

**Our rule**: Maximum portfolio heat of 20%. If we have positions risking a total of 20% of the account and a new signal fires, we skip it. No exceptions.

### Correlation Risk

Holding 10 different altcoin positions feels diversified but usually is not. When BTC drops 10%, most altcoins drop 15-25%. Your "diversified" portfolio of 10 longs behaves like one massive position.

**Mitigation strategies**:

- Limit same-direction positions in correlated assets (do not go long on both ETH and MATIC simultaneously with full size)
- Use a mix of long and short positions to hedge market-wide moves
- Reduce position size when holding multiple correlated positions
- Monitor BTC dominance — when it rises sharply, altcoin longs become extremely correlated

### The 1% Rule

Professional futures traders live by the 1% rule: never risk more than 1% of your account on a single trade. This means after 10 consecutive losses (which happens more often than you think), you have only lost about 10%. Recovery from 10% is straightforward. Recovery from 50% requires doubling your account. Read more about [position sizing with the Kelly Criterion](/blog/position-sizing-kelly-criterion).

## Liquidation: How It Actually Works

Most guides explain liquidation as "you lose all your money." The reality is more nuanced — and understanding the mechanics can save you from unnecessary losses.

### Maintenance Margin

Every exchange has two margin levels: **initial margin** (what you deposit to open the position) and **maintenance margin** (the minimum required to keep it open, typically 0.4-0.5% of position value on Binance). Liquidation triggers when your margin falls below the maintenance margin, not when it hits zero.

This means your actual liquidation price is slightly better than the simplified calculation suggests. With 5x leverage and 0.5% maintenance margin, you get liquidated at roughly -19.5% instead of -20%.

### Partial Liquidation

On Binance and most major exchanges, liquidation is not all-or-nothing. The liquidation engine first tries **partial liquidation** — reducing your position size to bring your margin ratio back above maintenance. Only if partial liquidation cannot save the position does full liquidation occur.

For example, with a $500 position at 5x leverage, the engine might close $250 first. If the remaining $250 position has sufficient margin, it survives. This is why isolated margin with larger positions sometimes results in partial losses rather than total wipeout.

### Insurance Fund

When a position is liquidated at a price worse than the bankruptcy price (the price at which margin = 0), the exchange's **insurance fund** covers the difference. This prevents "socialized losses" where profitable traders pay for others' liquidations. Binance's insurance fund holds over $1 billion, making cascade socialized losses extremely rare.

### Cascade Liquidation

The most dangerous market events involve **cascade liquidations**. Here is how they work: a price drop triggers liquidations, which are market sell orders, which push the price down further, which triggers more liquidations. During the June 2024 flash crash, over $2 billion in longs were liquidated in 4 hours, with each wave of liquidations accelerating the next.

**How to protect yourself**: Use isolated margin so cascades cannot touch positions in other pairs. Set stop-losses well above your liquidation price — your stop should trigger long before liquidation becomes a risk. Understanding [stop-loss optimization](/blog/sl-tp-optimization-guide) is critical for survival.

## Your First Futures Trade: Step-by-Step

Ready to place your first futures trade? Here is a practical walkthrough using Binance Futures as an example.

**Step 1 — Fund your futures wallet**: Transfer USDT from your spot wallet to your futures wallet. Start with a small amount — $50-$100 is plenty for learning.

**Step 2 — Select the contract**: Search for BTCUSDT Perpetual. Stick to BTC or ETH for your first trades — they have the highest liquidity and smallest spreads.

**Step 3 — Set margin mode**: Click the margin mode button and select **Isolated**. This protects the rest of your account if the trade goes wrong.

**Step 4 — Set leverage**: Click the leverage button and set it to **3x**. Resist the temptation to go higher on your first trade.

**Step 5 — Calculate your position**: With $50 margin and 3x leverage, you control a $150 position. Decide your stop-loss level — say 5% below entry for a long. Your maximum loss would be $7.50 (15% of margin at 3x).

**Step 6 — Place the order**: Use a **Limit order** (not Market) to save on fees. Set your entry price at or near the current price. Toggle on the stop-loss field and enter your stop price.

**Step 7 — Verify**: Check the open position tab. Confirm the entry price, liquidation price, and stop-loss are all correct. Your liquidation price should be far below your stop-loss.

**Step 8 — Wait and learn**: Do not touch it. Let the trade play out. Whether it wins or loses, log the result — entry reason, exit price, what you learned. Your first 50 trades are education, not income.

Before trading live, consider testing strategies in our [simulator](/simulate) where you can see how different parameters perform across hundreds of coins with zero risk.

## FAQ

**Can I lose more than my margin in futures trading?**
With isolated margin, no. Your maximum loss is the margin allocated to that specific position. With cross margin, theoretically your entire account balance is at risk. This is why we recommend isolated margin for all but the most experienced traders.

**What is the best leverage for beginners?**
Start with 2-3x. This gives you meaningful exposure while keeping your liquidation distance at 33-50% — large enough to survive normal volatility. Once you have completed 100+ trades and understand position sizing deeply, you can consider 5x. Anything above 10x is for experienced traders with automated risk systems.

**Do I pay fees on the leveraged amount or just my margin?**
On the leveraged amount. If you use $100 margin with 5x leverage, your $500 position is what gets charged the trading fee. At 0.04% taker fee, that is $0.20 per side ($0.40 round trip), or 0.4% of your actual margin. This is why [understanding fees](/blog/crypto-trading-fees-explained) matters more with leverage.

**Should I use a bot or trade manually?**
For your first 50-100 trades, trade manually. You need to feel the psychology — the urge to move your stop-loss, the fear of missing out, the temptation to oversize. Once you have internalized discipline, automation removes emotion from the equation. See how our [strategy builder](/simulate) handles automated entries and exits.

---

*PRUVIQ trades perpetual futures on 535 coins with 5x leverage. Every trade is published in real-time on the [performance page](/performance). See our [approach](/), [killed strategies](/strategies), and [version history](/changelog).*
