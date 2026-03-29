# PRUVIQ - Crypto Strategy Backtesting Platform

> **Don't Believe. Verify.**

Free, open-source crypto strategy backtesting platform. Build custom strategies with 11+ indicators, backtest on 535+ coins with 2+ years of data, and see realistic results including fees and slippage. No coding required.

**Live site: [pruviq.com](https://pruviq.com)**

## Features

### No-Code Strategy Builder
Build custom trading strategies by combining indicators and conditions visually. No programming required.

- **11 Technical Indicators**: Bollinger Bands, EMA, RSI, MACD, Stochastic, ADX, ATR, Historical Volatility, Volume, Candle Patterns, Price Action
- **Condition Engine**: Combine indicators with AND/OR logic, comparison operators, and cross-field references
- **Parameter Tuning**: Adjust indicator parameters (periods, thresholds) and see impact in real-time
- **Preset Library**: Load pre-built strategies as starting points, then customize

### Backtesting Engine
Test strategies on real historical data with realistic market conditions.

- **535+ Coins**: All Binance USDT perpetual futures
- **2+ Years Data**: 1-hour OHLCV candles from 2024-2026
- **Realistic Costs**: 0.04% futures fees + 0.02% estimated slippage per trade
- **Vectorized Execution**: Full backtest in under 3 seconds for all coins
- **Yearly Breakdown**: Performance metrics split by year to detect overfitting

### Strategy Library
5 pre-built strategies with full transparency - including the ones that failed.

| Strategy | Direction | Status | Win Rate | Profit Factor |
|----------|-----------|--------|----------|---------------|
| BB Squeeze SHORT | Short | **Verified** (live trading) | 70.4% | 2.55 |
| BB Squeeze LONG | Long | Killed | 51.0% | 0.98 |
| Momentum LONG | Long | Killed | 37.5% | 0.71 |
| ATR Breakout | Long | Shelved | - | - |
| HV Squeeze | Short | Shelved | - | - |

### Interactive Simulations
- **Strategy Comparison**: Compare all strategies side-by-side under identical conditions
- **SL/TP Grid**: Pre-computed 5x5 stop-loss/take-profit grid with equity curves
- **Per-Coin Charts**: Candlestick charts with entry/exit arrows for each coin
- **Fee Calculator**: Interactive tool comparing fees across 5+ exchanges

### Live Trading Verification
One strategy (BB Squeeze SHORT) runs on a real Binance Futures account. Every trade is published, including losses.

- **38+ days of live trading data**
- **Version history**: Every parameter change documented with evidence
- **Public changelog**: [pruviq.com/changelog](https://pruviq.com/changelog)

## Education Content

Learn quantitative trading concepts with practical examples:

- [What is BB Squeeze?](https://pruviq.com/blog/what-is-bb-squeeze)
- [RSI: Oversold/Overbought Guide](https://pruviq.com/blog/rsi-oversold-overbought-guide)
- [EMA Crossover Strategy](https://pruviq.com/blog/ema-crossover-strategy-guide)
- [MACD Divergence Trading](https://pruviq.com/blog/macd-divergence-trading-guide)
- [Volume Analysis](https://pruviq.com/blog/volume-analysis-crypto-trading)
- [SL/TP Optimization](https://pruviq.com/blog/sl-tp-optimization-guide)
- [Why Backtests Lie](https://pruviq.com/blog/why-backtests-lie)
- [Position Sizing with Kelly Criterion](https://pruviq.com/blog/position-sizing-kelly-criterion)
- [Risk Management 101](https://pruviq.com/blog/risk-management-101)

All education articles link to the Strategy Builder for hands-on practice.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Astro 5.x + Preact + Tailwind 4.x |
| Backend API | Python 3.12 + FastAPI + uvicorn |
| Data | 613 CSV files (1H OHLCV), ccxt for collection |
| Charts | lightweight-charts (TradingView) |
| Hosting | Cloudflare Pages (frontend) + Mac Mini M4 Pro (API) |
| Tunnel | Cloudflare Tunnel (api.pruviq.com) |
| i18n | English + Korean (full bilingual) |

## Project Structure

```
pruviq/
├── src/                      # Astro frontend
│   ├── components/           # Preact islands (interactive)
│   │   ├── StrategyBuilder.tsx    # No-code strategy builder
│   │   ├── StrategyDemo.tsx       # Interactive SL/TP simulation
│   │   ├── StrategyComparison.tsx # Side-by-side comparison
│   │   ├── FeeCalculator.tsx      # Exchange fee calculator
│   │   ├── CoinChart.tsx          # Candlestick + indicators
│   │   └── ResultsCard.tsx        # Backtest metrics display
│   ├── content/              # Markdown content (blog, strategies)
│   ├── i18n/                 # EN + KO translations
│   ├── layouts/              # Page layouts
│   ├── pages/                # Route pages (1,221 total)
│   └── styles/               # Global CSS
├── backend/                  # Python simulation engine
│   ├── api/                  # FastAPI endpoints
│   │   ├── main.py           # /backtest, /simulate, /compare
│   │   ├── data_manager.py   # OHLCV data loading
│   │   └── schemas.py        # Pydantic models
│   ├── src/
│   │   ├── engine/           # Core simulation
│   │   │   ├── condition_engine.py    # JSON condition parser
│   │   │   ├── indicator_pipeline.py  # 11 indicator computations
│   │   │   └── backtest_engine.py     # Trade simulation
│   │   ├── simulation/       # Vectorized backtesting
│   │   └── strategies/       # Strategy implementations
│   ├── scripts/              # Data collection, demo generation
│   └── tests/                # pytest suite
├── public/                   # Static assets + pre-computed data
└── docs/                     # Architecture documentation
```

## Quick Start

### Frontend
```bash
npm install
npm run dev          # localhost:4321
npm run build        # generates 1,221 static pages
```

### Backend API
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --port 8080
```

### API Endpoints
```
POST /backtest              # Custom strategy backtest
GET  /builder/indicators    # Available indicators + fields
GET  /builder/presets       # Pre-built strategy presets
POST /simulate              # Pre-built strategy simulation
POST /simulate/compare      # Compare all strategies
GET  /coins                 # Coin list + metadata
GET  /health                # API status
```

## Key Principles

1. **Publish everything** — including failures and killed strategies
2. **Data over intuition** — every decision backed by backtest evidence
3. **Realistic simulation** — fees, slippage, and position sizing included
4. **No look-ahead bias** — only completed candle data used for signals
5. **Free forever** — core backtesting features will always be free

## Related Projects

- **Backtrader** — Python backtesting framework (more general, requires coding)
- **QuantConnect** — Cloud-based algo trading (requires C#/Python coding)
- **TradingView** — Charting platform with Pine Script (crypto + stocks)
- **3Commas** — Trading bot platform (paid, limited backtesting)

PRUVIQ differentiates by offering **no-code strategy building** with **transparent, pre-verified results** specifically for crypto futures.

## Contributing

We welcome contributions! Areas where help is appreciated:
- New indicator implementations
- Strategy preset submissions
- Education content (blog posts)
- Translation improvements
- Bug reports and feature requests

## License

All rights reserved. The code in this repository is provided for educational purposes.

## Links

- **Website**: [pruviq.com](https://pruviq.com)
- **Strategy Builder**: [pruviq.com/builder](https://pruviq.com/builder)
- **Strategy Library**: [pruviq.com/strategies](https://pruviq.com/strategies)
- **Live Performance**: [pruviq.com/performance](https://pruviq.com/performance)
- **Fee Calculator**: [pruviq.com/fees](https://pruviq.com/fees)
- **Telegram**: [t.me/PRUVIQ](https://t.me/PRUVIQ)
- **Email**: pruviq@gmail.com
