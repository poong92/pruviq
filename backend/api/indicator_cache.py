"""
Indicator Cache — Pre-compute indicators at startup for fast simulation.

The BB Squeeze indicator calculation is the bottleneck (~95% of simulation time).
Pre-computing for all coins reduces repeat simulation from 33s → ~3s.
"""

import time
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import pandas as pd

from api.data_manager import DataManager


class IndicatorCache:
    """Pre-computed indicators for all coins."""

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
        self._cache: Dict[str, pd.DataFrame] = {}  # symbol -> df with indicators
        self._build_time = 0.0

    def build(self, data_manager: DataManager, strategy):
        """Pre-compute indicators for all loaded coins."""
        start = time.time()
        self._cache.clear()

        for info in data_manager.coins:
            symbol = info["symbol"]
            df = data_manager.get_df(symbol)
            if df is None:
                continue

            try:
                df_with_indicators = strategy.calculate_indicators(df.copy())
                self._cache[symbol] = df_with_indicators
            except Exception:
                continue

        self._build_time = time.time() - start

    @property
    def count(self) -> int:
        return len(self._cache)

    def get(self, symbol: str) -> Optional[pd.DataFrame]:
        return self._cache.get(symbol.upper())

    def get_top_n(self, data_manager: DataManager, n: int) -> List[Tuple[str, pd.DataFrame]]:
        """Get top N coins with pre-computed indicators."""
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
        """Get specific symbols with pre-computed indicators."""
        result = []
        for sym in symbols:
            sym_upper = sym.upper()
            df = self._cache.get(sym_upper)
            if df is not None:
                result.append((sym_upper, df))
        return result
