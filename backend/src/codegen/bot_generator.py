#!/usr/bin/env python3
"""Generate trading bot Python code from strategy config."""
import json
import zipfile
import io
from datetime import datetime


BOT_TEMPLATE = '''#!/usr/bin/env python3
"""
PRUVIQ Trading Bot — {strategy_name}
Generated: {generated_at}
Backtest: WR {wr}%, PF {pf}

⚠️ NOT FINANCIAL ADVICE. Trade at your own risk.
⚠️ PRUVIQ does not execute trades on your behalf.
"""

import ccxt
import pandas as pd
import numpy as np
import time
import json
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# ─── Configuration ────────────────────────────────────────
with open("config.json") as f:
    CONFIG = json.load(f)

EXCHANGE = ccxt.binance({{
    "apiKey": os.environ["BINANCE_API_KEY"],
    "secret": os.environ["BINANCE_API_SECRET"],
    "options": {{"defaultType": "future"}},
}})
EXCHANGE.set_sandbox_mode(CONFIG.get("paper_trading", True))

SYMBOL_LIST = CONFIG.get("coins", ["BTCUSDT"])
DIRECTION = CONFIG["direction"]
SL_PCT = CONFIG["sl_pct"] / 100
TP_PCT = CONFIG["tp_pct"] / 100
MAX_BARS = CONFIG["max_bars"]
LEVERAGE = CONFIG.get("leverage", 5)
POSITION_SIZE = CONFIG.get("position_size_usd", 60)
AVOID_HOURS = set(CONFIG.get("avoid_hours_utc", []))

# ─── Indicator Calculation ────────────────────────────────
{indicator_code}

# ─── Signal Detection ─────────────────────────────────────
{signal_code}

# ─── Risk Management ─────────────────────────────────────
class RiskManager:
    def __init__(self):
        self.daily_pnl = 0.0
        self.peak_equity = POSITION_SIZE * len(SYMBOL_LIST)
        self.equity = self.peak_equity

    def can_trade(self):
        daily_limit = CONFIG.get("daily_loss_limit_pct", 7) / 100
        max_dd = CONFIG.get("max_drawdown_pct", 20) / 100
        if self.daily_pnl < -daily_limit * self.peak_equity:
            print(f"Daily loss limit reached: {{self.daily_pnl:.2f}}")
            return False
        dd = (self.peak_equity - self.equity) / self.peak_equity
        if dd > max_dd:
            print(f"Max drawdown reached: {{dd*100:.1f}}%")
            return False
        return True

# ─── Main Loop ────────────────────────────────────────────
def main():
    print(f"PRUVIQ Bot — {{CONFIG['strategy_name']}}")
    print(f"Direction: {{DIRECTION}}, SL: {{SL_PCT*100}}%, TP: {{TP_PCT*100}}%")
    print(f"Coins: {{len(SYMBOL_LIST)}}, Leverage: {{LEVERAGE}}x")

    if CONFIG.get("paper_trading", True):
        print("⚠️  PAPER TRADING MODE — no real money at risk")

    risk = RiskManager()
    positions = {{}}

    while True:
        try:
            now = datetime.utcnow()
            if now.hour in AVOID_HOURS:
                time.sleep(60)
                continue

            if not risk.can_trade():
                print("Risk limit reached — pausing 1 hour")
                time.sleep(3600)
                continue

            for symbol in SYMBOL_LIST:
                if symbol in positions:
                    # Check SL/TP/timeout
                    pos = positions[symbol]
                    bars_held = (now - pos["entry_time"]).total_seconds() / 3600

                    ticker = EXCHANGE.fetch_ticker(symbol)
                    current = ticker["last"]

                    if DIRECTION == "short":
                        pnl_pct = (pos["entry_price"] - current) / pos["entry_price"]
                    else:
                        pnl_pct = (current - pos["entry_price"]) / pos["entry_price"]

                    if pnl_pct <= -SL_PCT or pnl_pct >= TP_PCT or bars_held >= MAX_BARS:
                        reason = "SL" if pnl_pct <= -SL_PCT else "TP" if pnl_pct >= TP_PCT else "TIMEOUT"
                        print(f"  Close {{symbol}}: {{reason}} PnL={{pnl_pct*100:.2f}}%")
                        # Close position
                        side = "buy" if DIRECTION == "short" else "sell"
                        EXCHANGE.create_market_order(symbol, side, pos["amount"])
                        risk.equity += POSITION_SIZE * pnl_pct
                        risk.daily_pnl += POSITION_SIZE * pnl_pct
                        del positions[symbol]
                else:
                    # Check for entry signal
                    ohlcv = EXCHANGE.fetch_ohlcv(symbol, "1h", limit=100)
                    df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
                    df = calculate_indicators(df)

                    if check_signal(df, len(df) - 2):  # Previous candle (confirmed)
                        entry_price = df.iloc[-1]["open"]
                        amount = (POSITION_SIZE * LEVERAGE) / entry_price

                        side = "sell" if DIRECTION == "short" else "buy"
                        EXCHANGE.set_leverage(LEVERAGE, symbol)
                        order = EXCHANGE.create_market_order(symbol, side, amount)

                        positions[symbol] = {{
                            "entry_price": entry_price,
                            "entry_time": now,
                            "amount": amount,
                        }}
                        print(f"  Open {{symbol}}: {{DIRECTION}} @ {{entry_price:.2f}}")

                time.sleep(0.1)  # Rate limit

            # Sleep until next candle
            next_hour = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
            sleep_sec = (next_hour - datetime.utcnow()).total_seconds() + 5
            print(f"Next check in {{sleep_sec/60:.0f}} min ({{len(positions)}} open positions)")
            time.sleep(max(sleep_sec, 10))

        except KeyboardInterrupt:
            print("\\nStopping bot...")
            break
        except Exception as e:
            print(f"Error: {{e}}")
            time.sleep(60)

if __name__ == "__main__":
    main()
'''


