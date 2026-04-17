#!/usr/bin/env python3
"""
PRUVIQ — OHLCV update from OKX public API (USDT-SWAP).

Replaces the Binance fetcher (`update_ohlcv.py`) for the Full-OKX data-source
migration. Writes the same CSV schema into the same directory, so the
downstream DataManager / signal_scanner see no code change.

Behaviour:
  * For every existing `*_1h.csv` in --data-dir:
      - if the symbol IS live on OKX USDT-SWAP → append new bars since the
        last CSV timestamp (bounded at 100 bars per call — enough for any
        4h-timer catch-up).
      - if the symbol is NOT on OKX → log and skip (will be removed from the
        repo in Phase B).
  * For each `--new-symbol` passed: if its CSV is missing, seed up to
    `--seed-days * 24` hours of history from OKX `/history-candles`
    (OKX typically has ~2.3y of 1h depth).

Outputs one line per updated symbol plus a final summary.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from okx.market_fetcher import OkxMarketFetcher, OKX_PUBLIC_BASE  # noqa: E402

logger = logging.getLogger("pruviq.update_ohlcv_okx")

CSV_HEADER = "timestamp,open,high,low,close,volume"
OKX_INSTRUMENTS_URL = f"{OKX_PUBLIC_BASE}/api/v5/public/instruments?instType=SWAP"


def fetch_okx_usdt_swap_symbols(timeout: float = 15.0) -> set[str]:
    """Return the set of Binance-style symbols that have a live OKX USDT-SWAP."""
    req = urllib.request.Request(OKX_INSTRUMENTS_URL, headers={"User-Agent": "pruviq-update/1"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = __import__("json").loads(r.read())
    if data.get("code") != "0":
        raise RuntimeError(f"OKX instruments error: {data}")
    syms: set[str] = set()
    for x in data["data"]:
        if x.get("state") != "live" or x.get("settleCcy") != "USDT":
            continue
        parts = x["instId"].split("-")
        if len(parts) == 3 and parts[1] == "USDT" and parts[2] == "SWAP":
            syms.add((parts[0] + "USDT").upper())
    return syms


def get_last_timestamp(csv_path: Path) -> datetime | None:
    """Read the last row's timestamp without loading the whole file.
    Returns None if the CSV is header-only or unreadable."""
    try:
        with open(csv_path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 4096))
            tail = f.read().decode("utf-8", errors="ignore").strip().split("\n")
        if len(tail) < 2:
            return None
        last = tail[-1]
        ts_str = last.split(",", 1)[0]
        return pd.Timestamp(ts_str).to_pydatetime().replace(tzinfo=timezone.utc)
    except Exception:
        return None


def df_to_csv_rows(df: pd.DataFrame) -> list[str]:
    """Serialise a fetched DataFrame back into CSV lines matching the existing schema.
    We intentionally keep only the 6 canonical columns (timestamp, OHLCV) — extras
    from the Binance ingest pipeline (quote_volume, trades) are left absent; DataManager
    only reads the 6 we write."""
    rows = []
    for _, r in df.iterrows():
        ts = r["timestamp"]
        if hasattr(ts, "strftime"):
            ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
        else:
            ts_str = str(ts)
        rows.append(
            f"{ts_str},{r['open']},{r['high']},{r['low']},{r['close']},{r['volume']}"
        )
    return rows


async def update_existing_csv(
    fetcher: OkxMarketFetcher,
    csv_path: Path,
    symbol: str,
    dry_run: bool = False,
) -> int:
    """Append new OKX 1h bars to an existing CSV. Returns #rows added."""
    last_ts = get_last_timestamp(csv_path)
    now = datetime.now(timezone.utc)

    # If the CSV is recent (< 2h old) — nothing to do
    if last_ts is not None and (now - last_ts) < timedelta(hours=2):
        return 0

    # OKX /market/candles returns newest-first, limit up to 300
    df = await fetcher.fetch_df(symbol, interval="1h", limit=100)
    if df.empty:
        return 0

    # Drop any bar whose close-time hasn't happened yet (incomplete candle)
    # OKX returns bars with open-time; 1h-bar at 14:00 is incomplete until 15:00.
    # `now` is already tz-aware UTC, so pd.Timestamp() without tz=.
    complete_cutoff = pd.Timestamp(now - timedelta(hours=1))
    df = df[df["timestamp"] <= complete_cutoff]

    # Keep only bars strictly newer than last_ts
    if last_ts is not None:
        df = df[df["timestamp"] > pd.Timestamp(last_ts)]

    if df.empty:
        return 0

    if dry_run:
        return len(df)

    rows = df_to_csv_rows(df)
    with open(csv_path, "a") as f:
        for row in rows:
            f.write(row + "\n")
    return len(rows)


