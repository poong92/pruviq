"""
Indicator Cache — Pre-compute indicators at startup for fast simulation.

Supports multi-strategy caching: strategy_id -> symbol -> indicator-only df.
OHLCV columns are NOT duplicated per strategy — shared from DataManager.
Accessors merge OHLCV + indicators on read (zero-copy concat).

Memory optimization (2026-03-22): 16 strategies x 569 coins was 13GB.
Now stores only indicator columns per strategy (~2.5GB, 77% reduction).
"""

import logging
import time
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

    def build_multi(self, data_manager: DataManager, strategies: Dict[str, object]):
        """Pre-compute indicators for all strategies x all coins."""
        start = time.time()
        self._multi_cache.clear()
        self._data_manager = data_manager

        for strategy_id, strategy in strategies.items():
            cache = {}
            for info in data_manager.coins:
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
