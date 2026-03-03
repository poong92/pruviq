#!/usr/bin/env python3
"""
Fetch latest 1H OHLCV data from Binance Futures and append to CSV files.

Usage:
    python backend/scripts/update_ohlcv.py [--data-dir /path/to/futures]

Fetches up to 1000 bars per symbol from the last CSV timestamp.
Skips symbols that are already up to date (within 2 hours).
"""

import os
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta

import requests
import pandas as pd


BINANCE_URL = "https://fapi.binance.com/fapi/v1/klines"
SKIP = {"intcusdt", "tslausdt", "hoodusdt", "paxgusdt", "gunusdt", "xagusdt"}
INTERVAL = "1h"
MAX_BARS = 1000
SLEEP_BETWEEN = 0.1  # rate limit courtesy


def get_last_timestamp(csv_path: Path) -> datetime:
    """Read last timestamp from CSV without loading the whole file."""
    with open(csv_path, "rb") as f:
        # Seek to end and read last few KB
        f.seek(0, 2)
        size = f.tell()
        f.seek(max(0, size - 4096))
        last_lines = f.read().decode("utf-8", errors="ignore").strip().split("\n")
    last_line = last_lines[-1]
    ts_str = last_line.split(",")[0]
    return pd.Timestamp(ts_str).to_pydatetime().replace(tzinfo=timezone.utc)


def fetch_klines(symbol: str, start_ms: int, limit: int = MAX_BARS) -> list:
    """Fetch klines from Binance Futures API."""
    params = {
        "symbol": symbol,
        "interval": INTERVAL,
        "startTime": start_ms,
        "limit": limit,
    }
    resp = requests.get(BINANCE_URL, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def klines_to_rows(klines: list) -> list[dict]:
    """Convert Binance klines to CSV-compatible rows."""
    rows = []
    for k in klines:
        rows.append({
            "timestamp": datetime.fromtimestamp(k[0] / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
            "quote_volume": float(k[7]),
            "trades": int(k[8]),
        })
    return rows


def update_symbol(csv_path: Path, symbol: str, dry_run: bool = False) -> int:
    """Update a single symbol CSV. Returns number of new bars added."""
    last_ts = get_last_timestamp(csv_path)
    now = datetime.now(timezone.utc)

    # Skip if already recent (within 2 hours)
    if (now - last_ts) < timedelta(hours=2):
        return 0

    # Fetch from 1 hour after last bar
    start_ms = int((last_ts + timedelta(hours=1)).timestamp() * 1000)
    klines = fetch_klines(symbol, start_ms)

    if not klines:
        return 0

    # Filter only completed bars (close time < now)
    completed = [k for k in klines if k[6] < int(now.timestamp() * 1000)]
    if not completed:
        return 0

    rows = klines_to_rows(completed)

    # Filter out rows with timestamp <= last_ts (avoid duplicates)
    last_ts_str = last_ts.strftime("%Y-%m-%d %H:%M:%S")
    new_rows = [r for r in rows if r["timestamp"] > last_ts_str]

    if not new_rows or dry_run:
        return len(new_rows)

    # Append to CSV
    with open(csv_path, "a") as f:
        for row in new_rows:
            f.write(f'{row["timestamp"]},{row["open"]},{row["high"]},{row["low"]},{row["close"]},{row["volume"]},{row["quote_volume"]},{row["trades"]}\n')

    # Post-append dedup: read back and remove any duplicates
    try:
        df = pd.read_csv(csv_path)
        before = len(df)
        df = df.drop_duplicates(subset=["timestamp"], keep="last")
        if len(df) < before:
            df.to_csv(csv_path, index=False)
            print(f"    dedup: removed {before - len(df)} duplicate rows")
    except Exception:
        pass  # dedup is best-effort; append already succeeded

    return len(new_rows)


def main():
    parser = argparse.ArgumentParser(description="Update OHLCV data from Binance")
    parser.add_argument("--data-dir", type=str, default=os.getenv(
        "PRUVIQ_DATA_DIR",
        str(Path(__file__).parent.parent.parent.parent / "autotrader" / "data" / "futures")
    ))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--symbols", nargs="*", help="Only update these symbols")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"Data directory not found: {data_dir}")
        sys.exit(1)

    files = sorted(data_dir.glob("*_1h.csv"))
    total_updated = 0
    total_new_bars = 0
    errors = 0

    for f in files:
        stem = f.stem.replace("_1h", "")
        if stem in SKIP:
            continue
        symbol = stem.upper()
        if args.symbols and symbol not in [s.upper() for s in args.symbols]:
            continue

        try:
            new_bars = update_symbol(f, symbol, dry_run=args.dry_run)
            if new_bars > 0:
                total_updated += 1
                total_new_bars += new_bars
                print(f"  {symbol}: +{new_bars} bars")
            time.sleep(SLEEP_BETWEEN)
        except Exception as e:
            errors += 1
            print(f"  {symbol}: ERROR {e}")

    print(f"\nDone: {total_updated} symbols updated, {total_new_bars} new bars, {errors} errors")
    if args.dry_run:
        print("(dry run - no files modified)")


if __name__ == "__main__":
    main()
