"""
PRUVIQ Indicator Pre-Builder — runs as a standalone script (systemd timer).

Computes indicators for all strategies × top MAX_COINS coins and writes a
pre-built cache to disk. The API loads this file at startup instead of
computing in-process, eliminating GIL starvation during the asyncio event loop.

Root cause fixed: asyncio.to_thread(_build) ran numpy/pandas in a thread that
shared the GIL with the event loop → /health probes timed out → watchdog
restarted. Running computation here (separate process, own GIL) removes that
contention entirely.

Usage:
    python3 -m api.offline_indicator_build
    (or via systemd pruviq-indicator-builder.timer)
"""
import json
import logging
import os
import pickle
import sys
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("indicator-builder")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.data_manager import DataManager
from api.indicator_cache import _strip_ohlcv
from src.strategies.registry import get_cacheable_strategies

DATA_DIR = Path(os.environ.get(
    "PRUVIQ_DATA_DIR",
    str(PROJECT_ROOT / "backend" / "data" / "futures"),
))
CACHE_PATH = Path(os.environ.get(
    "PRUVIQ_INDICATOR_CACHE_PATH",
    "/opt/pruviq/cache/indicators.pkl",
))
MAX_COINS = int(os.environ.get("INDICATOR_BUILDER_MAX_COINS", "50"))


def _load_market_cap_ranks() -> dict:
    """Read market cap ranks from coins-stats.json (same source as API)."""
    cg_path = PROJECT_ROOT / "public" / "data" / "coins-stats.json"
    if not cg_path.exists():
        return {}
    try:
        with open(cg_path) as f:
            raw = json.load(f)
        return {
            coin["symbol"].upper(): coin["market_cap_rank"]
            for coin in raw.get("coins", [])
            if coin.get("symbol") and coin.get("market_cap_rank")
        }
    except Exception as e:
        logger.warning(f"Market cap ranks unavailable: {e}")
        return {}


def main() -> None:
    logger.info(f"DATA_DIR={DATA_DIR}  CACHE_PATH={CACHE_PATH}  MAX_COINS={MAX_COINS}")

    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    dm = DataManager()
    dm.load(DATA_DIR)
    logger.info(f"Loaded {dm.coin_count} coins in {time.time() - t0:.1f}s")

    if dm.coin_count == 0:
        logger.error(f"No coins loaded from {DATA_DIR} — aborting")
        sys.exit(1)

    mc_ranks = _load_market_cap_ranks()
    if mc_ranks:
        dm.sort_by_market_cap(mc_ranks)
        top3 = [c["symbol"] for c in dm.coins[:3]]
        logger.info(f"Sorted by market cap. Top 3: {top3}")
    else:
        logger.warning("Market cap ranks unavailable — falling back to data-size order")

    strategies = get_cacheable_strategies()
    coins_to_cache = dm.coins[:MAX_COINS]
    logger.info(f"Building {len(strategies)} cacheable strategies × {len(coins_to_cache)} coins (killed/shelved/testing skipped)")

    multi_cache: dict = {}
    t_build = time.time()
    for sid, strategy in strategies.items():
        cache: dict = {}
        for coin_info in coins_to_cache:
            sym = coin_info["symbol"]
            df = dm.get_df(sym)
            if df is None:
                continue
            try:
                full_df = strategy.calculate_indicators(df.copy())
                cache[sym] = _strip_ohlcv(full_df)
            except Exception as e:
                logger.warning(f"  {sid}/{sym}: {type(e).__name__}: {e}")
                continue
        multi_cache[sid] = cache
        logger.info(f"  {sid}: {len(cache)} coins")

    build_sec = time.time() - t_build
    logger.info(f"Build complete in {build_sec:.1f}s")

    payload = {
        "multi_cache": multi_cache,
        "built_at": time.time(),
        "coin_count": dm.coin_count,
        "strategy_count": len(strategies),
        "max_coins": MAX_COINS,
    }

    tmp = CACHE_PATH.with_suffix(".pkl.tmp")
    with open(tmp, "wb") as f:
        pickle.dump(payload, f, protocol=4)
    tmp.rename(CACHE_PATH)

    size_mb = CACHE_PATH.stat().st_size / 1e6
    logger.info(f"Cache written: {CACHE_PATH} ({size_mb:.1f}MB)")


if __name__ == "__main__":
    main()
