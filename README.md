# PRUVIQ

**Don't Believe. Verify.**

Free crypto strategy simulation platform with market context.

## What is PRUVIQ?

Test crypto trading strategies on 500+ coins with 2+ years of data. No coding required. No hidden fees. All results transparent.

**Two Pillars:**
1. **Strategy Simulation** - Select a strategy, adjust parameters, see realistic results (fees + slippage included)
2. **Market Context** - News, events, macro data overlaid with strategy performance

## Project Structure

```
pruviq/
├── src/                 # Astro frontend (website)
├── backend/             # Python simulation engine
│   ├── src/simulation/  # Core engine
│   ├── src/strategies/  # Strategy plugins
│   ├── src/data/        # Data collection (ccxt)
│   └── tests/           # pytest
├── docs/                # Architecture & design docs
└── public/              # Static assets
```

## Quick Start

**Frontend:**
```bash
npm install
npm run dev          # localhost:4321
```

**Backend:**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 tests/test_engine.py    # 5/5 tests
```

## Tech Stack

- **Frontend**: Astro 5.x + Tailwind 4.x (Cloudflare Pages)
- **Backend**: Python 3.11+ (FastAPI planned)
- **Data**: ccxt + Parquet storage
- **Deploy**: Cloudflare Pages (frontend) + Mac Mini (backend API)

## License

All rights reserved.