async def fetch_history_paged(
    symbol: str,
    fetcher: OkxMarketFetcher,
    max_pages: int = 200,
) -> pd.DataFrame:
    """Walk /history-candles backward to assemble a long history.
    Uses the `after` cursor (older-than), 100 bars per page. Cap at max_pages.
    Shared-rate-limit + 429 backoff are handled inside `fetch_history_page`.
    """
    all_candles = []
    oldest_ts: str | None = None
    for _ in range(max_pages):
        page = await fetcher.fetch_history_page(
            symbol, interval="1h", after_ms=oldest_ts, limit=100,
        )
        if not page:
            break
        page_oldest = str(page[0].ts_ms)  # page is sorted old→new
        if page_oldest == oldest_ts:
            break
        all_candles.extend(page)
        oldest_ts = page_oldest
    if not all_candles:
        return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])
    all_candles.sort(key=lambda c: c.ts_ms)
    return pd.DataFrame({
        "timestamp": pd.to_datetime([c.ts_ms for c in all_candles], unit="ms", utc=True),
        "open":   [c.open for c in all_candles],
        "high":   [c.high for c in all_candles],
        "low":    [c.low for c in all_candles],
        "close":  [c.close for c in all_candles],
        "volume": [c.volume for c in all_candles],
    })


async def seed_new_symbol(
    fetcher: OkxMarketFetcher,
    data_dir: Path,
    symbol: str,
    max_pages: int,
    dry_run: bool,
) -> int:
    """Create a CSV for a symbol that doesn't exist yet, seeding with OKX history."""
    csv_path = data_dir / f"{symbol.lower()}_1h.csv"
    if csv_path.exists():
        return 0  # caller's job to invoke update_existing_csv instead

    df = await fetch_history_paged(symbol, fetcher, max_pages=max_pages)
    if df.empty:
        logger.warning("no history for %s — skipping seed", symbol)
        return 0

    if dry_run:
        return len(df)

    rows = df_to_csv_rows(df)
    with open(csv_path, "w") as f:
        f.write(CSV_HEADER + "\n")
        for r in rows:
            f.write(r + "\n")
    return len(rows)


async def run(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"ERROR: data directory not found: {data_dir}", file=sys.stderr)
        return 1

    okx_syms = fetch_okx_usdt_swap_symbols()
    print(f"OKX USDT-SWAP live symbols: {len(okx_syms)}")

    existing_csvs = sorted(data_dir.glob("*_1h.csv"))
    existing_syms = {p.stem.replace("_1h", "").upper() for p in existing_csvs}

    targets_update = [
        (p, p.stem.replace("_1h", "").upper())
        for p in existing_csvs
        if p.stem.replace("_1h", "").upper() in okx_syms
    ]
    off_coverage = sorted(s for s in existing_syms if s not in okx_syms)

    new_syms = [s.upper() for s in (args.new_symbols or [])]
    seed_targets = [s for s in new_syms if s in okx_syms and s not in existing_syms]
    skipped_new = [s for s in new_syms if s not in okx_syms]

    print(
        f"update-plan: {len(targets_update)} existing, "
        f"{len(seed_targets)} new seeds, "
        f"{len(off_coverage)} off-coverage (skip), "
        f"{len(skipped_new)} requested-but-not-on-OKX"
    )
    if off_coverage:
        print(f"  off-coverage sample: {off_coverage[:10]}{'...' if len(off_coverage) > 10 else ''}")
    if skipped_new:
        print(f"  skipped_new: {skipped_new}")

    total_updated = 0
    total_new_bars = 0
    total_seeded = 0
    errors = 0

    async with OkxMarketFetcher() as fetcher:
        for csv_path, symbol in targets_update:
            try:
                n = await update_existing_csv(fetcher, csv_path, symbol, dry_run=args.dry_run)
                if n > 0:
                    total_updated += 1
                    total_new_bars += n
                    print(f"  update {symbol}: +{n} bars")
            except Exception as e:
                errors += 1
                print(f"  update {symbol}: ERROR {type(e).__name__}: {e}")

        for symbol in seed_targets:
            try:
                n = await seed_new_symbol(
                    fetcher, data_dir, symbol,
                    max_pages=args.seed_pages, dry_run=args.dry_run,
                )
                if n > 0:
                    total_seeded += 1
                    print(f"  seed {symbol}: +{n} bars (new file)")
                else:
                    print(f"  seed {symbol}: (no data returned)")
            except Exception as e:
                errors += 1
                print(f"  seed {symbol}: ERROR {type(e).__name__}: {e}")

    print(
        f"\nDone: updated={total_updated}, seeded={total_seeded}, "
        f"new_bars={total_new_bars}, errors={errors}"
    )
    if args.dry_run:
        print("(dry run — no files modified)")
    return 0 if errors == 0 else 2


def main() -> int:
    parser = argparse.ArgumentParser(description="Update OHLCV from OKX USDT-SWAP")
    parser.add_argument(
        "--data-dir",
        type=str,
        default=os.getenv(
            "PRUVIQ_DATA_DIR",
            str(Path(__file__).parent.parent / "data" / "futures"),
        ),
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--new-symbols", nargs="*", default=[],
        help="OKX-only symbols to seed with full history (e.g. SHIBUSDT PEPEUSDT).",
    )
    parser.add_argument(
        "--seed-pages", type=int, default=200,
        help="Max /history-candles pages per new-seed symbol (100 bars each).",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    started = time.time()
    try:
        rc = asyncio.run(run(args))
    except KeyboardInterrupt:
        print("interrupted", file=sys.stderr)
        rc = 130
    print(f"elapsed: {time.time() - started:.1f}s")
    return rc


if __name__ == "__main__":
    sys.exit(main())
