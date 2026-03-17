"""
PRUVIQ Data Manager — Singleton with in-memory caching.

Loads OHLCV CSV files once at startup, serves them from RAM.
"""

import time
from pathlib import Path
from typing import Optional, Dict, List, Tuple

import pandas as pd


class DataManager:
    """Singleton data loader with in-memory cache."""

    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, data_dir: Optional[Path] = None):
        if self._initialized:
            return
        self._initialized = True
        self._data: Dict[str, pd.DataFrame] = {}
        self._coin_info: List[dict] = []
        self._load_time = 0.0

        if data_dir:
            self.load(data_dir)

    def load(self, data_dir: Path):
        """Load all 1H OHLCV CSV files into memory."""
        start = time.time()
        self._data.clear()
        self._coin_info.clear()

        # Skip problematic symbols
        skip = {"intcusdt", "tslausdt", "hoodusdt", "paxgusdt", "gunusdt",
                "usdcusdt",    # stablecoin (USDC) — no volatility
                "stableusdt",  # stablecoin project — no volatility
                "btcdomusdt",  # BTC dominance index — not a tradable asset
                }

        files = sorted(data_dir.glob("*_1h.csv"), key=lambda f: f.stat().st_size, reverse=True)
        # Auto-detect futures/ subdirectory if no CSVs found at top level
        if not files and (data_dir / "futures").is_dir():
            files = sorted((data_dir / "futures").glob("*_1h.csv"), key=lambda f: f.stat().st_size, reverse=True)

        for f in files:
            stem = f.stem.replace("_1h", "")
            if stem in skip:
                continue

            try:
                df = pd.read_csv(f)
                if len(df) < 500:
                    continue

                df["timestamp"] = pd.to_datetime(df["timestamp"])
                df = df.drop_duplicates(subset=["timestamp"], keep="last").reset_index(drop=True)
                symbol = stem.upper()
                self._data[symbol] = df
                self._coin_info.append({
                    "symbol": symbol,
                    "rows": len(df),
                    "date_from": str(df["timestamp"].min().date()),
                    "date_to": str(df["timestamp"].max().date()),
                })
            except Exception:
                continue

        self._load_time = time.time() - start

    @property
    def coin_count(self) -> int:
        return len(self._data)

    @property
    def coins(self) -> list[dict]:
        return self._coin_info

    def get_df(self, symbol: str) -> Optional[pd.DataFrame]:
        return self._data.get(symbol.upper())

    def sort_by_market_cap(self, market_cap_ranks: Dict[str, int]) -> None:
        """Re-sort _coin_info by market cap rank (ascending). Coins without rank go last."""
        self._coin_info.sort(
            key=lambda c: market_cap_ranks.get(c["symbol"], 9999)
        )

    def get_top_n(self, n: int) -> List[Tuple[str, pd.DataFrame]]:
        """Get top N coins by market cap rank (call sort_by_market_cap first)."""
        return [(info["symbol"], self._data[info["symbol"]])
                for info in self._coin_info[:n]
                if info["symbol"] in self._data]

    def get_symbols(self, symbols: List[str]) -> List[Tuple[str, pd.DataFrame]]:
        """Get specific symbols."""
        result = []
        for sym in symbols:
            sym_upper = sym.upper()
            if sym_upper in self._data:
                result.append((sym_upper, self._data[sym_upper]))
        return result

    def get_resampled(self, symbol: str, timeframe: str = "1H") -> Optional[pd.DataFrame]:
        """Get OHLCV data resampled to the requested timeframe.

        Args:
            symbol: Trading pair symbol (e.g. "BTCUSDT")
            timeframe: Candle timeframe. One of: 1H, 2H, 4H, 6H, 12H, 1D, 1W

        Returns:
            Resampled DataFrame with columns: timestamp, open, high, low, close, volume.
            Returns None if symbol not found.
            Returns original 1H data if timeframe is "1H".
        """
        df = self.get_df(symbol)
        if df is None:
            return None

        if timeframe == "1H":
            return df  # Return original data as-is

        # Map timeframe string to pandas offset alias
        tf_map = {
            "2H": "2h", "4H": "4h", "6H": "6h",
            "12H": "12h", "1D": "1D", "1W": "1W",
        }
        offset = tf_map.get(timeframe)
        if not offset:
            return df  # Unknown timeframe, fall back to 1H

        # Resample OHLCV using standard aggregation rules
        resampled = (
            df.set_index("timestamp")
            .resample(offset)
            .agg({
                "open": "first",
                "high": "max",
                "low": "min",
                "close": "last",
                "volume": "sum",
            })
            .dropna()
            .reset_index()
        )

        return resampled

    def data_range(self) -> str:
        """Overall data range."""
        if not self._coin_info:
            return "N/A"
        first = self._coin_info[0]
        return f"{first['date_from']} ~ {first['date_to']}"
