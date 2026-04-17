"""
PRUVIQ Signal Scanner — Real-time strategy signal detection.

Scans top coins with all verified strategies, caches results.
Used by /signals/live API endpoint.
"""

import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

import pandas as pd

from api.data_manager import DataManager
from src.strategies.registry import STRATEGY_REGISTRY, get_strategy

logger = logging.getLogger("pruviq")


def _allowed_statuses() -> set[str]:
    """SIGNAL_SCANNER_STATUSES env = comma-separated list.

    Defaults to {'verified','research'} for backcompat. On DO set to
    'verified' only — halves the scan cost without affecting live users who
    care about proven strategies."""
    raw = os.environ.get("SIGNAL_SCANNER_STATUSES", "verified,research")
    statuses = {s.strip().lower() for s in raw.split(",") if s.strip()}
    return statuses or {"verified", "research"}


class SignalScanner:
    """Scans for live trading signals across strategies and coins."""

    def __init__(self, data_manager: DataManager, top_n: int = 30):
        self.dm = data_manager
        self.top_n = top_n
        self._cache: List[dict] = []
        self._cache_ts: float = 0
        self._cache_ttl: float = 300  # 5 minutes
        self._history: List[dict] = []  # last 24h signals
        self._history_max: int = 500
        # Single-flight lock: a cold scan of 572 coins × N strategies takes
        # ~30s and is CPU-bound. Without this, concurrent /signals/live
        # requests + the pre-warm task + the auto-trade loop all ran scan()
        # in parallel on 6+ threads, fighting for the GIL and dragging every
        # request to 60-90s. With the lock, only one scan runs at a time;
        # concurrent callers wait and then hit the cache.
        self._scan_lock = threading.Lock()

    def scan(self, force: bool = False) -> List[dict]:
        """
        Scan all verified strategies on top coins.

        Returns list of active signals:
        [{"strategy": "bb-squeeze-short", "strategy_name": "BB Squeeze SHORT",
          "coin": "BTCUSDT", "direction": "short", "signal_time": "...",
          "status": "verified", "sl_pct": 10, "tp_pct": 8}, ...]
        """
        now = time.time()
        if not force and (now - self._cache_ts) < self._cache_ttl:
            return self._cache

        with self._scan_lock:
            # Re-check cache after acquiring lock — another thread may have
            # finished scanning while we were waiting.
            now = time.time()
            if not force and (now - self._cache_ts) < self._cache_ttl:
                return self._cache
            return self._scan_locked()

    def _scan_locked(self) -> List[dict]:
        """Inner scan body, called with _scan_lock held."""
        scan_started = time.time()
        signals = []
        top_coins = self._get_top_coins()
        allowed = _allowed_statuses()

        for strategy_id, entry in STRATEGY_REGISTRY.items():
            status = entry.get("status", "research")
            if status not in allowed:
                continue

            try:
                kwargs = entry.get("init_kwargs", {})
                strategy = entry["class"](**kwargs)
                direction = entry["direction"]
                defaults = entry["defaults"]
                name = entry["name"]

                for symbol in top_coins:
                    df = self.dm.get_df(symbol)
                    if df is None or len(df) < 100:
                        continue

                    # Compute indicators
                    df_calc = strategy.calculate_indicators(df.copy())
                    if df_calc is None or len(df_calc) < 50:
                        continue

                    # Check signal on the last completed candle
                    # idx = -2 because check_signal needs idx+1 to exist
                    idx = len(df_calc) - 2
                    if idx < 1:
                        continue

                    sig = strategy.check_signal(df_calc, idx)
                    if sig is None:
                        continue

                    # Direction filter
                    if direction == "short" and sig != "short":
                        continue
                    if direction == "long" and sig != "long":
                        continue

                    signal_time = None
                    if "timestamp" in df_calc.columns:
                        ts_val = df_calc.iloc[idx + 1].get("timestamp")
                        if ts_val is not None:
                            if isinstance(ts_val, pd.Timestamp):
                                signal_time = ts_val.isoformat()
                            else:
                                signal_time = str(ts_val)

                    entry_price = float(df_calc.iloc[idx + 1]["open"])

                    signal = {
                        "strategy": strategy_id,
                        "strategy_name": name,
                        "coin": symbol.upper(),
                        "direction": sig,
                        "signal_time": signal_time or datetime.now(timezone.utc).isoformat(),
                        "entry_price": round(entry_price, 6),
                        "status": status,
                        "sl_pct": defaults["sl"],
                        "tp_pct": defaults["tp"],
                    }
                    signals.append(signal)

            except Exception as e:
                logger.warning(f"Signal scan error for {strategy_id}: {e}")
                continue

        # Update cache
        self._cache = signals
        self._cache_ts = scan_started
        logger.info(
            "signal scan complete: %d signals in %.1fs",
            len(signals), time.time() - scan_started,
        )

        # Add to history (dedup by strategy+coin)
        existing_keys = {(s["strategy"], s["coin"]) for s in self._history}
        for sig in signals:
            key = (sig["strategy"], sig["coin"])
            if key not in existing_keys:
                self._history.append(sig)
                existing_keys.add(key)

        # Trim history
        if len(self._history) > self._history_max:
            self._history = self._history[-self._history_max:]

        return signals

    def get_history(self, hours: int = 24) -> List[dict]:
        """Get signal history for the last N hours."""
        cutoff = datetime.now(timezone.utc).timestamp() - (hours * 3600)
        result = []
        for sig in self._history:
            try:
                sig_ts = datetime.fromisoformat(sig["signal_time"].replace("Z", "+00:00"))
                if sig_ts.timestamp() >= cutoff:
                    result.append(sig)
            except Exception:
                result.append(sig)  # Include if can't parse time
        return result

    def _get_top_coins(self) -> List[str]:
        """Get top N coins by market cap (from loaded data)."""
        symbols = list(self.dm._data.keys())
        # Prioritize major coins first
        priority = [
            "btcusdt", "ethusdt", "bnbusdt", "solusdt", "xrpusdt",
            "adausdt", "dotusdt", "linkusdt", "avaxusdt", "ltcusdt",
        ]
        ordered = [s for s in priority if s in symbols]
        remaining = [s for s in symbols if s not in ordered]
        return (ordered + remaining)[:self.top_n]
