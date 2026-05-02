"""
Indicator Cache — Pre-compute indicators at startup for fast simulation.

Supports multi-strategy caching: strategy_id -> symbol -> indicator-only df.
OHLCV columns are NOT duplicated per strategy — shared from DataManager.
Accessors merge OHLCV + indicators on read (zero-copy concat).

Memory optimization (2026-03-22): 16 strategies x 569 coins was 13GB.
Now stores only indicator columns per strategy (~2.5GB, 77% reduction).
"""

import logging
import pickle
import time
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import pandas as pd

from api.data_manager import DataManager

logger = logging.getLogger("pruviq")

# OHLCV columns shared from DataManager — never duplicated in cache
_OHLCV_COLS = {"timestamp", "open", "high", "low", "close", "volume",
               "quote_volume", "trades"}


def _strip_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    """Return DataFrame with only indicator columns (remove OHLCV)."""
    indicator_cols = [c for c in df.columns if c not in _OHLCV_COLS]
    return df[indicator_cols]


def _merge_ohlcv(ohlcv_df: pd.DataFrame, indicator_df: pd.DataFrame) -> pd.DataFrame:
    """Merge OHLCV + indicator columns into single DataFrame (zero-copy)."""
    return pd.concat([ohlcv_df, indicator_df], axis=1, copy=False)


