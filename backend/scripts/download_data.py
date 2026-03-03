#!/usr/bin/env python3
"""
PRUVIQ Phase 0: 데이터 수집

사용법:
    # 현물 거래량 상위 300개 다운로드
    python3 scripts/download_data.py --market spot --top 300

    # 선물 전체 다운로드
    python3 scripts/download_data.py --market futures

    # 특정 코인만
    python3 scripts/download_data.py --market spot --symbols BTC ETH SOL

    # 기존 데이터 업데이트
    python3 scripts/download_data.py --market spot --update
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.data.downloader import OHLCVDownloader

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"


def main():
    parser = argparse.ArgumentParser(description="PRUVIQ Data Downloader")
    parser.add_argument("--market", choices=["spot", "futures"], default="spot",
                        help="Market type (default: spot)")
    parser.add_argument("--top", type=int, default=0, help="Top N by volume (0=all)")
    parser.add_argument("--symbols", nargs="+", help="Specific symbols")
    parser.add_argument("--days", type=int, default=730, help="Days of history (default: 730)")
    parser.add_argument("--timeframe", default="1h", help="Timeframe (default: 1h)")
    parser.add_argument("--min-volume", type=float, default=1_000_000,
                        help="Min 24h volume USD (default: 1M)")
    parser.add_argument("--update", action="store_true", help="Update existing data")
    args = parser.parse_args()

    exchange_key = f"binance_{args.market}"

    print("=" * 60)
    print(f"PRUVIQ Data Downloader — {args.market.upper()}")
    print("=" * 60)

    downloader = OHLCVDownloader(DATA_DIR)
    downloader.download_all(
        exchange_key=exchange_key,
        timeframe=args.timeframe,
        days=args.days,
        min_volume_usd=args.min_volume,
        top_n=args.top,
        symbols=args.symbols,
        update=args.update,
    )


if __name__ == "__main__":
    main()
