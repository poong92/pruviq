"""
PRUVIQ Data Downloader
거래소별 OHLCV 데이터 수집

데이터 공정성 원칙:
- 현물(Spot) = 기본 데이터 (누구나 접근 가능)
- 선물(Futures) = 별도 표기 (레버리지/펀딩비 포함)
- 거래소 명시 (어떤 데이터인지 투명하게)
"""

import ccxt
import pandas as pd
import time
from pathlib import Path
from datetime import datetime, timedelta


class OHLCVDownloader:
    """멀티 거래소 OHLCV 다운로더"""

    # 거래소별 설정
    EXCHANGE_CONFIG = {
        "binance_spot": {
            "class": "binance",
            "market_type": "spot",
            "symbol_suffix": "/USDT",
            "rate_limit_ms": 50,
        },
        "binance_futures": {
            "class": "binanceusdm",
            "market_type": "futures",
            "symbol_suffix": "/USDT:USDT",
            "rate_limit_ms": 50,
        },
    }

    # 스테이블코인 (제외 대상)
    STABLECOINS = {"USDC", "BUSD", "DAI", "TUSD", "FDUSD", "USDP", "USDD", "PYUSD"}

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self._exchanges = {}

    def _get_exchange(self, exchange_key: str):
        """거래소 인스턴스 (캐시)"""
        if exchange_key not in self._exchanges:
            config = self.EXCHANGE_CONFIG[exchange_key]
            cls = getattr(ccxt, config["class"])
            self._exchanges[exchange_key] = cls()
        return self._exchanges[exchange_key]

    def list_pairs(self, exchange_key: str, min_volume_usd: float = 1_000_000) -> list:
        """거래 가능한 USDT 페어 조회 (거래량순)"""
        config = self.EXCHANGE_CONFIG[exchange_key]
        exchange = self._get_exchange(exchange_key)
        exchange.load_markets()
        tickers = exchange.fetch_tickers()

        pairs = []
        for symbol, ticker in tickers.items():
            if config["market_type"] == "spot":
                if not symbol.endswith("/USDT") or ":" in symbol:
                    continue
            else:
                if not symbol.endswith("/USDT:USDT"):
                    continue

            base = symbol.split("/")[0]
            if base in self.STABLECOINS:
                continue

            volume_usd = ticker.get("quoteVolume", 0) or 0
            if volume_usd < min_volume_usd:
                continue

            pairs.append({
                "base": base,
                "ccxt_symbol": symbol,
                "volume_usd": volume_usd,
            })

        pairs.sort(key=lambda x: x["volume_usd"], reverse=True)
        return pairs

    def download_ohlcv(
        self,
        exchange_key: str,
        ccxt_symbol: str,
        timeframe: str = "1h",
        days: int = 730,
        since_ms: int = None,
    ) -> pd.DataFrame:
        """OHLCV 데이터 다운로드 (페이지네이션)"""
        config = self.EXCHANGE_CONFIG[exchange_key]
        exchange = self._get_exchange(exchange_key)

        if since_ms is None:
            since_ms = exchange.parse8601(
                (datetime.now() - timedelta(days=days)).isoformat()
            )

        all_ohlcv = []
        while True:
            try:
                ohlcv = exchange.fetch_ohlcv(ccxt_symbol, timeframe, since_ms, limit=1000)
            except Exception as e:
                print(f"    API error: {e}")
                time.sleep(2)
                continue

            if not ohlcv:
                break

            all_ohlcv.extend(ohlcv)
            since_ms = ohlcv[-1][0] + 1

            if len(ohlcv) < 1000:
                break

            time.sleep(config["rate_limit_ms"] / 1000)

        if not all_ohlcv:
            return pd.DataFrame()

        df = pd.DataFrame(
            all_ohlcv,
            columns=["timestamp", "open", "high", "low", "close", "volume"],
        )
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
        df = df.drop_duplicates(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)
        return df

    def download_all(
        self,
        exchange_key: str,
        timeframe: str = "1h",
        days: int = 730,
        min_volume_usd: float = 1_000_000,
        top_n: int = 0,
        symbols: list = None,
        update: bool = False,
    ) -> dict:
        """전체 다운로드"""
        config = self.EXCHANGE_CONFIG[exchange_key]
        market_dir = self.data_dir / config["market_type"]
        market_dir.mkdir(parents=True, exist_ok=True)

        # 페어 조회
        print(f"Fetching {exchange_key} pairs...")
        all_pairs = self.list_pairs(exchange_key, min_volume_usd)
        print(f"  Found {len(all_pairs)} pairs (min vol: ${min_volume_usd:,.0f})")

        # 필터
        if symbols:
            targets = [s.upper() for s in symbols]
            pairs = [p for p in all_pairs if p["base"] in targets]
        elif top_n > 0:
            pairs = all_pairs[:top_n]
        else:
            pairs = all_pairs

        # 기존 데이터 확인
        existing = {}
        for f in market_dir.glob(f"*_{timeframe}.csv"):
            sym = f.stem.replace(f"_{timeframe}", "").upper()
            existing[sym] = f

        if update:
            pairs = [p for p in pairs if f"{p['base']}USDT" in existing]

        results = {"downloaded": 0, "skipped": 0, "errors": 0}
        print(f"\nDownloading {len(pairs)} coins ({days} days, {timeframe})...")
        print("-" * 60)

        for i, pair in enumerate(pairs, 1):
            base = pair["base"]
            symbol = f"{base}USDT"
            vol_m = pair["volume_usd"] / 1e6

            print(f"[{i:3d}/{len(pairs)}] {symbol:12s} ${vol_m:8.1f}M ...", end=" ", flush=True)

            # 업데이트 모드
            since_ms = None
            if update and symbol in existing:
                try:
                    df_old = pd.read_csv(existing[symbol])
                    last_ts = pd.to_datetime(df_old["timestamp"].iloc[-1])
                    since_ms = int(last_ts.timestamp() * 1000) + 1
                except Exception:
                    pass

            df = self.download_ohlcv(exchange_key, pair["ccxt_symbol"], timeframe, days, since_ms)

            if df.empty or (not update and len(df) < 100):
                print("SKIP (insufficient)")
                results["skipped"] += 1
                continue

            filepath = market_dir / f"{symbol.lower()}_{timeframe}.csv"

            if update and filepath.exists():
                df_old = pd.read_csv(filepath)
                df_old["timestamp"] = pd.to_datetime(df_old["timestamp"])
                combined = pd.concat([df_old, df]).drop_duplicates(subset=["timestamp"], keep="last")
                combined = combined.sort_values("timestamp").reset_index(drop=True)
                new_rows = len(combined) - len(df_old)
                combined.to_csv(filepath, index=False)
                print(f"+{new_rows} rows (total {len(combined)})")
            else:
                df.to_csv(filepath, index=False)
                date_range = f"{df['timestamp'].min().date()} ~ {df['timestamp'].max().date()}"
                print(f"{len(df)} rows ({date_range})")

            results["downloaded"] += 1
            time.sleep(0.1)

        # 요약
        total_files = len(list(market_dir.glob(f"*_{timeframe}.csv")))
        print(f"\n{'=' * 60}")
        print(f"Downloaded: {results['downloaded']}, Skipped: {results['skipped']}")
        print(f"Total {config['market_type']} data: {total_files} coins")
        print(f"Location: {market_dir}")

        return results