def generate_bot_zip(
    strategy_id: str,
    direction: str,
    sl_pct: float,
    tp_pct: float,
    max_bars: int,
    leverage: int,
    position_size: float,
    coins: list,
    avoid_hours: list,
    wr: float = 0,
    pf: float = 0,
    ret: float = 0,
    trades: int = 0,
    mdd: float = 0,
) -> bytes:
    """Generate a .zip file containing the trading bot."""

    strategy_name = strategy_id.replace("-", " ").title()
    generated_at = datetime.utcnow().isoformat()

    # Simple indicator code (BB + EMA + Volume for BB Squeeze)
    indicator_code = '''def calculate_indicators(df):
    close = df["close"]
    volume = df["volume"]
    # Bollinger Bands
    sma = close.rolling(20).mean()
    std = close.rolling(20).std()
    df["bb_mid"] = sma
    df["bb_upper"] = sma + 2 * std
    df["bb_lower"] = sma - 2 * std
    df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / sma * 100
    df["bb_width_ma"] = df["bb_width"].rolling(10).mean()
    df["bb_expanding"] = df["bb_width"] > df["bb_width"].shift(1)
    df["recent_squeeze"] = (df["bb_width"] < df["bb_width_ma"] * 0.8).rolling(10).max().astype(bool)
    # EMA
    df["ema_fast"] = close.ewm(span=20).mean()
    df["ema_slow"] = close.ewm(span=50).mean()
    df["downtrend"] = df["ema_fast"] < df["ema_slow"]
    df["uptrend"] = df["ema_fast"] > df["ema_slow"]
    # Volume
    vol_ma = volume.rolling(10).mean()
    df["vol_ratio"] = np.where(vol_ma > 0, volume / vol_ma, 0)
    return df'''

    signal_code = f'''def check_signal(df, idx):
    """Check for entry signal at bar idx."""
    if idx < 50: return False
    row = df.iloc[idx]
    prev = df.iloc[idx - 1]
    # BB Squeeze conditions (simplified)
    if not prev.get("recent_squeeze", False): return False
    if not row.get("bb_expanding", False): return False
    if row.get("bb_width", 0) < row.get("bb_width_ma", 0) * 0.9: return False
    if prev.get("vol_ratio", 0) < 2.0: return False
    if "{direction}" == "short" and not prev.get("downtrend", False): return False
    if "{direction}" == "long" and not prev.get("uptrend", False): return False
    return True'''

    bot_code = BOT_TEMPLATE.format(
        strategy_name=strategy_name,
        generated_at=generated_at,
        wr=wr,
        pf=pf,
        indicator_code=indicator_code,
        signal_code=signal_code,
    )

    config = {
        "strategy_name": strategy_name,
        "strategy_id": strategy_id,
        "direction": direction,
        "sl_pct": sl_pct,
        "tp_pct": tp_pct,
        "max_bars": max_bars,
        "leverage": leverage,
        "position_size_usd": position_size,
        "max_positions": 100,
        "daily_loss_limit_pct": 7.0,
        "max_drawdown_pct": 20.0,
        "coins": coins or ["BTCUSDT", "ETHUSDT"],
        "avoid_hours_utc": avoid_hours,
        "paper_trading": True,
        "generated_by": "PRUVIQ v0.3.0",
        "generated_at": generated_at,
        "backtest_win_rate": wr,
        "backtest_profit_factor": pf,
    }

    readme = f"""# PRUVIQ Trading Bot — {strategy_name}

## Quick Start

1. Install dependencies:
   ```
   pip install ccxt python-dotenv pandas numpy
   ```

2. Copy `.env.example` to `.env` and add your Binance API keys:
   ```
   cp .env.example .env
   ```

3. Run in paper trading mode (default):
   ```
   python pruviq_bot.py
   ```

4. To enable live trading, set `"paper_trading": false` in config.json.

## Backtest Results
- Win Rate: {wr:.1f}%
- Profit Factor: {pf:.2f}
- Total Return: {'+' if ret >= 0 else ''}{ret:.1f}%

## DISCLAIMER
This is NOT financial advice. Trading cryptocurrencies involves substantial risk of loss.
PRUVIQ does not execute trades on your behalf. You are solely responsible for your trading decisions.
Past backtest performance does not guarantee future results.

Generated by [PRUVIQ](https://pruviq.com) on {generated_at[:10]}.
"""

    # Create zip
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        folder = f"pruviq_bot_{strategy_id}"
        zf.writestr(f"{folder}/pruviq_bot.py", bot_code)
        zf.writestr(f"{folder}/config.json", json.dumps(config, indent=2))
        zf.writestr(f"{folder}/requirements.txt", "ccxt>=4.0\npython-dotenv\npandas\nnumpy\n")
        zf.writestr(f"{folder}/.env.example", "BINANCE_API_KEY=your_api_key_here\nBINANCE_API_SECRET=your_secret_here\n")
        zf.writestr(f"{folder}/README.md", readme)

    buf.seek(0)
    return buf.getvalue()