class IndicatorCache:
    """Pre-computed indicators for all coins, keyed by strategy.

    Stores only indicator columns per strategy.
    OHLCV data is shared from DataManager on read.
    """

    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        # Multi-strategy cache: strategy_id -> symbol -> indicator-only df
        self._multi_cache: Dict[str, Dict[str, pd.DataFrame]] = {}
        # Legacy flat cache for bb-squeeze-short (backwards compat)
        self._cache: Dict[str, pd.DataFrame] = {}
        self._data_manager: Optional[DataManager] = None
        self._build_time = 0.0
        self._primary_strategy = "bb-squeeze-short"

    def load_from_file(self, cache_path, data_manager: DataManager, max_age_sec: int = 14400) -> bool:
        """Load pre-built indicator cache from disk.

        Returns True if loaded successfully and file is fresh enough.
        Caller falls back to in-process build if this returns False.
        """
        path = Path(cache_path)
        if not path.exists():
            logger.info(f"[indicator_cache] No pre-built cache at {path}")
            return False

        file_age = time.time() - path.stat().st_mtime
        if file_age > max_age_sec:
            logger.warning(
                f"[indicator_cache] Pre-built cache is {file_age / 3600:.1f}h old "
                f"(limit {max_age_sec / 3600:.1f}h) — will rebuild in-process"
            )
            return False

        try:
            with open(path, "rb") as f:
                data = pickle.load(f)

            multi_cache = data.get("multi_cache", {})
            if not multi_cache:
                logger.warning("[indicator_cache] Pre-built cache is empty — will rebuild in-process")
                return False

            self._multi_cache = multi_cache
            self._cache = multi_cache.get(self._primary_strategy, {})
            self._data_manager = data_manager

            coin_counts = {sid: len(c) for sid, c in multi_cache.items()}
            logger.info(
                f"[indicator_cache] Loaded from {path} "
                f"(age {file_age / 60:.1f}min built_at={data.get('built_at', 0):.0f}): "
                f"{coin_counts}"
            )
            return True
        except Exception as e:
            logger.warning(f"[indicator_cache] Failed to load pre-built cache: {e}")
            return False

    def build(self, data_manager: DataManager, strategy):
        """Pre-compute indicators for single strategy (backwards compat)."""
        start = time.time()
        self._cache.clear()
        self._data_manager = data_manager

        for info in data_manager.coins:
            symbol = info["symbol"]
            df = data_manager.get_df(symbol)
            if df is None:
                continue
            try:
                full_df = strategy.calculate_indicators(df.copy())
                self._cache[symbol] = _strip_ohlcv(full_df)
            except Exception as e:
                logger.warning(f"[indicator_cache] Failed to compute {symbol}: {type(e).__name__}: {e}")
                continue

        # Also store in multi-cache
        self._multi_cache[self._primary_strategy] = self._cache
        self._build_time = time.time() - start

    def build_multi(self, data_manager: DataManager, strategies: Dict[str, object],
                    max_coins: int = 50):
        """Pre-compute indicators for all strategies x top N coins.

        Memory optimization (2026-03-29): 572 coins x 17 strategies = 7.4GB OOM.
        Limit to top 50 by market cap. /simulate computes on-the-fly for other coins.
        50 coins x 17 strategies ≈ 500MB (93% reduction).
        """
        start = time.time()
        self._multi_cache.clear()
        self._data_manager = data_manager

        # Only cache top N coins (by market cap order from DataManager)
        coins_to_cache = data_manager.coins[:max_coins]
        logger.info(f"[indicator_cache] Building for {len(strategies)} strategies x {len(coins_to_cache)} coins (max_coins={max_coins})")

        for strategy_id, strategy in strategies.items():
            cache = {}
            for info in coins_to_cache:
                symbol = info["symbol"]
                df = data_manager.get_df(symbol)
                if df is None:
                    continue
                try:
                    full_df = strategy.calculate_indicators(df.copy())
                    cache[symbol] = _strip_ohlcv(full_df)
                except Exception as e:
                    logger.warning(f"[indicator_cache] Failed to compute {strategy_id}/{symbol}: {type(e).__name__}: {e}")
                    continue
                # Release GIL between coins so the asyncio event loop (main thread)
                # can handle /health probes. Without this yield, numpy/pandas holds
                # the GIL for 50-200ms per coin, starving health probes → watchdog restarts.
                time.sleep(0.001)
            self._multi_cache[strategy_id] = cache

        # Set flat cache to primary strategy for backwards compat
        self._cache = self._multi_cache.get(self._primary_strategy, {})
        self._build_time = time.time() - start

    @property
    def count(self) -> int:
        return len(self._cache)

    def strategy_count(self, strategy_id: str) -> int:
        return len(self._multi_cache.get(strategy_id, {}))

    def _merged(self, symbol: str, indicator_df: pd.DataFrame) -> pd.DataFrame:
        """Merge OHLCV from DataManager + indicator columns from cache."""
        if self._data_manager is None:
            return indicator_df
        ohlcv = self._data_manager.get_df(symbol)
        if ohlcv is None:
            return indicator_df
        return _merge_ohlcv(ohlcv, indicator_df)

    # --- Legacy (flat) accessors for bb-squeeze-short ---

    def get(self, symbol: str) -> Optional[pd.DataFrame]:
        sym = symbol.upper()
        ind = self._cache.get(sym)
        if ind is None:
            return None
        return self._merged(sym, ind)

    def get_top_n(self, data_manager: DataManager, n: int) -> List[Tuple[str, pd.DataFrame]]:
        """Get top N coins with pre-computed indicators (primary strategy)."""
        result = []
        for info in data_manager.coins[:n]:
            symbol = info["symbol"]
            ind = self._cache.get(symbol)
            if ind is not None:
                result.append((symbol, self._merged(symbol, ind)))
            if len(result) >= n:
                break
        return result

    def get_symbols(self, symbols: List[str]) -> List[Tuple[str, pd.DataFrame]]:
        """Get specific symbols with pre-computed indicators (primary strategy)."""
        result = []
        for sym in symbols:
            sym_upper = sym.upper()
            ind = self._cache.get(sym_upper)
            if ind is not None:
                result.append((sym_upper, self._merged(sym_upper, ind)))
        return result

    # --- Multi-strategy accessors ---

    def get_for_strategy(self, strategy_id: str, symbol: str) -> Optional[pd.DataFrame]:
        """Get cached DataFrame for a specific strategy + symbol."""
        sym = symbol.upper()
        ind = self._multi_cache.get(strategy_id, {}).get(sym)
        if ind is None:
            return None
        return self._merged(sym, ind)

    def get_top_n_for_strategy(self, strategy_id: str, data_manager: DataManager, n: int) -> List[Tuple[str, pd.DataFrame]]:
        """Get top N coins for a specific strategy."""
        cache = self._multi_cache.get(strategy_id, {})
        result = []
        for info in data_manager.coins[:n]:
            symbol = info["symbol"]
            ind = cache.get(symbol)
            if ind is not None:
                result.append((symbol, self._merged(symbol, ind)))
            if len(result) >= n:
                break
        return result

    def get_symbols_for_strategy(self, strategy_id: str, symbols: List[str]) -> List[Tuple[str, pd.DataFrame]]:
        """Get specific symbols for a specific strategy."""
        cache = self._multi_cache.get(strategy_id, {})
        result = []
        for sym in symbols:
            sym_upper = sym.upper()
            ind = cache.get(sym_upper)
            if ind is not None:
                result.append((sym_upper, self._merged(sym_upper, ind)))
        return result
