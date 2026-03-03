"""
Indicator Cache — Pre-compute indicators at startup for fast simulation.

Supports multi-strategy caching: strategy_id -> symbol -> df.
The primary strategy (bb-squeeze-short) also populates a flat cache for
backwards compatibility with existing endpoints.
"""

import time
from typing import Dict, List, Tuple, Optional

import pandas as pd

from api.data_manager import DataManager


class IndicatorCache:
    """Pre-computed indicators for all coins, keyed by strategy."""

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
        # Multi-strategy cache: strategy_id -> symbol -> df
        self._multi_cache: Dict[str, Dict[str, pd.DataFrame]] = {}
        # Legacy flat cache for bb-squeeze-short (backwards compat)
        self._cache: Dict[str, pd.DataFrame] = {}
        self._build_time = 0.0
        self._primary_strategy = "bb-squeeze-short"

    def build(self, data_manager: DataManager, strategy):
        """Pre-compute indicators for single strategy (backwards compat)."""
        start = time.time()
        self._cache.clear()

        for info in data_manager.coins:
            symbol = info["symbol"]
            df = data_manager.get_df(symbol)
            if df is None:
                continue
            try:
                self._cache[symbol] = strategy.calculate_indicators(df.copy())
            except Exception:
                continue

        # Also store in multi-cache
        self._multi_cache[self._primary_strategy] = self._cache
        self._build_time = time.time() - start

    def build_multi(self, data_manager: DataManager, strategies: Dict[str, object]):
        """Pre-compute indicators for all strategies x all coins."""
        start = time.time()
        self._multi_cache.clear()

        for strategy_id, strategy in strategies.items():
            cache = {}
            for info in data_manager.coins:
                symbol = info["symbol"]
                df = data_manager.get_df(symbol)
                if df is None:
                    continue
                try:
                    cache[symbol] = strategy.calculate_indicators(df.copy())
                except Exception:
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

    # --- Legacy (flat) accessors for bb-squeeze-short ---

    def get(self, symbol: str) -> Optional[pd.DataFrame]:
        return self._cache.get(symbol.upper())

    def get_top_n(self, data_manager: DataManager, n: int) -> List[Tuple[str, pd.DataFrame]]:
        """Get top N coins with pre-computed indicators (primary strategy)."""
        result = []
        for info in data_manager.coins[:n]:
            symbol = info["symbol"]
            df = self._cache.get(symbol)
            if df is not None:
                result.append((symbol, df))
            if len(result) >= n:
                break
        return result

    def get_symbols(self, symbols: List[str]) -> List[Tuple[str, pd.DataFrame]]:
        """Get specific symbols with pre-computed indicators (primary strategy)."""
        result = []
        for sym in symbols:
            sym_upper = sym.upper()
            df = self._cache.get(sym_upper)
            if df is not None:
                result.append((sym_upper, df))
        return result

    # --- Multi-strategy accessors ---

    def get_for_strategy(self, strategy_id: str, symbol: str) -> Optional[pd.DataFrame]:
        """Get cached DataFrame for a specific strategy + symbol."""
        return self._multi_cache.get(strategy_id, {}).get(symbol.upper())

    def get_top_n_for_strategy(self, strategy_id: str, data_manager: DataManager, n: int) -> List[Tuple[str, pd.DataFrame]]:
        """Get top N coins for a specific strategy."""
        cache = self._multi_cache.get(strategy_id, {})
        result = []
        for info in data_manager.coins[:n]:
            symbol = info["symbol"]
            df = cache.get(symbol)
            if df is not None:
                result.append((symbol, df))
            if len(result) >= n:
                break
        return result

    def get_symbols_for_strategy(self, strategy_id: str, symbols: List[str]) -> List[Tuple[str, pd.DataFrame]]:
        """Get specific symbols for a specific strategy."""
        cache = self._multi_cache.get(strategy_id, {})
        result = []
        for sym in symbols:
            sym_upper = sym.upper()
            df = cache.get(sym_upper)
            if df is not None:
                result.append((sym_upper, df))
        return result
