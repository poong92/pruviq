"""
PRUVIQ Simulation API v0.1

FastAPI server for running strategy simulations on-demand.
Designed for Mac Mini deployment with Cloudflare Tunnel.

Usage:
    uvicorn backend.api.main:app --host 0.0.0.0 --port 8080 --workers 1
    NOTE: Must use --workers 1 (background tasks use in-process global cache)
"""

import os
import sys
import time
import hashlib
import hmac
import json
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional, Dict, List
from collections import OrderedDict
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, Response

_admin_key_raw = os.environ.get("ADMIN_API_KEY", "")
ADMIN_API_KEY: Optional[str] = _admin_key_raw if len(_admin_key_raw) >= 32 else None
COINGECKO_API_KEY = os.environ.get("COINGECKO_API_KEY", "")
CG_HEADERS = {"x-cg-demo-api-key": COINGECKO_API_KEY} if COINGECKO_API_KEY else {}

import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("pruviq")

if ADMIN_API_KEY is None:
    logger.warning("ADMIN_API_KEY too short or missing — /admin/refresh disabled")

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.schemas import (
    SimulationRequest, SimulationResponse, EquityPoint, CoinResult,
    CoinInfo, StrategyInfo, HealthResponse,
    OhlcvBar, OhlcvResponse,
    CoinSimRequest, CoinSimResponse, TradeDetail,
    CoinStats, CoinStatsResponse,
    MarketOverview, MarketMover, FundingRate,
    NewsItem, NewsResponse,
    CompareRequest, CompareResponse, StrategyResult,
    MacroIndicator, DerivativesData, EconomicEvent, MacroResponse,
    ValidateRequest, ValidateResponse, OOSResult, OOSPeriodMetrics,
    MonteCarloResult, MCEquityBand,
    TradeItem,
    SubscribeRequest,
    VALID_TIMEFRAMES,
)
from api.data_manager import DataManager
from api.signal_scanner import SignalScanner
from api.indicator_cache import IndicatorCache
from src.simulation.engine import CostModel
from src.simulation.engine_fast import run_fast
from src.simulation.monte_carlo import bootstrap_trades, compute_oos_metrics
from src.strategies.bb_squeeze import BBSqueezeStrategy
from src.strategies.registry import STRATEGY_REGISTRY, get_strategy, get_all_strategies

# Config
VERSION = "0.3.0"
DATA_DIR = Path(os.getenv(
    "PRUVIQ_DATA_DIR",
    str(Path(__file__).resolve().parent.parent / "data" / "futures")
))
MAX_CACHE_SIZE = 500
RATE_LIMIT_PER_MIN = 30
AVOID_HOURS = [2, 3, 10, 20, 21, 22, 23]

# Globals
start_time = time.time()
data_manager = DataManager()
indicator_cache = IndicatorCache()
sim_cache: OrderedDict = OrderedDict()
rate_limits: Dict[str, list] = {}
coin_stats_cache: Optional[dict] = None
_indicator_build_ready = False  # Set True after deferred indicator build completes
_cg_metadata: Dict[str, dict] = {}
_cg_ts: float = 0.0

# Signal scanner (lazy init after data loads)
_signal_scanner = None


REFRESH_INTERVAL = 3600  # seconds (1 hour)

def _refresh_data():
    """Refresh CSV data from Binance, rebuild caches."""
    try:
        from scripts.update_ohlcv import update_symbol, SKIP
        files = sorted(DATA_DIR.glob("*_1h.csv"))
        if not files and (DATA_DIR / "futures").is_dir():
            files = sorted((DATA_DIR / "futures").glob("*_1h.csv"))
        updated = 0
        for f in files:
            stem = f.stem.replace("_1h", "")
            if stem in SKIP:
                continue
            try:
                n = update_symbol(f, stem.upper())
                if n > 0:
                    updated += 1
                time.sleep(0.05)
            except Exception:
                continue

        if updated > 0:
            logger.info(f"Updated {updated} symbols from Binance, reloading...")
            data_manager.load(DATA_DIR)
            _load_coingecko_metadata()
            if _cg_metadata:
                mc_ranks = {sym.upper(): info["market_cap_rank"]
                            for sym, info in _cg_metadata.items()
                            if info.get("market_cap_rank")}
                data_manager.sort_by_market_cap(mc_ranks)
            all_strategies = get_all_strategies()
            indicator_cache.build_multi(data_manager, all_strategies)
            strategy = BBSqueezeStrategy(avoid_hours=AVOID_HOURS)
            global coin_stats_cache
            coin_stats_cache = _build_coin_stats(strategy)
            sim_cache.clear()
            logger.info(f"Reload complete: {indicator_cache.count} coins, cache cleared")
        else:
            logger.info("No new data from Binance")
    except Exception as e:
        logger.error(f"Data refresh failed: {e}")


async def _okx_auto_trading_loop():
    """Check signals and auto-execute for subscribed users every 5 minutes."""
    await asyncio.sleep(30)  # Wait for data load
    while True:
        try:
            from okx.auto_executor import process_signals
            if _signal_scanner is not None:
                signals = _signal_scanner.scan()
                if signals:
                    await process_signals(signals)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"OKX auto-trading loop error: {e}")
        await asyncio.sleep(300)  # 5 minutes


async def _okx_token_refresh_loop():
    """Refresh all active OKX sessions every 12 hours."""
    await asyncio.sleep(60)  # Wait for startup
    while True:
        try:
            from okx.token_refresh import refresh_all_sessions
            stats = await refresh_all_sessions()
            logger.info(f"OKX token refresh: {stats}")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"OKX token refresh error: {e}")
        await asyncio.sleep(12 * 3600)  # 12 hours


async def _background_refresh():
    """Periodically refresh data from Binance."""
    while True:
        await asyncio.sleep(REFRESH_INTERVAL)
        try:
            await asyncio.to_thread(_refresh_data)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"Binance data refresh failed: {e}")


async def _background_market_refresh():
    """Fetch market data (Binance primary) + news every 5min. Runs independently of user requests."""
    global _market_cache, _news_cache, _market_cache_ts
    consecutive_failures = 0
    while True:
        try:
            data = await asyncio.to_thread(_build_market_overview)
            async with _market_cache_lock:
                _market_cache = data
                _market_cache_ts = time.time()
            consecutive_failures = 0
            logger.info("Market data refreshed (Binance primary)")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            consecutive_failures += 1
            cache_age_min = (time.time() - _market_cache_ts) / 60 if _market_cache_ts > 0 else -1
            level = logging.ERROR if consecutive_failures >= 3 else logging.WARNING
            logger.log(level, f"Market refresh failed ({consecutive_failures}x, cache age={cache_age_min:.0f}min): {e}")
        try:
            data = await asyncio.to_thread(_build_news)
            async with _news_cache_lock:
                _news_cache = data
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"News background refresh failed: {e}")
        # Exponential backoff on consecutive failures (cap at 10min)
        backoff = min(MARKET_REFRESH_INTERVAL * (2 ** min(consecutive_failures, 3)), 600)
        sleep_time = backoff if consecutive_failures > 0 else MARKET_REFRESH_INTERVAL
        await asyncio.sleep(sleep_time)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load data and pre-compute indicators on startup."""
    print(f"Loading data from {DATA_DIR} (resolved: {DATA_DIR.resolve()})...")
    data_manager.load(DATA_DIR)
    print(f"Loaded {data_manager.coin_count} coins in {data_manager._load_time:.1f}s")
    if data_manager.coin_count == 0:
        print(f"WARNING: 0 coins loaded! Check PRUVIQ_DATA_DIR={DATA_DIR}, files: {list(DATA_DIR.glob('*_1h.csv'))[:3]}")

    # Sort coins by CoinGecko market cap rank so top_n=50 means market cap Top 50
    _load_coingecko_metadata()
    if _cg_metadata:
        mc_ranks = {sym.upper(): info["market_cap_rank"]
                    for sym, info in _cg_metadata.items()
                    if info.get("market_cap_rank")}
        data_manager.sort_by_market_cap(mc_ranks)
        top5 = [c["symbol"] for c in data_manager.coins[:5]]
        print(f"Coins sorted by market cap rank. Top 5: {top5}")
    else:
        print("WARNING: CoinGecko metadata unavailable — coin order falls back to data size")

    # Indicator cache + coin stats: build in background to avoid startup timeout
    # HealthCheck fails if startup takes > 90s (LaunchAgent restart loop)
    async def _deferred_indicator_build():
        """Build indicator cache after server is already accepting requests."""
        await asyncio.sleep(1)  # Let server start first
        if data_manager.coin_count > 0:
            def _build():
                print("Pre-computing indicators for all strategies...")
                all_strategies = get_all_strategies()
                indicator_cache.build_multi(data_manager, all_strategies)
                for sid in all_strategies:
                    cnt = indicator_cache.strategy_count(sid)
                    print(f"  {sid}: {cnt} coins cached")
                print(f"Total build time: {indicator_cache._build_time:.1f}s")

                print("Pre-computing coin stats...")
                strategy = BBSqueezeStrategy(avoid_hours=AVOID_HOURS)
                global coin_stats_cache
                coin_stats_cache = _build_coin_stats(strategy)
                print(f"Coin stats cached for {len(coin_stats_cache['coins'])} coins")
                global _indicator_build_ready
                _indicator_build_ready = True
            await asyncio.to_thread(_build)

    indicator_task = asyncio.create_task(_deferred_indicator_build())

    # Pre-fetch market data — non-blocking on startup
    print("Deferring indicator build + market pre-fetch to background...")
    global _market_cache, _news_cache, _market_cache_ts
    global _macro_cache, _macro_cache_time

    # Start background refresh tasks
    # IMPORTANT: Deploy with --workers 1 (global cache not shared across processes)
    refresh_task = asyncio.create_task(_background_refresh())
    market_task = asyncio.create_task(_background_market_refresh())
    okx_auto_task = asyncio.create_task(_okx_auto_trading_loop())
    okx_token_task = asyncio.create_task(_okx_token_refresh_loop())
    print(f"Background data refresh scheduled every {REFRESH_INTERVAL}s")
    print(f"Background market refresh scheduled every {MARKET_REFRESH_INTERVAL}s")
    print("OKX auto-trading loop started")

    yield

    indicator_task.cancel()
    refresh_task.cancel()
    market_task.cancel()
    okx_auto_task.cancel()
    okx_token_task.cancel()
    for t in (indicator_task, refresh_task, market_task, okx_auto_task, okx_token_task):
        try:
            await t
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="PRUVIQ Simulation API",
    version=VERSION,
    description="Run crypto strategy simulations with realistic costs.",
    lifespan=lifespan,
)

# OKX Broker router
from okx.router import router as okx_router
app.include_router(okx_router)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pruviq.com",
        "https://www.pruviq.com",
        "http://localhost:4321",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept", "Origin"],
)


# --- Rate Limiting ---

TRUSTED_PROXIES = {"127.0.0.1", "::1"}


def get_client_ip(request: Request) -> str:
    """Extract real client IP, only trusting proxy headers from trusted sources."""
    direct_ip = request.client.host if request.client else "unknown"

    if direct_ip not in TRUSTED_PROXIES:
        return direct_ip

    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    return direct_ip


_last_rate_limit_cleanup = 0.0

def check_rate_limit(client_ip: str) -> bool:
    """Simple in-memory rate limiter with periodic cleanup."""
    global _last_rate_limit_cleanup
    now = time.time()

    if now - _last_rate_limit_cleanup > 60:
        _last_rate_limit_cleanup = now
        stale = [ip for ip, ts in rate_limits.items() if not ts or now - ts[-1] > 120]
        for ip in stale:
            del rate_limits[ip]

    if client_ip not in rate_limits:
        rate_limits[client_ip] = []

    rate_limits[client_ip] = [t for t in rate_limits[client_ip] if now - t < 60]

    if len(rate_limits[client_ip]) >= RATE_LIMIT_PER_MIN:
        return False

    rate_limits[client_ip].append(now)
    return True


_CACHEABLE_PREFIXES = ("/health", "/coins", "/strategies", "/ohlcv/", "/market", "/stats")

@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    if request.method == "GET" and any(request.url.path.startswith(p) for p in _CACHEABLE_PREFIXES):
        response.headers["Cache-Control"] = "public, max-age=60, s-maxage=60"
    else:
        response.headers["Cache-Control"] = "no-store"
    return response


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path in ("/simulate", "/simulate/coin", "/simulate/compare", "/simulate/validate", "/backtest", "/export/csv"):
        client_ip = get_client_ip(request)
        if not check_rate_limit(client_ip):
            oldest = rate_limits.get(client_ip, [0])[0]
            retry_after = max(1, int(60 - (time.time() - oldest)))
            logger.warning(
                f"Rate limit hit: {client_ip} on {request.url.path} — retry after {retry_after}s"
            )
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded. Retry after {retry_after}s."},
                headers={"Retry-After": str(retry_after)},
            )
    return await call_next(request)


# --- Cache ---

def cache_key(req: SimulationRequest) -> str:
    """Deterministic cache key from request."""
    d = req.model_dump()
    d["symbols"] = sorted(d["symbols"]) if d["symbols"] else None
    raw = json.dumps(d, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def get_cached(key: str) -> Optional[dict]:
    if key in sim_cache:
        sim_cache.move_to_end(key)
        return sim_cache[key]
    return None


def set_cached(key: str, value: dict):
    sim_cache[key] = value
    sim_cache.move_to_end(key)
    while len(sim_cache) > MAX_CACHE_SIZE:
        sim_cache.popitem(last=False)


def backtest_cache_key(req: "BacktestRequest") -> str:
    """Deterministic cache key for /backtest requests."""
    d = req.model_dump()
    d["symbols"] = sorted(d["symbols"]) if d.get("symbols") else None
    raw = json.dumps(d, sort_keys=True, default=str)
    return "bt_" + hashlib.md5(raw.encode()).hexdigest()


# --- Helpers ---

def _safe_float(v, default: float = 0.0) -> float:
    """Convert value to float, returning default for None/NaN/inf."""
    if v is None:
        return default
    try:
        f = float(v)
        if np.isnan(f) or np.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default


def downsample_equity(times: list, values: list, n_points: int = 500) -> List[EquityPoint]:
    """Downsample equity curve to n_points."""
    if not values:
        return []

    date_values = {}
    for t, v in zip(times, values):
        date_values[t] = v

    unique_dates = sorted(date_values.keys())
    unique_vals = [date_values[d] for d in unique_dates]

    if len(unique_vals) <= n_points:
        return [EquityPoint(time=d, value=round(v, 2))
                for d, v in zip(unique_dates, unique_vals)]

    indices = sorted(set(np.linspace(0, len(unique_vals) - 1, n_points, dtype=int)))
    return [EquityPoint(time=unique_dates[i], value=round(unique_vals[i], 2))
            for i in indices]


# --- Endpoints ---

# --- Date Range Filter ---

def filter_df_by_date(df: pd.DataFrame, start_date=None, end_date=None) -> pd.DataFrame:
    """Filter DataFrame by date range. No-op if dates are None."""
    if not start_date and not end_date:
        return df
    if "timestamp" not in df.columns:
        return df
    ts = pd.to_datetime(df["timestamp"])
    mask = pd.Series(True, index=df.index)
    if start_date:
        try:
            mask &= ts >= pd.Timestamp(start_date)
        except ValueError:
            raise HTTPException(400, f"Invalid start_date '{start_date}'. Use YYYY-MM-DD format.")
    if end_date:
        try:
            # Include all 1H candles on end_date (up to and including 23:00) but
            # exclude the midnight candle of the next day (off-by-one fix).
            mask &= ts <= pd.Timestamp(end_date) + pd.Timedelta(hours=23)
        except ValueError:
            raise HTTPException(400, f"Invalid end_date '{end_date}'. Use YYYY-MM-DD format.")
    filtered = df[mask].copy()
    if len(filtered) < 100:
        logger.warning(
            f"Date filter {start_date}~{end_date} yielded only {len(filtered)} rows "
            f"(minimum 100). Returning filtered data despite low row count."
        )
    return filtered


def _validate_timeframe(timeframe: str) -> str:
    """Validate and normalize timeframe string. Returns validated timeframe or raises HTTPException."""
    tf = timeframe.upper()
    if tf not in VALID_TIMEFRAMES:
        raise HTTPException(400, f"Invalid timeframe: {timeframe}. Valid: {', '.join(VALID_TIMEFRAMES)}")
    return tf


def _is_resampled(timeframe: str) -> bool:
    """Return True if timeframe requires resampling (anything other than 1H)."""
    return timeframe != "1H"


def _resolve_top_n(top_n: Optional[int], default: int = 50) -> int:
    """Resolve top_n: None defaults to 50 coins to prevent timeout."""
    return top_n if top_n is not None else default


def _get_resampled_coins(
    symbols: Optional[List[str]],
    top_n: Optional[int],
    timeframe: str,
) -> List[tuple]:
    """Get coin DataFrames resampled to the requested timeframe.

    Returns list of (symbol, df) tuples with raw resampled OHLCV data (no indicators).
    """
    if symbols:
        pairs = []
        for sym in symbols:
            df = data_manager.get_resampled(sym.upper(), timeframe)
            if df is not None:
                pairs.append((sym.upper(), df))
        return pairs
    else:
        n = _resolve_top_n(top_n)
        result = []
        for info in data_manager.coins:
            if len(result) >= n:
                break
            symbol = info["symbol"]
            df = data_manager.get_resampled(symbol, timeframe)
            if df is not None:
                result.append((symbol, df))
        return result


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version=VERSION,
        coins_loaded=data_manager.coin_count,
        uptime_seconds=round(time.time() - start_time, 1),
    )


@app.get("/coins", response_model=List[CoinInfo])
async def list_coins():
    return [CoinInfo(**c) for c in data_manager.coins]


@app.get("/strategies", response_model=List[StrategyInfo])
async def list_strategies():
    result = []
    for sid, entry in STRATEGY_REGISTRY.items():
        instance, direction, defaults = get_strategy(sid)
        result.append(StrategyInfo(
            id=sid,
            name=entry["name"],
            description=entry["description"],
            default_params={
                "sl_pct": float(defaults["sl"]),
                "tp_pct": float(defaults["tp"]),
                "max_bars": 48,
                "direction": direction,
                "status": entry["status"],
            },
        ))
    return result


@app.get("/indicators")
async def list_indicators_flat():
    """Return the full INDICATOR_REGISTRY for frontend field discovery."""
    return INDICATOR_REGISTRY


@app.get("/signals/live")
async def signals_live(top_n: int = 30):
    """Return currently active trading signals.

    Scans verified strategies on top coins, returns active signals.
    Cached for 5 minutes.

    Response: [{"strategy": "bb-squeeze-short", "strategy_name": "BB Squeeze SHORT",
                "coin": "BTCUSDT", "direction": "short", "signal_time": "...",
                "entry_price": 87000.0, "status": "verified",
                "sl_pct": 10, "tp_pct": 8}, ...]
    """
    import asyncio

    global _signal_scanner
    if _signal_scanner is None:
        _signal_scanner = SignalScanner(data_manager, top_n=min(top_n, 50))

    def _scan():
        return _signal_scanner.scan()

    signals = await asyncio.to_thread(_scan)
    return signals


@app.get("/signals/history")
async def signals_history(hours: int = 24):
    """Return signal history for the last N hours (max 72)."""
    global _signal_scanner
    if _signal_scanner is None:
        _signal_scanner = SignalScanner(data_manager)

    return _signal_scanner.get_history(min(hours, 72))


@app.get("/hot-strategies")
async def hot_strategies():
    """Return top-performing strategies in the last 30 days.

    Runs lightweight simulation on BTC with each verified strategy,
    returns sorted by recent PF. Used for "Hot Now" banner on frontend.
    Cached for 1 hour.
    """
    import asyncio

    cache_key = "_hot_strategies"
    cached = get_cached(cache_key)
    if cached:
        return cached

    def _compute():
        from datetime import datetime as _dt, timedelta as _td
        start_date = (_dt.now() - _td(days=30)).strftime("%Y-%m-%d")
        results = []

        for sid, entry in STRATEGY_REGISTRY.items():
            if entry.get("status") not in ("verified", "research"):
                continue

            strategy, default_dir, defaults = get_strategy(sid)
            for direction in [default_dir, "short"] if default_dir != "short" else ["short"]:
                try:
                    # BTC only for speed
                    coins = indicator_cache.get_symbols_for_strategy(
                        sid, ["BTCUSDT"]
                    ) if indicator_cache.strategy_count(sid) > 0 else data_manager.get_symbols(["BTCUSDT"])

                    if not coins:
                        continue

                    all_pnls = []
                    for sym, df in coins:
                        if indicator_cache.strategy_count(sid) == 0:
                            df = strategy.calculate_indicators(df.copy())
                        df = filter_df_by_date(df, start_date, None)
                        if len(df) < 50:
                            continue

                        result = run_fast(
                            df, strategy, sym,
                            sl_pct=float(defaults["sl"]) / 100,
                            tp_pct=float(defaults["tp"]) / 100,
                            max_bars=48,
                            fee_pct=0.0008,
                            slippage_pct=0.0002,
                            direction=direction,
                            market_type="futures",
                            strategy_id=sid,
                            funding_rate_8h=0.0001,
                        )
                        for t in result.trades:
                            all_pnls.append(t.pnl_pct)

                    if len(all_pnls) >= 3:
                        wins = [p for p in all_pnls if p > 0]
                        losses = [p for p in all_pnls if p <= 0]
                        tw = sum(wins) if wins else 0
                        tl = abs(sum(losses)) if losses else 0.001
                        pf = round(tw / tl, 2)
                        wr = round(len(wins) / len(all_pnls) * 100, 1)

                        results.append({
                            "strategy_id": sid,
                            "strategy_name": entry["name"],
                            "direction": direction,
                            "status": entry.get("status", "research"),
                            "period": "30d",
                            "profit_factor": pf,
                            "win_rate": wr,
                            "total_trades": len(all_pnls),
                            "total_return_pct": round(sum(all_pnls), 1),
                        })
                except Exception:
                    continue

        results.sort(key=lambda x: x["profit_factor"], reverse=True)
        return {"strategies": results[:10], "updated_at": _dt.now().isoformat()}

    result = await asyncio.to_thread(_compute)
    set_cached(cache_key, result)  # cached until evicted by LRU
    return result


@app.post("/simulate", response_model=SimulationResponse)
async def simulate(req: SimulationRequest):
    """Run a strategy simulation with pre-computed indicators."""

    if data_manager.coin_count == 0:
        raise HTTPException(503, "Data not loaded yet. Try again shortly.")

    # Validate timeframe
    timeframe = _validate_timeframe(getattr(req, 'timeframe', '1H') or '1H')
    resampled = _is_resampled(timeframe)

    # Normalize direction to lowercase (API accepts SHORT/short/Short)
    if req.direction:
        req.direction = req.direction.lower()

    # Resolve strategy from registry
    # Support both "bb-squeeze" (legacy) and "bb-squeeze-short" (new) formats
    strategy_id = req.strategy
    is_both = req.direction == "both"

    if strategy_id == "bb-squeeze":
        strategy_id = f"bb-squeeze-{req.direction or 'short'}" if not is_both else "bb-squeeze-short"

    if strategy_id not in STRATEGY_REGISTRY:
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")

    strategy, default_direction, defaults = get_strategy(strategy_id)

    # Override avoid_hours/avoid_months/min_vol_regime from request if provided
    if req.avoid_hours is not None:
        strategy.avoid_hours = req.avoid_hours
    if getattr(req, 'avoid_months', None) is not None:
        strategy.avoid_months = req.avoid_months
    if getattr(req, 'min_vol_regime', None) is not None:
        strategy.min_vol_regime = req.min_vol_regime

    if is_both:
        directions_to_run = ["short", "long"]
        direction = "both"
    else:
        direction = req.direction if req.direction is not None else default_direction
        directions_to_run = [direction]

    # Check cache
    ckey = cache_key(req)
    cached = get_cached(ckey)
    if cached:
        return SimulationResponse(**cached)

    # Get coin data — use indicator cache for 1H, resample + compute for other timeframes
    if resampled:
        coins = _get_resampled_coins(req.symbols, req.top_n, timeframe)
        if req.symbols and not coins:
            raise HTTPException(404, "None of the requested symbols found.")
        has_cache = False  # Resampled data always needs fresh indicator computation
    else:
        has_cache = indicator_cache.strategy_count(strategy_id) > 0
        if req.symbols:
            # Strip blanks and normalise to uppercase before lookup
            requested = [s.strip().upper() for s in req.symbols if s and s.strip()]
            if not requested:
                raise HTTPException(400, "No valid symbols provided. symbols list is empty or contains only blank values.")

            if has_cache:
                coins = indicator_cache.get_symbols_for_strategy(strategy_id, requested)
                # Fallback: coins not in top-50 cache → compute on-the-fly
                cached_syms = {sym for sym, _ in coins}
                missing = [s for s in requested if s not in cached_syms]
                if missing:
                    coins.extend(data_manager.get_symbols(missing))
            else:
                coins = data_manager.get_symbols(requested)

            if not coins:
                if len(requested) == 1:
                    raise HTTPException(404, f"Symbol {requested[0]} not found in available coins. Check the symbol spelling (e.g. BTCUSDT, ETHUSDT).")
                raise HTTPException(404, f"None of the requested symbols were found: {', '.join(requested)}. Check symbol spelling (e.g. BTCUSDT).")
        else:
            n = _resolve_top_n(req.top_n)
            coins = indicator_cache.get_top_n_for_strategy(strategy_id, data_manager, n) if has_cache else data_manager.get_top_n(n)

    cost_model = CostModel.futures() if req.market_type == "futures" else CostModel.spot()

    # Run simulation across all coins (supports "both" direction)
    all_trades = []
    coin_results = []
    coin_agg = {}  # For "both": aggregate per-coin across directions
    actual_date_min = None
    actual_date_max = None

    # Track which symbols came from cache (have indicators) vs fallback (need computation)
    _cached_syms = set()
    if has_cache:
        _cached_syms = {sym for sym, _ in indicator_cache.get_symbols_for_strategy(strategy_id, [s for s, _ in coins])}

    for run_dir in directions_to_run:
        for sym, df in coins:
            if sym not in _cached_syms:
                df = strategy.calculate_indicators(df.copy())

            df = filter_df_by_date(df, getattr(req, 'start_date', None), getattr(req, 'end_date', None))

            # Track actual date range
            if "timestamp" in df.columns and len(df) > 0:
                df_min = str(df["timestamp"].iloc[0])[:10]
                df_max = str(df["timestamp"].iloc[-1])[:10]
                if actual_date_min is None or df_min < actual_date_min:
                    actual_date_min = df_min
                if actual_date_max is None or df_max > actual_date_max:
                    actual_date_max = df_max

            dyn_slip = _get_dynamic_slippage(sym)
            result = run_fast(
                df, strategy, sym,
                sl_pct=req.sl_pct / 100,
                tp_pct=req.tp_pct / 100,
                max_bars=req.max_bars,
                fee_pct=cost_model.fee_pct,
                slippage_pct=dyn_slip,
                direction=run_dir,
                market_type=req.market_type,
                strategy_id=strategy_id,
                funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
                timeframe=timeframe,
            )

            # Collect per-coin stats
            if result.total_trades > 0:
                if is_both:
                    # Aggregate same coin across short/long
                    if sym not in coin_agg:
                        coin_agg[sym] = {"trades": 0, "wins": 0, "losses": 0,
                                         "total_return_pct": 0, "tp": 0, "sl": 0, "timeout": 0}
                    c = coin_agg[sym]
                    c["trades"] += result.total_trades
                    c["wins"] += result.wins
                    c["losses"] += result.losses
                    c["total_return_pct"] += _safe_float(result.total_return_pct)
                    c["tp"] += result.tp_count
                    c["sl"] += result.sl_count
                    c["timeout"] += result.timeout_count
                else:
                    coin_results.append(CoinResult(
                        symbol=sym,
                        trades=result.total_trades,
                        wins=result.wins,
                        losses=result.losses,
                        win_rate=_safe_float(result.win_rate),
                        profit_factor=_safe_float(result.profit_factor),
                        total_return_pct=_safe_float(result.total_return_pct),
                        avg_pnl_pct=round(_safe_float(result.total_return_pct) / result.total_trades, 4) if result.total_trades > 0 else 0,
                        tp_count=result.tp_count,
                        sl_count=result.sl_count,
                        timeout_count=result.timeout_count,
                    ))

            for trade in result.trades:
                all_trades.append({
                    "time": trade.entry_time,
                    "exit_time": trade.exit_time,
                    "pnl_pct": trade.pnl_pct,
                    "exit_reason": trade.exit_reason,
                    "funding_pct": getattr(trade, 'funding_pct', 0),
                })

    # Build coin_results from aggregated data for "both" mode
    if is_both:
        for sym, c in coin_agg.items():
            wr = round(c["wins"] / c["trades"] * 100, 2) if c["trades"] > 0 else 0
            coin_results.append(CoinResult(
                symbol=sym,
                trades=c["trades"],
                wins=c["wins"],
                losses=c["losses"],
                win_rate=wr,
                profit_factor=0,  # Recalculated at portfolio level
                total_return_pct=_safe_float(round(c["total_return_pct"], 4)),
                avg_pnl_pct=round(c["total_return_pct"] / c["trades"], 4) if c["trades"] > 0 else 0,
                tp_count=c["tp"],
                sl_count=c["sl"],
                timeout_count=c["timeout"],
            ))

    # Sort coin_results by total_return descending
    coin_results.sort(key=lambda x: x.total_return_pct, reverse=True)

    # Aggregate
    all_trades.sort(key=lambda t: t["time"])

    if not all_trades:
        resp = SimulationResponse(
            strategy=req.strategy, direction=direction,
            params=strategy.get_params(), market_type=req.market_type,
            total_trades=0, wins=0, losses=0, win_rate=0,
            total_return_pct=0, profit_factor=0,
            avg_win_pct=0, avg_loss_pct=0,
            max_drawdown_pct=0, max_consecutive_losses=0,
            total_fees_pct=0, total_funding_pct=0, tp_count=0, sl_count=0, timeout_count=0,
            coins_used=len(coins), data_range=data_manager.data_range(),
            equity_curve=[], coin_results=[],
        )
        set_cached(ckey, resp.model_dump())
        return resp

    wins = [t for t in all_trades if t["pnl_pct"] > 0]
    losses = [t for t in all_trades if t["pnl_pct"] <= 0]
    gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.0
    is_compounding = getattr(req, 'compounding', False)

    # total_return: compound vs simple (normalized by coin count)
    n_coins = len(coins) if coins else 1
    if is_compounding:
        _compound_eq = 100.0
        for _t in all_trades:
            _compound_eq *= (1 + _t["pnl_pct"] / (100 * n_coins))
        total_return = round((_compound_eq / 100.0 - 1) * 100, 4)
    else:
        total_return = round(sum(t["pnl_pct"] for t in all_trades) / n_coins, 4)

    total_fees = len(all_trades) * (cost_model.fee_pct * 2 * 100) / n_coins
    total_funding = sum(t.get('funding_pct', 0) for t in all_trades) / n_coins

    avg_win = (sum(t["pnl_pct"] for t in wins) / len(wins)) if wins else 0
    avg_loss = (sum(t["pnl_pct"] for t in losses) / len(losses)) if losses else 0

    # Equity curve + MDD (100-based for both modes)
    # n_coins defined above — each coin uses 1/N of capital
    equity = 100.0
    peak = equity
    max_dd = 0.0
    eq_times = []
    eq_values = []
    max_consec = 0
    cur_consec = 0

    for t in all_trades:
        if is_compounding:
            equity = max(equity * (1 + t["pnl_pct"] / (100 * n_coins)), 0.0)
        else:
            equity += t["pnl_pct"] / n_coins  # Normalize: each trade uses 1/N of capital
        peak = max(peak, equity)
        dd = (peak - equity) / peak * 100 if peak > 0 else 0.0  # % of peak (not absolute points)
        dd = min(dd, 100.0)  # Cap at 100%
        max_dd = max(max_dd, dd)
        _eq_t = t.get("exit_time", t["time"])[:10]
        eq_times.append(_eq_t if _eq_t and _eq_t != "NaT" else "1970-01-01")
        eq_values.append(equity - 100.0)  # Convert to return % for frontend

        if t["pnl_pct"] <= 0:
            cur_consec += 1
            max_consec = max(max_consec, cur_consec)
        else:
            cur_consec = 0

    tp_count = sum(1 for t in all_trades if t["exit_reason"] == "tp")
    sl_count = sum(1 for t in all_trades if t["exit_reason"] == "sl")
    timeout_count = sum(1 for t in all_trades if t["exit_reason"] == "timeout")

    # Risk-adjusted metrics — daily-return based (annualized sqrt(365))
    from collections import defaultdict as _dd_sim
    daily_pnl_sim = _dd_sim(float)
    for t in all_trades:
        day_key = t.get("exit_time", t["time"])[:10]  # YYYY-MM-DD (exit time)
        if day_key and day_key != "NaT" and len(day_key) == 10:
            daily_pnl_sim[day_key] += t["pnl_pct"]
    # Portfolio daily returns: divide by n_coins (same denominator as total_return).
    # This keeps Sharpe sign consistent with total_return direction.
    # Fill zero-return days so Sharpe isn't inflated by excluding non-trading days.
    if daily_pnl_sim and len(daily_pnl_sim) >= 2:
        from datetime import datetime as _dt_sim, timedelta as _td_sim
        sorted_days = sorted(daily_pnl_sim.keys())
        d_start = _dt_sim.strptime(sorted_days[0], "%Y-%m-%d")
        d_end = _dt_sim.strptime(sorted_days[-1], "%Y-%m-%d")
        all_days = [(d_start + _td_sim(days=i)).strftime("%Y-%m-%d") for i in range((d_end - d_start).days + 1)]
        daily_returns_sim = np.array([
            daily_pnl_sim[d] / n_coins if d in daily_pnl_sim else 0.0
            for d in all_days
        ])
    elif daily_pnl_sim:
        daily_returns_sim = np.array([
            pnl / n_coins
            for pnl in daily_pnl_sim.values()
        ])
    else:
        daily_returns_sim = np.array([])

    if len(daily_returns_sim) >= 5:
        dr_avg = float(np.mean(daily_returns_sim))
        dr_std = float(np.std(daily_returns_sim, ddof=1))
        sharpe = round(dr_avg / dr_std * np.sqrt(365), 2) if dr_std > 0 else 0.0
        # TDD Sortino (Sortino & van der Meer 1991): sqrt(mean(min(r,0)^2)) over ALL N
        downside_sim = np.minimum(daily_returns_sim, 0)
        tdd = float(np.sqrt(np.mean(downside_sim ** 2)))
        sortino = round(dr_avg / tdd * np.sqrt(365), 2) if tdd > 0 else 0.0
        # Calmar: CAGR / MDD (compound annualized growth rate — industry standard)
        # Use calendar days from daily_returns_sim (already zero-filled) for accurate annualization
        n_days_sim = len(daily_returns_sim)
        growth_ratio_sim = equity / 100.0 if equity > 0 else 0.001
        years_sim = max(n_days_sim, 1) / 365
        cagr_pct_sim = (growth_ratio_sim ** (1 / years_sim) - 1) * 100 if years_sim > 0 else 0.0
        calmar = round(cagr_pct_sim / max_dd, 2) if max_dd > 0 else 0.0
    else:
        sharpe, sortino, calmar = 0.0, 0.0, 0.0

    # Use actual date range: actual candle range > requested range > full dataset range
    if actual_date_min and actual_date_max:
        data_range = f"{actual_date_min} ~ {actual_date_max}"
    elif req.start_date or req.end_date:
        # Filtered but no trades found (e.g. future date) — show requested window
        start_label = req.start_date or data_manager.data_range().split(" ~ ")[0]
        end_label = req.end_date or data_manager.data_range().split(" ~ ")[-1]
        data_range = f"{start_label} ~ {end_label} (no data)"
    else:
        data_range = data_manager.data_range()

    # Yearly stats — group trades by exit year
    from collections import defaultdict as _dd_yearly
    _yearly_map = _dd_yearly(lambda: {"trades": 0, "wins": 0, "pnl": 0.0})
    for t in all_trades:
        _yk = t.get("exit_time", t["time"])[:4]
        if _yk and _yk.isdigit():
            _yearly_map[_yk]["trades"] += 1
            _yearly_map[_yk]["pnl"] += t["pnl_pct"] / n_coins
            if t["pnl_pct"] > 0:
                _yearly_map[_yk]["wins"] += 1
    yearly_stats_sim = []
    for yr in sorted(_yearly_map):
        yd = _yearly_map[yr]
        yw = yd["wins"]
        yt = yd["trades"]
        ywr = round(yw / yt * 100, 1) if yt > 0 else 0.0
        ywins_pnl = sum(t["pnl_pct"] / n_coins for t in all_trades if t.get("exit_time", t["time"])[:4] == yr and t["pnl_pct"] > 0)
        yloss_pnl = abs(sum(t["pnl_pct"] / n_coins for t in all_trades if t.get("exit_time", t["time"])[:4] == yr and t["pnl_pct"] <= 0))
        ypf = round(ywins_pnl / yloss_pnl, 2) if yloss_pnl > 0 else (999.99 if ywins_pnl > 0 else 0.0)
        yearly_stats_sim.append({
            "year": int(yr), "trades": yt, "wins": yw,
            "win_rate": ywr, "total_return_pct": round(yd["pnl"], 2), "profit_factor": ypf,
        })

    resp_data = {
        "strategy": req.strategy,
        "direction": direction,
        "params": strategy.get_params(),
        "market_type": req.market_type,
        "total_trades": len(all_trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": _safe_float(round(len(wins) / len(all_trades) * 100, 2)),
        "total_return_pct": _safe_float(round(total_return, 2)),
        "profit_factor": _safe_float(round(gross_profit / gross_loss, 2) if gross_loss > 0 else (999.99 if gross_profit > 0 else 0.0)),
        "avg_win_pct": _safe_float(round(avg_win, 4)),
        "avg_loss_pct": _safe_float(round(avg_loss, 4)),
        "max_drawdown_pct": _safe_float(round(max_dd, 2)),
        "max_consecutive_losses": max_consec,
        "total_fees_pct": _safe_float(round(total_fees, 2)),
        "total_funding_pct": _safe_float(round(total_funding, 2)),
        "tp_count": tp_count,
        "sl_count": sl_count,
        "timeout_count": timeout_count,
        "sharpe_ratio": _safe_float(sharpe),
        "sortino_ratio": _safe_float(sortino),
        "calmar_ratio": _safe_float(calmar),
        "coins_used": len(coins),
        "data_range": data_range,
        "equity_curve": downsample_equity(eq_times, eq_values),
        "coin_results": [cr.model_dump() for cr in coin_results],
        "yearly_stats": yearly_stats_sim,
    }

    set_cached(ckey, resp_data)
    return SimulationResponse(**resp_data)


# --- Coin Explorer Helpers ---

def _ts_to_unix(ts) -> int:
    """Convert pandas Timestamp or string to Unix seconds."""
    if hasattr(ts, 'timestamp'):
        return int(ts.timestamp())
    return int(pd.Timestamp(str(ts)).timestamp())


def _load_coingecko_metadata():
    """Load CoinGecko metadata from static coins-stats.json for enrichment."""
    global _cg_metadata, _cg_ts
    cg_path = Path(__file__).parent.parent.parent / "public" / "data" / "coins-stats.json"
    try:
        if not cg_path.exists():
            logger.warning("CoinGecko metadata file not found")
            return
        mtime = cg_path.stat().st_mtime
        if mtime == _cg_ts:
            return  # no change
        with open(cg_path) as f:
            raw = json.load(f)
        meta = {}
        for coin in raw.get("coins", []):
            sym = coin.get("symbol", "")
            if sym:
                meta[sym] = {
                    "name": coin.get("name"),
                    "image": coin.get("image"),
                    "change_1h": coin.get("change_1h"),
                    "change_7d": coin.get("change_7d"),
                    "market_cap": coin.get("market_cap"),
                    "market_cap_rank": coin.get("market_cap_rank"),
                    "sparkline_7d": coin.get("sparkline_7d"),
                }
        _cg_metadata = meta
        _cg_ts = mtime
        logger.info(f"CoinGecko metadata loaded: {len(meta)} coins")
    except Exception as e:
        logger.warning(f"CoinGecko metadata load failed: {e}")


def _derive_coin_name(symbol: str) -> str:
    """Derive a human-readable name from a futures symbol when CoinGecko metadata is missing.

    Examples: 'BTCUSDT' -> 'BTC', 'ETHUSDT' -> 'ETH', 'SOLUSDT' -> 'SOL'
    Strips common quote suffixes (USDT, BUSD, USDC, USD).
    """
    for suffix in ("USDT", "BUSD", "USDC", "USD"):
        if symbol.upper().endswith(suffix):
            return symbol[: -len(suffix)].upper()
    return symbol.upper()


def _get_dynamic_slippage(symbol: str) -> float:
    """3-tier slippage based on market cap rank from CoinGecko metadata.
    Tier 1 (Top 50):  0.02% — high liquidity
    Tier 2 (Top 200): 0.05% — moderate liquidity
    Tier 3 (Others):  0.10% — low liquidity
    Falls back to 0.05% if metadata unavailable.
    """
    _load_coingecko_metadata()
    sym_key = symbol.replace("USDT", "").upper()
    meta = _cg_metadata.get(sym_key, {})
    rank = meta.get("market_cap_rank")
    if rank is None:
        return 0.0005  # Tier 2 default
    if rank <= 50:
        return 0.0002  # Tier 1
    if rank <= 200:
        return 0.0005  # Tier 2
    return 0.001  # Tier 3


def _build_coin_stats(strategy) -> dict:
    """Pre-compute stats for all coins."""
    cost_model = CostModel.futures()
    coins_list = []

    for info in data_manager.coins:
        symbol = info["symbol"]
        df = indicator_cache.get(symbol)
        if df is None or len(df) < 500:
            continue

        dyn_slip = _get_dynamic_slippage(symbol)
        result = run_fast(
            df, strategy, symbol,
            sl_pct=0.10, tp_pct=0.08, max_bars=48,
            fee_pct=cost_model.fee_pct,
            slippage_pct=dyn_slip,
            direction="short", market_type="futures",
            funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
        )

        # Price & 24h change (compare last close vs 24 bars ago)
        last_close = float(df["close"].iloc[-1])
        close_24h_ago = float(df["close"].iloc[-25]) if len(df) >= 25 else float(df["close"].iloc[0])
        change_24h = round(((last_close - close_24h_ago) / close_24h_ago) * 100, 2) if close_24h_ago else 0
        volume_24h = float(df["volume"].iloc[-24:].sum()) if len(df) >= 24 else float(df["volume"].sum())

        cg = _cg_metadata.get(symbol, {})
        # Fallback: derive name from symbol when CoinGecko metadata is absent
        # so the UI always has at least the base token name (e.g. "SOL" for "SOLUSDT")
        resolved_name = cg.get("name") or _derive_coin_name(symbol)
        coins_list.append(CoinStats(
            symbol=symbol,
            price=round(last_close, 6),
            change_24h=change_24h,
            volume_24h=round(volume_24h, 2),
            trades=result.total_trades,
            win_rate=result.win_rate,
            profit_factor=result.profit_factor,
            total_return_pct=result.total_return_pct,
            name=resolved_name,
            image=cg.get("image") or f"https://ui-avatars.com/api/?name={_derive_coin_name(symbol)}&background=random&size=64",
            change_1h=cg.get("change_1h"),
            change_7d=cg.get("change_7d"),
            market_cap=cg.get("market_cap"),
            market_cap_rank=cg.get("market_cap_rank"),
            sparkline_7d=cg.get("sparkline_7d"),
        ))

    return {
        "generated": datetime.now(timezone.utc).isoformat(),
        "strategy": "bb-squeeze-short",
        "params": {"sl_pct": 10, "tp_pct": 8, "max_bars": 48},
        "coins": coins_list,
    }


# --- Coin Explorer Endpoints ---

@app.get("/ohlcv/{symbol}", response_model=OhlcvResponse)
async def get_ohlcv(symbol: str, limit: int = 1000, offset: int = 0, timeframe: str = "1H"):
    """Get OHLCV + indicator data for a single coin.

    Supports multi-timeframe via the `timeframe` query parameter.
    For non-1H timeframes, data is resampled from 1H and indicators are recomputed.

    Pagination:
    - limit: number of bars to return (default 1000, max 5000, 0 = all)
    - offset: number of bars to skip from the end (0 = most recent)
    """
    symbol = symbol.upper()
    timeframe = _validate_timeframe(timeframe)

    # Cap limit at 5000 to prevent excessive response sizes
    if limit < 0:
        limit = 1000
    elif limit > 5000:
        limit = 5000

    if _is_resampled(timeframe):
        # Resample raw data and compute indicators fresh
        df = data_manager.get_resampled(symbol, timeframe)
        if df is None:
            raise HTTPException(404, f"Symbol not found: {symbol}")
        strategy = BBSqueezeStrategy(avoid_hours=AVOID_HOURS)
        df = strategy.calculate_indicators(df.copy())
    else:
        # Use pre-computed 1H indicator cache
        df = indicator_cache.get(symbol)
        if df is None:
            df = data_manager.get_df(symbol)
            if df is None:
                raise HTTPException(404, f"Symbol not found: {symbol}")

    # Apply pagination: offset from end, then limit
    if offset > 0:
        df = df.iloc[:-offset] if offset < len(df) else df.iloc[:0]
    if limit > 0:
        df = df.tail(limit)

    ts_arr = df["timestamp"].apply(_ts_to_unix).values
    o_arr = np.round(df["open"].values.astype(float), 6)
    h_arr = np.round(df["high"].values.astype(float), 6)
    l_arr = np.round(df["low"].values.astype(float), 6)
    c_arr = np.round(df["close"].values.astype(float), 6)
    v_arr = np.round(df["volume"].values.astype(float), 2)

    has_bb = "bb_upper" in df.columns
    has_ema = "ema_fast" in df.columns
    has_vol = "vol_ratio" in df.columns

    bb_u = df["bb_upper"].values.astype(float) if has_bb else None
    bb_l = df["bb_lower"].values.astype(float) if has_bb else None
    ema_f = df["ema_fast"].values.astype(float) if has_ema else None
    ema_s = df["ema_slow"].values.astype(float) if has_ema else None
    vr = df["vol_ratio"].values.astype(float) if has_vol else None

    bars = []
    for i in range(len(df)):
        bb_upper_v = round(float(bb_u[i]), 6) if has_bb and not np.isnan(bb_u[i]) else None
        bb_lower_v = round(float(bb_l[i]), 6) if has_bb and not np.isnan(bb_l[i]) else None
        bars.append(OhlcvBar(
            t=int(ts_arr[i]),
            o=float(o_arr[i]),
            h=float(h_arr[i]),
            l=float(l_arr[i]),
            c=float(c_arr[i]),
            v=float(v_arr[i]),
            bb_upper=bb_upper_v,
            bb_lower=bb_lower_v,
            bb_mid=round((bb_upper_v + bb_lower_v) / 2, 6) if bb_upper_v is not None and bb_lower_v is not None else None,
            ema20=round(float(ema_f[i]), 6) if has_ema and not np.isnan(ema_f[i]) else None,
            ema50=round(float(ema_s[i]), 6) if has_ema and not np.isnan(ema_s[i]) else None,
            vol_ratio=round(float(vr[i]), 2) if has_vol and not np.isnan(vr[i]) else None,
        ))

    return OhlcvResponse(symbol=symbol, timeframe=timeframe, total_bars=len(bars), data=bars)


@app.post("/simulate/coin", response_model=CoinSimResponse)
async def simulate_coin(req: CoinSimRequest):
    """Simulate a single coin and return individual trade details."""
    symbol = req.symbol.upper()
    if req.direction:
        req.direction = req.direction.lower()
    timeframe = _validate_timeframe(getattr(req, 'timeframe', '1H') or '1H')
    resampled = _is_resampled(timeframe)

    # Use bb-squeeze-short by default for backwards compat
    strategy_id = f"bb-squeeze-{req.direction}"
    if strategy_id not in STRATEGY_REGISTRY:
        strategy_id = "bb-squeeze-short"

    strategy, _, _ = get_strategy(strategy_id)
    cost_model = CostModel.futures() if req.market_type == "futures" else CostModel.spot()

    if resampled:
        # Resample raw data and compute indicators fresh
        df = data_manager.get_resampled(symbol, timeframe)
        if df is None:
            raise HTTPException(404, f"Symbol not found: {symbol}")
        df = strategy.calculate_indicators(df.copy())
    else:
        df = indicator_cache.get_for_strategy(strategy_id, symbol)
        if df is None:
            # Fallback to legacy flat cache
            df = indicator_cache.get(symbol)
        if df is None:
            raise HTTPException(404, f"Symbol not found: {symbol}")

    df = filter_df_by_date(df, getattr(req, 'start_date', None), getattr(req, 'end_date', None))
    dyn_slip = _get_dynamic_slippage(symbol)
    result = run_fast(
        df, strategy, symbol,
        sl_pct=req.sl_pct / 100,
        tp_pct=req.tp_pct / 100,
        max_bars=req.max_bars,
        fee_pct=cost_model.fee_pct,
        slippage_pct=dyn_slip,
        direction=req.direction,
        market_type=req.market_type,
        strategy_id=strategy_id,
        funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
        timeframe=timeframe,
    )

    trades = [
        TradeDetail(
            entry_time=_ts_to_unix(t.entry_time),
            entry_price=round(t.entry_price, 6),
            exit_time=_ts_to_unix(t.exit_time),
            exit_price=round(t.exit_price, 6),
            pnl_pct=t.pnl_pct,
            exit_reason=t.exit_reason,
            bars_held=t.bars_held,
        )
        for t in result.trades
    ]

    return CoinSimResponse(
        symbol=symbol,
        total_trades=result.total_trades,
        win_rate=result.win_rate,
        profit_factor=result.profit_factor,
        total_return_pct=result.total_return_pct,
        max_drawdown_pct=result.max_drawdown_pct,
        tp_count=result.tp_count,
        sl_count=result.sl_count,
        timeout_count=result.timeout_count,
        sharpe_ratio=result.sharpe_ratio,
        sortino_ratio=result.sortino_ratio,
        calmar_ratio=result.calmar_ratio,
        trades=trades,
    )


@app.get("/coins/stats", response_model=CoinStatsResponse)
async def get_coin_stats():
    """Get pre-computed stats for all coins."""
    if coin_stats_cache is None:
        raise HTTPException(503, "Coin stats not computed yet.")
    return CoinStatsResponse(**coin_stats_cache)


def _run_one_compare_strategy(
    strategy_id: str, entry: dict, req: CompareRequest,
    cost_model, n: int,
) -> StrategyResult:
    """Run a single strategy for compare — designed to run in a thread."""
    strategy, direction, _ = get_strategy(strategy_id)
    has_cache = indicator_cache.strategy_count(strategy_id) > 0
    coins = (
        indicator_cache.get_top_n_for_strategy(strategy_id, data_manager, n)
        if has_cache else data_manager.get_top_n(n)
    )

    all_trades = []
    for sym, df in coins:
        if not has_cache:
            df = strategy.calculate_indicators(df.copy())
        df = filter_df_by_date(df, getattr(req, 'start_date', None), getattr(req, 'end_date', None))
        dyn_slip = _get_dynamic_slippage(sym)
        result = run_fast(
            df, strategy, sym,
            sl_pct=req.sl_pct / 100, tp_pct=req.tp_pct / 100,
            max_bars=req.max_bars,
            fee_pct=cost_model.fee_pct, slippage_pct=dyn_slip,
            direction=direction, market_type="futures",
            strategy_id=strategy_id,
            funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
        )
        for trade in result.trades:
            all_trades.append({"time": trade.entry_time, "pnl_pct": trade.pnl_pct, "exit_reason": trade.exit_reason})

    all_trades.sort(key=lambda t: t["time"])

    if not all_trades:
        return StrategyResult(
            strategy_id=strategy_id, name=entry["name"],
            direction=direction, status=entry["status"],
            total_trades=0, wins=0, losses=0, win_rate=0,
            total_return_pct=0, profit_factor=0, max_drawdown_pct=0,
            tp_count=0, sl_count=0, timeout_count=0, equity_curve=[],
        )

    wins = [t for t in all_trades if t["pnl_pct"] > 0]
    losses = [t for t in all_trades if t["pnl_pct"] <= 0]
    gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.0

    n_coins = len(coins) if coins else 1
    equity = 100.0
    peak = 100.0
    max_dd = 0.0
    eq_times = []
    eq_values = []
    for t in all_trades:
        equity += t["pnl_pct"] / n_coins
        peak = max(peak, equity)
        dd_pct = (peak - equity) / peak * 100 if peak > 0 else 0.0  # % of peak (industry standard)
        dd_pct = min(dd_pct, 100.0)  # Cap at 100%
        max_dd = max(max_dd, dd_pct)
        eq_times.append(t["time"][:10])
        eq_values.append(equity - 100.0)  # return % for frontend

    return StrategyResult(
        strategy_id=strategy_id, name=entry["name"],
        direction=direction, status=entry["status"],
        total_trades=len(all_trades), wins=len(wins), losses=len(losses),
        win_rate=round(len(wins) / len(all_trades) * 100, 2),
        total_return_pct=round(sum(t["pnl_pct"] for t in all_trades) / n_coins, 2),
        profit_factor=round(gross_profit / gross_loss, 2) if gross_loss > 0 else (999.99 if gross_profit > 0 else 0.0),
        max_drawdown_pct=round(max_dd, 2),
        tp_count=sum(1 for t in all_trades if t["exit_reason"] == "tp"),
        sl_count=sum(1 for t in all_trades if t["exit_reason"] == "sl"),
        timeout_count=sum(1 for t in all_trades if t["exit_reason"] == "timeout"),
        equity_curve=downsample_equity(eq_times, eq_values),
    )


COMPARE_MAX_COINS = 20  # Cap to prevent CF tunnel timeout (5 strategies × coins)


@app.post("/simulate/compare", response_model=CompareResponse)
async def simulate_compare(req: CompareRequest):
    """Run all strategies under identical SL/TP conditions for comparison."""
    if data_manager.coin_count == 0:
        raise HTTPException(503, "Data not loaded yet. Try again shortly.")

    cost_model = CostModel.futures()
    n = min(_resolve_top_n(req.top_n), COMPARE_MAX_COINS)

    # Run all strategies in parallel threads
    results = await asyncio.gather(*[
        asyncio.to_thread(
            _run_one_compare_strategy, strategy_id, entry, req, cost_model, n
        )
        for strategy_id, entry in STRATEGY_REGISTRY.items()
    ])

    return CompareResponse(
        sl_pct=req.sl_pct,
        tp_pct=req.tp_pct,
        max_bars=req.max_bars,
        coins_used=n,
        data_range=data_manager.data_range(),
        strategies=list(results),
    )


@app.post("/simulate/validate", response_model=ValidateResponse)
async def simulate_validate(req: ValidateRequest):
    """Run OOS validation + Monte Carlo on a strategy."""
    if data_manager.coin_count == 0:
        raise HTTPException(503, "Data not loaded yet. Try again shortly.")

    if req.direction:
        req.direction = req.direction.lower()

    timeframe = _validate_timeframe(getattr(req, 'timeframe', '1H') or '1H')
    resampled = _is_resampled(timeframe)

    strategy_id = req.strategy
    if strategy_id == "bb-squeeze":
        strategy_id = f"bb-squeeze-{req.direction or 'short'}"

    if strategy_id not in STRATEGY_REGISTRY:
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")

    strategy, default_direction, defaults = get_strategy(strategy_id)
    direction = req.direction if req.direction is not None else default_direction

    # Override avoid_hours/avoid_months/min_vol_regime from request if provided
    if getattr(req, 'avoid_hours', None) is not None:
        strategy.avoid_hours = req.avoid_hours
    if getattr(req, 'avoid_months', None) is not None:
        strategy.avoid_months = req.avoid_months
    if getattr(req, 'min_vol_regime', None) is not None:
        strategy.min_vol_regime = req.min_vol_regime

    cost_model = CostModel.futures() if req.market_type == "futures" else CostModel.spot()

    if resampled:
        coins = _get_resampled_coins(req.symbols, req.top_n, timeframe)
        if req.symbols and not coins:
            raise HTTPException(404, "None of the requested symbols found.")
        has_cache = False
    else:
        has_cache = indicator_cache.strategy_count(strategy_id) > 0
        if req.symbols:
            requested = [s.strip().upper() for s in req.symbols if s and s.strip()]
            if not requested:
                raise HTTPException(400, "No valid symbols provided. symbols list is empty or contains only blank values.")

            coins = indicator_cache.get_symbols_for_strategy(strategy_id, requested) if has_cache else data_manager.get_symbols(requested)

            if not coins:
                if len(requested) == 1:
                    raise HTTPException(404, f"Symbol {requested[0]} not found in available coins. Check the symbol spelling (e.g. BTCUSDT, ETHUSDT).")
                raise HTTPException(404, f"None of the requested symbols were found: {', '.join(requested)}. Check symbol spelling (e.g. BTCUSDT).")
        else:
            n = _resolve_top_n(req.top_n)
            coins = indicator_cache.get_top_n_for_strategy(strategy_id, data_manager, n) if has_cache else data_manager.get_top_n(n)

    oos_frac = req.oos_pct / 100.0
    is_trades_all = []
    oos_trades_all = []

    # Determine global split date across ALL coins (same calendar period for IS/OOS)
    _all_timestamps = []
    for _, df_tmp in coins:
        if 'timestamp' in df_tmp.columns and len(df_tmp) > 0:
            _all_timestamps.extend(df_tmp['timestamp'].dropna().astype(str).tolist())
    _all_timestamps = sorted(set(t[:10] for t in _all_timestamps if t and not t.startswith('NaT')))
    global_split_date = _all_timestamps[int(len(_all_timestamps) * (1.0 - oos_frac))] if _all_timestamps else None

    for sym, df in coins:
        if not has_cache:
            df = strategy.calculate_indicators(df.copy())

        df = filter_df_by_date(df, getattr(req, 'start_date', None), getattr(req, 'end_date', None))

        # Split by global calendar date (all coins share the same IS/OOS boundary)
        if global_split_date and 'timestamp' in df.columns:
            ts_str = df['timestamp'].astype(str).str[:10]
            df_is = df[ts_str < global_split_date]
            df_oos = df[ts_str >= global_split_date]
        else:
            split_idx = int(len(df) * (1.0 - oos_frac))
            df_is = df.iloc[:split_idx]
            df_oos = df.iloc[split_idx:]

        dyn_slip = _get_dynamic_slippage(sym)
        for period_df, trade_list in [(df_is, is_trades_all), (df_oos, oos_trades_all)]:
            if len(period_df) < 100:
                continue
            result = run_fast(
                period_df, strategy, sym,
                sl_pct=req.sl_pct / 100,
                tp_pct=req.tp_pct / 100,
                max_bars=req.max_bars,
                fee_pct=cost_model.fee_pct,
                slippage_pct=dyn_slip,
                direction=direction,
                market_type=req.market_type,
                strategy_id=strategy_id,
                funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
                timeframe=timeframe,
            )
            for trade in result.trades:
                trade_list.append(trade.pnl_pct)

    # OOS comparison
    oos_result = compute_oos_metrics(is_trades_all, oos_trades_all)

    # Monte Carlo on IS trades
    mc_result = bootstrap_trades(is_trades_all, n_simulations=req.mc_runs)

    return ValidateResponse(
        strategy=req.strategy,
        direction=direction,
        coins_used=len(coins),
        data_range=data_manager.data_range(),
        oos_pct=req.oos_pct,
        oos=OOSResult(
            is_metrics=OOSPeriodMetrics(**oos_result["is_metrics"]),
            oos_metrics=OOSPeriodMetrics(**oos_result["oos_metrics"]),
            degradation_ratio=oos_result["degradation_ratio"],
            overfit_risk=oos_result["overfit_risk"],
        ),
        monte_carlo=MonteCarloResult(
            **{k: v for k, v in mc_result.items() if k != "equity_bands"},
            equity_bands=[MCEquityBand(**b) for b in mc_result["equity_bands"]],
        ),
    )


@app.post("/admin/refresh")
async def refresh_data(x_admin_key: str = Header(default="", alias="X-Admin-Key")):
    """Manually trigger data refresh from Binance."""
    if ADMIN_API_KEY is None or not hmac.compare_digest(x_admin_key, ADMIN_API_KEY):
        raise HTTPException(status_code=403, detail="Forbidden")
    await asyncio.to_thread(_refresh_data)
    return {"status": "ok", "coins": indicator_cache.count, "generated": coin_stats_cache["generated"] if coin_stats_cache else None}


# --- Market Dashboard ---

import defusedxml.ElementTree as ET
import requests as http_requests
from email.utils import parsedate_to_datetime

MARKET_REFRESH_INTERVAL = 300  # seconds — background fetch every 5min (Binance primary, no rate limit concern)
_market_cache: Optional[dict] = None
_market_cache_ts: float = 0.0  # timestamp of last successful cache update

# Per-endpoint stale-cache fallbacks for CoinGecko (survives 429 / outages)
_cg_global_last: Optional[dict] = None
_cg_tickers_last: Optional[tuple] = None
_cg_funding_last: Optional[list] = None


_CG_BACKOFF_SCHEDULE = [10, 20, 40, 80, 160]  # seconds per attempt (exponential, 5 retries)

def _cg_get(url: str, timeout: int = 10, max_retries: int = 5, raise_on_fail: bool = True,
            cache_fallback=None):
    """CoinGecko GET with exponential backoff.

    Backoff schedule: 10s, 20s, 40s, 80s, 160s (5 retries total).
    If all retries fail and cache_fallback is provided, returns cache_fallback instead of
    raising/returning None — ensuring stale data is served rather than a broken response.
    """
    short_url = url.split("?")[0]
    for attempt in range(max_retries):
        try:
            resp = http_requests.get(url, headers=CG_HEADERS, timeout=timeout)
            if resp.status_code == 429:
                wait = _CG_BACKOFF_SCHEDULE[min(attempt, len(_CG_BACKOFF_SCHEDULE) - 1)]
                retry_after_header = resp.headers.get("Retry-After")
                if retry_after_header:
                    wait = max(wait, int(retry_after_header))
                logger.warning(
                    f"CoinGecko 429 on {short_url}, waiting {wait}s "
                    f"(attempt {attempt + 1}/{max_retries})"
                )
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        except http_requests.exceptions.Timeout:
            logger.warning(f"CoinGecko timeout on {short_url} (attempt {attempt + 1}/{max_retries})")
            continue
        except http_requests.exceptions.ConnectionError:
            wait = _CG_BACKOFF_SCHEDULE[min(attempt, len(_CG_BACKOFF_SCHEDULE) - 1)]
            logger.warning(
                f"CoinGecko connection error on {short_url} "
                f"(attempt {attempt + 1}/{max_retries}), waiting {wait}s"
            )
            time.sleep(wait)
            continue
    # All retries exhausted
    if cache_fallback is not None:
        logger.info(
            f"CoinGecko fetch failed after {max_retries} retries for {short_url} "
            f"— serving cached fallback"
        )
        return cache_fallback
    if raise_on_fail:
        raise Exception(f"CoinGecko unavailable after {max_retries} retries: {short_url}")
    return None


_news_cache: Optional[dict] = None

# --- Binance Spot live ticker (30s TTL) + Futures fallback ---
BINANCE_SPOT_URL = "https://api.binance.com/api/v3/ticker/24hr"
BINANCE_FUTURES_URL = "https://fapi.binance.com/fapi/v1/ticker/24hr"
# DO server proxy via Tailscale for Korean IP bypass (fapi v1 geo-blocked from KR)
BINANCE_PROXY_URL = os.environ.get("BINANCE_PROXY_URL", "http://100.122.203.78:9090/fapi/v1/ticker/24hr")
_binance_proxy_key = os.environ.get("BINANCE_PROXY_KEY", "")
BINANCE_PROXY_HEADERS = {"X-Proxy-Key": _binance_proxy_key} if _binance_proxy_key else {}
_live_spot_cache: Optional[dict] = None
_live_spot_ts: float = 0.0
_live_spot_lock = asyncio.Lock()
_market_cache_lock = asyncio.Lock()
_news_cache_lock = asyncio.Lock()

# Spot symbol → internal (futures-style) symbol mapping for 1000x coins
SPOT_TO_INTERNAL = {
    "SHIBUSDT": "1000SHIBUSDT", "PEPEUSDT": "1000PEPEUSDT",
    "FLOKIUSDT": "1000FLOKIUSDT", "BONKUSDT": "1000BONKUSDT",
    "SATSUSDT": "1000SATSUSDT", "RATSUSDT": "1000RATSUSDT",
    "LUNCUSDT": "1000LUNCUSDT", "XECUSDT": "1000XECUSDT",
    "CATUSDT": "1000CATUSDT", "WHYUSDT": "1000WHYUSDT",
    "CHEEMSUSDT": "1000CHEEMSUSDT",
    "MOGUSDT": "1000000MOGUSDT", "BOBUSDT": "1000000BOBUSDT",
    "BABYDOGEUSDT": "1MBABYDOGEUSDT",
}
SPOT_MULTIPLIER: Dict[str, int] = {k: 1000 for k in [
    "SHIBUSDT", "PEPEUSDT", "FLOKIUSDT", "BONKUSDT", "SATSUSDT",
    "RATSUSDT", "LUNCUSDT", "XECUSDT", "CATUSDT", "WHYUSDT", "CHEEMSUSDT",
]}
SPOT_MULTIPLIER.update({"MOGUSDT": 1_000_000, "BOBUSDT": 1_000_000, "BABYDOGEUSDT": 1_000_000})


def _fetch_fear_greed() -> dict:
    """Fetch Fear & Greed Index from Alternative.me."""
    try:
        resp = http_requests.get("https://api.alternative.me/fng/?limit=1", timeout=5)
        resp.raise_for_status()
        data = resp.json()["data"][0]
        return {"index": int(data["value"]), "label": data["value_classification"]}
    except Exception as e:
        logger.warning(f"Fear & Greed fetch failed: {e}")
        return {"index": 0, "label": "N/A"}


def _fetch_coingecko_global() -> dict:
    """Fetch global market data from CoinGecko (supplementary — not critical)."""
    global _cg_global_last
    _EMPTY = {"total_market_cap_b": 0, "btc_dominance": 0, "total_volume_24h_b": 0}
    try:
        resp = _cg_get("https://api.coingecko.com/api/v3/global", timeout=5, raise_on_fail=False)
        if resp is None:
            return _cg_global_last if _cg_global_last is not None else _EMPTY
        data = resp.json()["data"]
        result = {
            "total_market_cap_b": round(data["total_market_cap"].get("usd", 0) / 1e9, 1),
            "btc_dominance": round(data.get("market_cap_percentage", {}).get("btc", 0), 1),
            "total_volume_24h_b": round(data["total_volume"].get("usd", 0) / 1e9, 1),
        }
        _cg_global_last = result  # update stale-cache
        return result
    except Exception as e:
        logger.warning(f"CoinGecko global fetch failed: {e}")
        return _cg_global_last if _cg_global_last is not None else _EMPTY


def _fetch_binance_tickers() -> tuple:
    """Fetch market tickers from Binance Futures API (PRIMARY — free, unlimited, no API key).
    Returns (top_gainers, top_losers, btc_price, btc_change, eth_price, eth_change).
    Falls back to CoinGecko if Binance fails.
    """
    try:
        # Try direct first, fallback to DO proxy (Korean IP workaround)
        try:
            resp = http_requests.get(BINANCE_FUTURES_URL, timeout=5)
            resp.raise_for_status()
            tickers = resp.json()
        except Exception:
            resp = http_requests.get(BINANCE_PROXY_URL, timeout=15, headers=BINANCE_PROXY_HEADERS)
            resp.raise_for_status()
            tickers = resp.json()

        # Filter USDT pairs with valid data
        usdt_tickers = [t for t in tickers if t["symbol"].endswith("USDT")
                        and float(t.get("priceChangePercent", 0)) != 0
                        and float(t.get("quoteVolume", 0)) > 0]

        # BTC / ETH
        btc = next((t for t in usdt_tickers if t["symbol"] == "BTCUSDT"), None)
        eth = next((t for t in usdt_tickers if t["symbol"] == "ETHUSDT"), None)
        btc_price = round(float(btc["lastPrice"]), 2) if btc else 0
        btc_change = round(float(btc["priceChangePercent"]), 2) if btc else 0
        eth_price = round(float(eth["lastPrice"]), 2) if eth else 0
        eth_change = round(float(eth["priceChangePercent"]), 2) if eth else 0

        # Sort by price change
        usdt_tickers.sort(key=lambda t: float(t["priceChangePercent"]), reverse=True)

        def _to_mover(t):
            return MarketMover(
                symbol=t["symbol"],
                price=round(float(t["lastPrice"]), 4),
                change_24h=round(float(t["priceChangePercent"]), 2),
                volume_24h=round(float(t.get("quoteVolume", 0)), 0),
            )

        top_gainers = [_to_mover(t) for t in usdt_tickers[:10]]
        top_losers = [_to_mover(t) for t in usdt_tickers[-10:][::-1]]

        return top_gainers, top_losers, btc_price, btc_change, eth_price, eth_change
    except Exception as e:
        logger.warning(f"Binance tickers fetch failed, trying CoinGecko fallback: {e}")
        return _fetch_coingecko_tickers_fallback()


def _fetch_coingecko_tickers_fallback() -> tuple:
    """CoinGecko fallback for tickers (only used when Binance fails)."""
    global _cg_tickers_last
    _EMPTY = ([], [], 0, 0, 0, 0)
    try:
        resp = _cg_get(
            "https://api.coingecko.com/api/v3/coins/markets"
            "?vs_currency=usd&order=market_cap_desc&per_page=250&sparkline=false"
            "&price_change_percentage=24h",
            raise_on_fail=False,
        )
        if resp is None:
            return _cg_tickers_last if _cg_tickers_last is not None else _EMPTY
        coins = resp.json()

        btc = next((c for c in coins if c["symbol"] == "btc"), None)
        eth = next((c for c in coins if c["symbol"] == "eth"), None)
        btc_price = round(btc["current_price"], 2) if btc else 0
        btc_change = round(btc.get("price_change_percentage_24h") or 0, 2) if btc else 0
        eth_price = round(eth["current_price"], 2) if eth else 0
        eth_change = round(eth.get("price_change_percentage_24h") or 0, 2) if eth else 0

        valid = [c for c in coins if c.get("price_change_percentage_24h") is not None
                 and c.get("total_volume", 0) > 0]
        valid.sort(key=lambda c: c["price_change_percentage_24h"], reverse=True)

        def _to_mover(c):
            sym = c["symbol"].upper() + "USDT"
            return MarketMover(
                symbol=sym,
                price=round(c["current_price"], 4),
                change_24h=round(c["price_change_percentage_24h"], 2),
                volume_24h=round(c.get("total_volume", 0), 0),
            )

        top_gainers = [_to_mover(c) for c in valid[:10]]
        top_losers = [_to_mover(c) for c in valid[-10:][::-1]]

        result = (top_gainers, top_losers, btc_price, btc_change, eth_price, eth_change)
        _cg_tickers_last = result  # update stale-cache
        return result
    except Exception as e:
        logger.warning(f"CoinGecko tickers fallback also failed: {e}")
        return _cg_tickers_last if _cg_tickers_last is not None else _EMPTY


def _fetch_coingecko_funding() -> list:
    """Fetch extreme funding rates from CoinGecko derivatives (NO Binance API).
    CoinGecko funding_rate is already a percentage decimal (e.g. -0.005 = -0.5%).
    We filter to major exchanges only to avoid noisy data.
    """
    global _cg_funding_last
    MAJOR_EXCHANGES = {"binance", "bybit", "okx", "bitget", "dydx", "htx", "gate", "kucoin", "mexc"}
    try:
        resp = _cg_get(
            "https://api.coingecko.com/api/v3/derivatives"
            "?include_tickers=unexpired",
            raise_on_fail=False,
        )
        if resp is None:
            return _cg_funding_last if _cg_funding_last is not None else []
        data = resp.json()

        # Filter perpetual USDT pairs from major exchanges
        perps = []
        for d in data:
            fr = d.get("funding_rate")
            sym = d.get("symbol", "")
            market = (d.get("market", "") or "").lower()
            if (fr is not None and "USDT" in sym.upper()
                    and d.get("contract_type") == "perpetual"
                    and any(ex in market for ex in MAJOR_EXCHANGES)):
                try:
                    rate = float(fr)
                    # CoinGecko rate is decimal: -0.005 = -0.5%
                    clean_sym = sym.upper().replace("/", "").replace(" ", "").replace("_", "")
                    # Remove exchange-specific suffixes
                    for suffix in ("PERP", "UMCBL", "CMCBL", "DMCBL", "SWAP"):
                        clean_sym = clean_sym.replace(suffix, "")
                    # Kucoin uses trailing M (e.g. NKNUSDTM)
                    if clean_sym.endswith("USDTM"):
                        clean_sym = clean_sym[:-1]
                    # Remove hyphens (e.g. INJ-USDT -> INJUSDT)
                    clean_sym = clean_sym.replace("-", "")
                    perps.append({"symbol": clean_sym, "rate": rate})
                except (ValueError, TypeError):
                    continue

        # Deduplicate by symbol (keep highest abs rate)
        best: dict = {}
        for p in perps:
            s = p["symbol"]
            if s not in best or abs(p["rate"]) > abs(best[s]["rate"]):
                best[s] = p
        unique = list(best.values())

        # Sort by abs funding rate
        unique.sort(key=lambda d: abs(d["rate"]), reverse=True)

        result = [
            FundingRate(
                symbol=d["symbol"],
                rate=round(d["rate"], 4),  # already % decimal
                annual_pct=round(d["rate"] * 3 * 365, 1),  # 3 periods/day * 365
            )
            for d in unique[:10]
        ]
        _cg_funding_last = result  # update stale-cache
        return result
    except Exception as e:
        logger.warning(f"CoinGecko funding fetch failed: {e}")
        return _cg_funding_last if _cg_funding_last is not None else []


def _build_market_overview() -> dict:
    """Build complete market overview. Binance (primary) + CoinGecko (supplementary) + Alternative.me."""
    fg = _fetch_fear_greed()
    cg = _fetch_coingecko_global()
    gainers, losers, btc_price, btc_change, eth_price, eth_change = _fetch_binance_tickers()
    funding = _fetch_coingecko_funding()

    return MarketOverview(
        btc_price=btc_price,
        btc_change_24h=btc_change,
        eth_price=eth_price,
        eth_change_24h=eth_change,
        fear_greed_index=fg["index"],
        fear_greed_label=fg["label"],
        total_market_cap_b=cg["total_market_cap_b"],
        btc_dominance=cg["btc_dominance"],
        total_volume_24h_b=cg["total_volume_24h_b"],
        top_gainers=gainers,
        top_losers=losers,
        extreme_funding=funding,
        generated=datetime.now(timezone.utc).isoformat(),
    ).model_dump()


RSS_FEEDS = [
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss"),
    ("CoinTelegraph", "https://cointelegraph.com/rss"),
    ("Decrypt", "https://decrypt.co/feed"),
    ("Bitcoin Magazine", "https://bitcoinmagazine.com/feed"),
]


def _parse_pub_date(raw: str) -> str:
    """Parse various RSS date formats into ISO 8601 string."""
    if not raw:
        return ""
    try:
        # RFC 2822 (most RSS feeds): "Sun, 15 Feb 2026 20:59:12 +0000"
        dt = parsedate_to_datetime(raw)
        return dt.isoformat()
    except Exception:
        pass
    # ISO 8601 (Atom feeds)
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            continue
    return raw


def _parse_rss(source: str, url: str) -> list:
    """Parse a single RSS feed into NewsItem dicts."""
    items = []
    MAX_FEED_BYTES = 2 * 1024 * 1024  # 2 MB hard cap
    try:
        resp = http_requests.get(url, timeout=8, headers={"User-Agent": "PRUVIQ/1.0"})
        resp.raise_for_status()
        raw = resp.content  # auto-decompresses gzip/deflate (resp.raw.read() does not)
        if len(raw) > MAX_FEED_BYTES:
            logger.warning(f"RSS feed {source} exceeded 2MB size limit, skipping")
            return []
        root = ET.fromstring(raw)

        # Handle both RSS 2.0 (<channel><item>) and Atom (<entry>)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        rss_items = root.findall(".//item")
        if not rss_items:
            rss_items = root.findall(".//atom:entry", ns)

        for item in rss_items[:15]:  # max 15 per source
            title = item.findtext("title") or item.findtext("atom:title", namespaces=ns) or ""
            link = item.findtext("link") or ""
            if not link:
                link_el = item.find("atom:link", ns)
                link = link_el.get("href", "") if link_el is not None else ""
            published_raw = item.findtext("pubDate") or item.findtext("atom:published", namespaces=ns) or ""
            published = _parse_pub_date(published_raw)
            desc = item.findtext("description") or item.findtext("atom:summary", namespaces=ns) or ""
            # Strip HTML from description
            if "<" in desc:
                desc = desc[:desc.find("<")] if "<" in desc else desc
            desc = desc.strip()[:200]

            if title and link:
                items.append({
                    "title": title.strip(),
                    "link": link.strip(),
                    "source": source,
                    "published": published,
                    "summary": desc,
                })
    except Exception as e:
        logger.warning(f"RSS fetch failed for {source}: {e}")
    return items


def _build_news() -> dict:
    """Build aggregated news from RSS feeds."""
    all_items = []
    for source, url in RSS_FEEDS:
        all_items.extend(_parse_rss(source, url))

    # Sort by published date (most recent first)
    all_items.sort(key=lambda x: x.get("published", ""), reverse=True)

    return {
        "items": [NewsItem(**item) for item in all_items[:50]],
        "generated": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/market", response_model=MarketOverview)
async def get_market():
    """Get market overview with BTC/ETH prices, Fear & Greed, top movers, funding rates.
    Data is refreshed every 5min by background task (Binance primary).
    If cache is stale (>30min), forces a fresh fetch.
    """
    global _market_cache, _market_cache_ts
    async with _market_cache_lock:
        cache_age = time.time() - _market_cache_ts if _market_cache_ts > 0 else float("inf")

        # If cache is stale (>30min), force a fresh fetch
        if _market_cache is not None and cache_age > 1800:
            logger.warning(f"Market cache stale ({cache_age/60:.0f}min), forcing refresh")
            try:
                data = await asyncio.to_thread(_build_market_overview)
                _market_cache = data
                _market_cache_ts = time.time()
            except Exception as e:
                logger.error(f"Forced market refresh failed, serving stale cache: {e}")

        if _market_cache is not None:
            return MarketOverview(**_market_cache)
        # First request before background task has run — fetch once
        data = await asyncio.to_thread(_build_market_overview)
        _market_cache = data
        _market_cache_ts = time.time()
        return MarketOverview(**data)


def _fetch_spot_tickers() -> list:
    """Fetch all USDT tickers from Binance Spot API. Weight 40 per call."""
    try:
        resp = http_requests.get(BINANCE_SPOT_URL, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning(f"Binance Spot fetch: {e}")
        return []


def _fetch_futures_tickers() -> list:
    """Fetch Futures tickers for Spot-missing coins. Weight 40 per call."""
    try:
        try:
            resp = http_requests.get(BINANCE_FUTURES_URL, timeout=5)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            resp = http_requests.get(BINANCE_PROXY_URL, timeout=15, headers=BINANCE_PROXY_HEADERS)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.warning(f"Binance Futures fallback fetch: {e}")
        return []


def _build_live_coins(spot_tickers: list, futures_tickers: list) -> list:
    """Build coins list from Spot (primary) + Futures (fallback for gaps)."""
    coins = []
    seen_symbols: set = set()
    # 1. Spot tickers (primary)
    for t in spot_tickers:
        sym = t.get("symbol", "")
        if not sym.endswith("USDT"):
            continue
        mul = SPOT_MULTIPLIER.get(sym, 1)
        display_sym = SPOT_TO_INTERNAL.get(sym, sym)
        coins.append({
            "symbol": display_sym,
            "price": float(t.get("lastPrice", 0)) * mul,
            "change_24h": round(float(t.get("priceChangePercent", 0)), 2),
            "volume_24h": round(float(t.get("quoteVolume", 0)), 2),
        })
        seen_symbols.add(display_sym)
    # 2. Futures fallback (only for symbols not covered by Spot)
    for t in futures_tickers:
        sym = t.get("symbol", "")
        if not sym.endswith("USDT") or sym in seen_symbols:
            continue
        coins.append({
            "symbol": sym,
            "price": float(t.get("lastPrice", 0)),
            "change_24h": round(float(t.get("priceChangePercent", 0)), 2),
            "volume_24h": round(float(t.get("quoteVolume", 0)), 2),
        })
        seen_symbols.add(sym)
    return [c for c in coins if c["price"] > 0]


@app.get("/market/live")
async def market_live():
    """Real-time Binance prices (30s TTL cache).
    Spot (primary) + Futures (fallback for Spot-missing coins).
    Weight: 40 (Spot) + 40 (Futures) = 80/refresh × 2/min = 160 (6000 limit = 2.7%).
    """
    global _live_spot_cache, _live_spot_ts
    if _live_spot_cache and time.time() - _live_spot_ts < 30:
        return _live_spot_cache
    async with _live_spot_lock:
        # Double-check after acquiring lock (prevents thundering herd)
        if _live_spot_cache and time.time() - _live_spot_ts < 30:
            return _live_spot_cache
        spot, futures = await asyncio.gather(
            asyncio.to_thread(_fetch_spot_tickers),
            asyncio.to_thread(_fetch_futures_tickers),
        )
        if not spot and not futures:
            if _live_spot_cache:
                return _live_spot_cache
            raise HTTPException(503, "Binance unavailable")
        coins = _build_live_coins(spot or [], futures or [])
        result = {
            "coins": coins,
            "source": "binance_spot+futures",
            "generated": datetime.now(timezone.utc).isoformat(),
        }
        _live_spot_cache, _live_spot_ts = result, time.time()
        return result


@app.get("/news", response_model=NewsResponse)
async def get_news():
    """Get aggregated crypto news from RSS feeds.
    Data is refreshed every 60s by background task.
    """
    global _news_cache
    async with _news_cache_lock:
        if _news_cache is not None:
            return NewsResponse(**_news_cache)
        data = await asyncio.to_thread(_build_news)
        _news_cache = data
        return NewsResponse(**data)


# --- Macro Economic Endpoints ---

MACRO_CACHE_TTL = 300  # 5 minutes
_macro_cache: Optional[dict] = None
_macro_cache_time: float = 0

# CNBC Quote API (no key, batch via pipe separator) + FRED for Fed Rate
CNBC_QUOTE_URL = (
    "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol"
    "?symbols={symbols}&requestMethod=itv&no498498=1&partnerId=2"
    "&fund=1&exthrs=1&output=json"
)

CNBC_INDICATORS = [
    {"symbol": ".SPX", "name": "S&P 500", "unit": "Index", "id": "SPX"},
    {"symbol": ".IXIC", "name": "Nasdaq", "unit": "Index", "id": "IXIC"},
    {"symbol": ".DXY", "name": "DXY (US Dollar)", "unit": "Index", "id": "DXY"},
    {"symbol": "US10Y", "name": "US 10Y Treasury", "unit": "%", "id": "US10Y"},
    {"symbol": "US2Y", "name": "US 2Y Treasury", "unit": "%", "id": "US2Y"},
    {"symbol": ".VIX", "name": "VIX", "unit": "Index", "id": "VIX"},
    {"symbol": "@GC.1", "name": "Gold", "unit": "USD", "id": "GOLD"},
]

FRED_FED_RATE = {"id": "DFF", "name": "Fed Funds Rate", "unit": "%", "source": "FRED"}


def _parse_cnbc_value(raw: str):
    if not raw:
        return None
    cleaned = raw.replace(",", "").replace("%", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def _fetch_fred_series(series_id: str) -> dict:
    """Fetch latest value from FRED public CSV (no API key needed)."""
    try:
        end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        start = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start}&coed={end}"
        resp = http_requests.get(url, timeout=8)
        resp.raise_for_status()
        lines = resp.text.strip().split("\n")
        if len(lines) < 2:
            return {}
        latest_line = None
        prev_line = None
        for line in reversed(lines):
            parts = line.strip().split(",")
            if len(parts) == 2 and parts[1] not in (".", ""):
                if latest_line is None:
                    latest_line = parts
                elif prev_line is None:
                    prev_line = parts
                    break
        if not latest_line:
            return {}
        result = {"value": float(latest_line[1]), "updated": latest_line[0]}
        if prev_line:
            result["previous"] = float(prev_line[1])
        return result
    except Exception as e:
        logger.warning(f"FRED fetch failed for {series_id}: {e}")
        return {}


def _fetch_derivatives_data() -> Optional[DerivativesData]:
    """Fetch crypto derivatives OI data from CoinGecko with graceful fallback."""
    try:
        resp = http_requests.get(
            "https://api.coingecko.com/api/v3/derivatives",
            headers=CG_HEADERS,
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()

        btc_oi = 0.0
        eth_oi = 0.0
        for d in data:
            sym = (d.get("symbol") or "").upper()
            oi = _safe_float(d.get("open_interest"))
            if "BTC" in sym:
                btc_oi += oi
            elif "ETH" in sym:
                eth_oi += oi

        return DerivativesData(
            btc_open_interest_b=round(btc_oi / 1e9, 2) if btc_oi else 0,
            eth_open_interest_b=round(eth_oi / 1e9, 2) if eth_oi else 0,
            note="OI data from CoinGecko derivatives endpoint",
        )
    except Exception as e:
        logger.warning(f"Derivatives data fetch failed: {e}")
        return DerivativesData(note=f"Fetch failed: {str(e)[:100]}")


def _fetch_cnbc_indicators() -> list:
    """Fetch 7 macro indicators from CNBC in a single HTTP call."""
    symbol_map = {ind["symbol"]: ind for ind in CNBC_INDICATORS}
    result = []
    try:
        symbols = "|".join(ind["symbol"] for ind in CNBC_INDICATORS)
        url = CNBC_QUOTE_URL.format(symbols=symbols)
        resp = http_requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        quotes = data.get("FormattedQuoteResult", {}).get("FormattedQuote", [])
        if isinstance(quotes, dict):
            quotes = [quotes]
        for q in quotes:
            ind = symbol_map.get(q.get("symbol", ""))
            if not ind:
                continue
            value = _parse_cnbc_value(q.get("last", ""))
            change = _parse_cnbc_value(q.get("change", ""))
            if value is not None:
                result.append(MacroIndicator(
                    id=ind["id"], name=ind["name"], value=value,
                    change=change, unit=ind["unit"],
                    updated=q.get("last_timedate", ""), source="CNBC",
                ))
    except Exception as e:
        logger.warning(f"CNBC macro fetch failed: {e}")
    return result


def _fetch_fred_indicator() -> Optional[MacroIndicator]:
    """Fetch Fed Funds Rate from FRED."""
    fed = _fetch_fred_series(FRED_FED_RATE["id"])
    if not fed:
        return None
    change = round(fed["value"] - fed.get("previous", fed["value"]), 3) if fed.get("previous") else None
    return MacroIndicator(
        id=FRED_FED_RATE["id"], name=FRED_FED_RATE["name"],
        value=fed["value"], change=change, unit=FRED_FED_RATE["unit"],
        updated=fed.get("updated", ""), source="FRED",
    )


def _build_macro_data() -> dict:
    """Build macro data from CNBC (primary) + FRED (Fed Rate only).

    Runs CNBC, FRED, and CoinGecko derivatives fetches in parallel to
    reduce total latency from ~1.8s (sequential) to ~0.6s (parallel).
    """
    # Fan-out: run 3 independent HTTP calls concurrently
    with ThreadPoolExecutor(max_workers=3) as pool:
        fut_cnbc = pool.submit(_fetch_cnbc_indicators)
        fut_fred = pool.submit(_fetch_fred_indicator)
        fut_deriv = pool.submit(_fetch_derivatives_data)
        cnbc_indicators = fut_cnbc.result()
        fred_indicator = fut_fred.result()
        derivatives = fut_deriv.result()

    indicators = list(cnbc_indicators)
    if fred_indicator:
        indicators.append(fred_indicator)

    return MacroResponse(
        indicators=indicators, derivatives=derivatives,
        events=[], generated=datetime.now(timezone.utc).isoformat(),
    ).model_dump()


@app.get("/macro", response_model=MacroResponse)
async def get_macro():
    """Get macro economic indicators and derivatives data."""
    global _macro_cache, _macro_cache_time
    now = time.time()
    if _macro_cache and (now - _macro_cache_time) < MACRO_CACHE_TTL:
        return MacroResponse(**_macro_cache)

    data = await asyncio.to_thread(_build_macro_data)
    _macro_cache = data
    _macro_cache_time = now
    return MacroResponse(**data)


# --- Strategy Builder Endpoints ---

from src.engine.condition_engine import (
    ConditionEngine, validate_strategy_json,
    get_preset_strategies, PRESET_STRATEGIES,
)
from src.engine.indicator_pipeline import get_available_indicators, INDICATOR_REGISTRY
from api.schemas import (
    BacktestRequest, BacktestResponse, PresetListItem, IndicatorInfo, YearlyStat, MonthlyStat,
)


@app.get("/builder/indicators", response_model=List[IndicatorInfo])
async def list_indicators():
    """List all available indicators for Strategy Builder."""
    return [
        IndicatorInfo(
            id=ind_id,
            name=info["name"],
            fields=info["fields"],
            default_params=info["default_params"],
        )
        for ind_id, info in INDICATOR_REGISTRY.items()
    ]


@app.get("/builder/presets", response_model=List[PresetListItem])
async def list_presets():
    """List all preset strategy templates."""
    result = []
    for pid, pdef in PRESET_STRATEGIES.items():
        engine = ConditionEngine(pdef)
        params = engine.get_params()
        result.append(PresetListItem(
            id=pid,
            name=pdef["name"],
            direction=pdef["direction"],
            indicators=params["indicators"],
            conditions_count=params["conditions_count"],
            sl_pct=pdef["sl_pct"],
            tp_pct=pdef["tp_pct"],
        ))
    return result


@app.get("/builder/presets/{preset_id}")
async def get_preset(preset_id: str):
    """Get full preset strategy JSON for editing."""
    if preset_id not in PRESET_STRATEGIES:
        # Try integer index lookup (e.g. /builder/presets/0)
        try:
            idx = int(preset_id)
            keys = list(PRESET_STRATEGIES.keys())
            if 0 <= idx < len(keys):
                preset_id = keys[idx]
            else:
                raise HTTPException(404, f"Preset not found: {preset_id}")
        except ValueError:
            raise HTTPException(404, f"Preset not found: {preset_id}")
    return PRESET_STRATEGIES[preset_id]


def _run_backtest_sync(req: BacktestRequest, bt_key: str) -> BacktestResponse:
    """CPU-bound backtest logic — runs in a thread via asyncio.to_thread."""
    # Handle "both" direction: run short and long separately
    is_both = req.direction == "both"
    if is_both:
        directions_to_run = ["short", "long"]
    else:
        directions_to_run = [req.direction or "short"]

    timeframe = _validate_timeframe(getattr(req, 'timeframe', '1H') or '1H')
    resampled = _is_resampled(timeframe)

    t_start = time.time()

    # Build strategy JSON from request
    strategy_json = {
        "name": req.name,
        "direction": req.direction,
        "indicators": req.indicators,
        "entry": req.entry,
        "avoid_hours": req.avoid_hours,
        "sl_pct": req.sl_pct,
        "tp_pct": req.tp_pct,
        "max_bars": req.max_bars,
    }

    # Validate
    is_valid, errors = validate_strategy_json(strategy_json)
    if not is_valid:
        return BacktestResponse(
            name=req.name, direction=req.direction,
            sl_pct=req.sl_pct, tp_pct=req.tp_pct, max_bars=req.max_bars,
            indicators_used=list(req.indicators.keys()),
            conditions_count=0,
            total_trades=0, wins=0, losses=0, win_rate=0,
            total_return_pct=0, profit_factor=0,
            avg_win_pct=0, avg_loss_pct=0,
            max_drawdown_pct=0, max_consecutive_losses=0,
            tp_count=0, sl_count=0, timeout_count=0,
            coins_used=0, data_range="", equity_curve=[],
            is_valid=False, validation_errors=errors,
            compute_time_ms=0,
        )

    # Create engine
    engine = ConditionEngine(strategy_json)
    params = engine.get_params()

    # Get coins — use resampled raw data for non-1H timeframes
    if resampled:
        coin_list = _get_resampled_coins(req.symbols, req.top_n, timeframe)
    else:
        if req.symbols:
            coin_list = data_manager.get_symbols(req.symbols)
        else:
            coin_list = data_manager.get_top_n(_resolve_top_n(req.top_n))

    # Track missing symbols for warning
    _missing_symbols = []
    if req.symbols:
        found_syms = {sym for sym, _ in coin_list}
        _missing_symbols = [s for s in req.symbols if s.upper() not in found_syms]

    if not coin_list:
        raise HTTPException(404, "No coins found.")

    # Run simulation
    cost_model = CostModel.futures()
    all_trades = []
    coin_results = []
    coin_agg = {}  # For "both": aggregate per-coin across directions

    for run_dir in directions_to_run:
        # Update strategy_json direction for each run
        strategy_json["direction"] = run_dir
        engine = ConditionEngine(strategy_json)

        for sym, df_raw in coin_list:
            # Compute indicators via ConditionEngine
            df = engine.prepare_dataframe(df_raw.copy())
            df = filter_df_by_date(df, getattr(req, 'start_date', None), getattr(req, 'end_date', None))

            # Find signals using vectorized evaluation
            signal_indices = engine.find_signals_vectorized(df)

            if len(signal_indices) == 0:
                continue

            # Simulate trades from signals
            from src.simulation.engine_fast import simulate_vectorized
            dyn_slip = _get_dynamic_slippage(sym)
            trades = simulate_vectorized(
                df=df,
                signal_indices=signal_indices,
                sl_pct=req.sl_pct / 100,
                tp_pct=req.tp_pct / 100,
                max_bars=req.max_bars,
                fee_pct=cost_model.fee_pct,
                slippage_pct=dyn_slip,
                direction=run_dir,
                symbol=sym,
                funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
                timeframe=timeframe,
            )

            # Collect per-coin stats
            if trades:
                c_wins = [t for t in trades if t.pnl_pct > 0]
                c_losses = [t for t in trades if t.pnl_pct <= 0]
                c_gp = sum(t.pnl_pct for t in c_wins) if c_wins else 0
                c_gl = abs(sum(t.pnl_pct for t in c_losses)) if c_losses else 0
                c_total_ret = sum(t.pnl_pct for t in trades)

                if is_both:
                    # Aggregate same coin across short/long
                    if sym not in coin_agg:
                        coin_agg[sym] = {"trades": 0, "wins": 0, "losses": 0,
                                         "gp": 0, "gl": 0, "total_ret": 0,
                                         "tp": 0, "sl": 0, "timeout": 0}
                    coin_agg[sym]["trades"] += len(trades)
                    coin_agg[sym]["wins"] += len(c_wins)
                    coin_agg[sym]["losses"] += len(c_losses)
                    coin_agg[sym]["gp"] += c_gp
                    coin_agg[sym]["gl"] += c_gl
                    coin_agg[sym]["total_ret"] += c_total_ret
                    coin_agg[sym]["tp"] += sum(1 for t in trades if t.exit_reason == "tp")
                    coin_agg[sym]["sl"] += sum(1 for t in trades if t.exit_reason == "sl")
                    coin_agg[sym]["timeout"] += sum(1 for t in trades if t.exit_reason == "timeout")
                else:
                    coin_results.append(CoinResult(
                        symbol=sym,
                        trades=len(trades),
                        wins=len(c_wins),
                        losses=len(c_losses),
                        win_rate=round(len(c_wins) / len(trades) * 100, 2),
                        profit_factor=round(c_gp / c_gl, 2) if c_gl > 0 else 999.99,
                        total_return_pct=round(c_total_ret, 2),
                        avg_pnl_pct=round(c_total_ret / len(trades), 4),
                        tp_count=sum(1 for t in trades if t.exit_reason == "tp"),
                        sl_count=sum(1 for t in trades if t.exit_reason == "sl"),
                        timeout_count=sum(1 for t in trades if t.exit_reason == "timeout"),
                    ))

            # Calculate USD PnL per trade
            position_size = getattr(req, 'per_coin_usd', 60.0) * getattr(req, 'leverage', 5)
            for trade in trades:
                # Skip trades with invalid timestamps
                if not trade.entry_time or str(trade.entry_time).startswith("NaT"):
                    continue
                trade.pnl_usd = round(position_size * (trade.pnl_pct / 100), 4)
                all_trades.append({
                    "time": str(trade.entry_time),
                    "pnl_pct": trade.pnl_pct,
                    "pnl_usd": trade.pnl_usd,
                    "exit_reason": trade.exit_reason,
                    "funding_pct": getattr(trade, 'funding_pct', 0),
                    "symbol": trade.symbol,
                    "direction": trade.direction,
                    "entry_time": trade.entry_time,
                    "exit_time": trade.exit_time,
                    "entry_price": trade.entry_price,
                    "exit_price": trade.exit_price,
                    "bars_held": trade.bars_held,
                })

    # Build coin_results from aggregated data for "both" mode
    if is_both:
        for sym, c in coin_agg.items():
            wr = round(c["wins"] / c["trades"] * 100, 2) if c["trades"] > 0 else 0
            gl = c["gl"]
            coin_results.append(CoinResult(
                symbol=sym, trades=c["trades"],
                wins=c["wins"], losses=c["losses"],
                win_rate=wr,
                profit_factor=round(c["gp"] / gl, 2) if gl > 0 else 999.99,
                total_return_pct=round(c["total_ret"], 2),
                avg_pnl_pct=round(c["total_ret"] / c["trades"], 4),
                tp_count=c["tp"], sl_count=c["sl"], timeout_count=c["timeout"],
            ))

    # Sort coin_results by total_return descending
    coin_results.sort(key=lambda x: x.total_return_pct, reverse=True)

    # Filter out trades with invalid timestamps (NaT from pandas)
    all_trades = [t for t in all_trades if t.get("time") and not str(t["time"]).startswith("NaT")]
    all_trades.sort(key=lambda t: t["time"])

    # --- Concurrent position limit (matches live: max 100) ---
    skipped = 0
    max_concurrent = getattr(req, 'max_concurrent_positions', 100) or 100
    if max_concurrent > 0 and len(all_trades) > 0:
        active_exits = []  # sorted list of exit_times
        filtered = []
        for trade in all_trades:
            # Remove positions that have exited before this entry
            active_exits = [et for et in active_exits if et > trade["entry_time"]]
            if len(active_exits) < max_concurrent:
                filtered.append(trade)
                active_exits.append(trade["exit_time"])
                active_exits.sort()
        skipped = len(all_trades) - len(filtered)
        all_trades = filtered
        # Recalculate coin_results from filtered trades
        if skipped > 0:
            from collections import Counter
            coin_trade_map = {}
            for t in all_trades:
                coin_trade_map.setdefault(t["symbol"], []).append(t)
            coin_results = []
            for sym, trades_list in sorted(coin_trade_map.items()):
                c_wins = [t for t in trades_list if t["pnl_pct"] > 0]
                c_losses = [t for t in trades_list if t["pnl_pct"] <= 0]
                c_gp = sum(t["pnl_pct"] for t in c_wins) if c_wins else 0
                c_gl = abs(sum(t["pnl_pct"] for t in c_losses)) if c_losses else 0
                c_total = sum(t["pnl_pct"] for t in trades_list)
                coin_results.append(CoinResult(
                    symbol=sym, trades=len(trades_list),
                    wins=len(c_wins), losses=len(c_losses),
                    win_rate=round(len(c_wins) / len(trades_list) * 100, 2),
                    profit_factor=round(c_gp / c_gl, 2) if c_gl > 0 else 999.99,
                    total_return_pct=round(c_total, 2),
                    avg_pnl_pct=round(c_total / len(trades_list), 4),
                    tp_count=sum(1 for t in trades_list if t["exit_reason"] == "tp"),
                    sl_count=sum(1 for t in trades_list if t["exit_reason"] == "sl"),
                    timeout_count=sum(1 for t in trades_list if t["exit_reason"] == "timeout"),
                ))
            coin_results.sort(key=lambda x: x.total_return_pct, reverse=True)

    # Aggregate results
    if not all_trades:
        return BacktestResponse(
            name=req.name, direction=req.direction,
            sl_pct=req.sl_pct, tp_pct=req.tp_pct, max_bars=req.max_bars,
            indicators_used=params["indicators"],
            conditions_count=params["conditions_count"],
            total_trades=0, wins=0, losses=0, win_rate=0,
            total_return_pct=0, profit_factor=0,
            avg_win_pct=0, avg_loss_pct=0,
            max_drawdown_pct=0, max_consecutive_losses=0,
            total_funding_pct=0, tp_count=0, sl_count=0, timeout_count=0,
            coins_used=len(coin_list), data_range=data_manager.data_range(),
            equity_curve=[], coin_results=[],
            is_valid=True, validation_errors=[],
            compute_time_ms=int((time.time() - t_start) * 1000),
        )

    wins = [t for t in all_trades if t["pnl_pct"] > 0]
    losses = [t for t in all_trades if t["pnl_pct"] <= 0]
    gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.0
    is_compounding = getattr(req, 'compounding', False)

    avg_win = (sum(t["pnl_pct"] for t in wins) / len(wins)) if wins else 0
    avg_loss = (sum(t["pnl_pct"] for t in losses) / len(losses)) if losses else 0

    # Portfolio USD calculations
    per_coin_usd = getattr(req, 'per_coin_usd', 60.0)
    leverage_val = getattr(req, 'leverage', 5)
    effective_positions = min(max_concurrent, len(coin_list))

    if is_compounding:
        # Compound mode: per_coin_usd = total capital, divide by coins for per-position
        initial_capital = per_coin_usd
        per_position_usd = per_coin_usd / max(effective_positions, 1)
        base_position_size = per_position_usd * leverage_val
    else:
        # Simple mode: per_coin_usd = per-position capital
        initial_capital = per_coin_usd * effective_positions
        base_position_size = per_coin_usd * leverage_val

    # Compounding vs Simple: Recalculate pnl_usd
    if is_compounding:
        equity_usd_compound = initial_capital
        peak_usd_compound = initial_capital
        for t in all_trades:
            scale = max(equity_usd_compound, 0.0) / initial_capital if initial_capital > 0 else 1.0
            t["pnl_usd"] = round(base_position_size * scale * (t["pnl_pct"] / 100), 4)
            equity_usd_compound = max(equity_usd_compound + t["pnl_usd"], 0.0)
            peak_usd_compound = max(peak_usd_compound, equity_usd_compound)
    else:
        for t in all_trades:
            t["pnl_usd"] = round(base_position_size * (t["pnl_pct"] / 100), 4)

    total_pnl_usd = sum(t["pnl_usd"] for t in all_trades)
    portfolio_return_pct = round((total_pnl_usd / initial_capital * 100), 2) if initial_capital > 0 else 0

    # total_return_pct: compound vs simple
    if is_compounding:
        # Compound: use final equity from equity tracking (includes reinvestment effects)
        total_return = round((equity_usd_compound - initial_capital) / initial_capital * 100, 4) if initial_capital > 0 else 0
    else:
        total_return = round(total_pnl_usd / initial_capital * 100, 4) if initial_capital > 0 else 0

    # Equity + MDD (in both % and USD) — 100-based for both modes
    equity = 100.0
    equity_usd = 0.0
    peak = equity
    peak_usd = 0.0
    max_dd = 0.0
    max_dd_usd = 0.0
    eq_times = []
    eq_values = []
    max_consec = 0
    cur_consec = 0
    equity_usd_track = initial_capital

    for t in all_trades:
        if is_compounding:
            # Portfolio compound: use USD equity → convert to %
            equity_usd_track = max(equity_usd_track + t["pnl_usd"], 0.0)
            equity = (equity_usd_track / initial_capital * 100) if initial_capital > 0 else 0.0
        else:
            pnl_on_capital = t["pnl_usd"] / initial_capital * 100 if initial_capital > 0 else 0
            equity += pnl_on_capital
            equity_usd_track += t["pnl_usd"]
        equity_usd += t.get("pnl_usd", 0)
        peak = max(peak, equity)
        peak_usd = max(peak_usd, equity_usd)
        dd = (peak - equity) / peak * 100 if peak > 0 else 0.0  # % of peak
        dd = min(dd, 100.0)  # Cap at 100%
        dd_usd = peak_usd - equity_usd
        max_dd = max(max_dd, dd)
        max_dd_usd = max(max_dd_usd, dd_usd)
        eq_times.append(t["time"][:10])
        eq_values.append(equity - 100.0)  # Convert to return % for frontend
        if t["pnl_pct"] <= 0:
            cur_consec += 1
            max_consec = max(max_consec, cur_consec)
        else:
            cur_consec = 0

    tp_count = sum(1 for t in all_trades if t["exit_reason"] == "tp")
    sl_count = sum(1 for t in all_trades if t["exit_reason"] == "sl")
    timeout_count = sum(1 for t in all_trades if t["exit_reason"] == "timeout")

    # Risk-adjusted metrics — annualized from daily PORTFOLIO returns
    # Use pnl_usd / initial_capital for proper capital-weighted daily returns
    from collections import defaultdict as dd_import
    daily_pnl = dd_import(float)
    for t in all_trades:
        day_key = t["exit_time"][:10]  # YYYY-MM-DD
        if day_key and day_key != "NaT" and len(day_key) == 10:
            daily_pnl[day_key] += t.get("pnl_usd", 0)
    # Fill zero-return days so Sharpe isn't inflated by excluding non-trading days
    if daily_pnl and len(daily_pnl) >= 2 and initial_capital > 0:
        from datetime import datetime as _dt_bt, timedelta as _td_bt
        sorted_days_bt = sorted(daily_pnl.keys())
        d_start_bt = _dt_bt.strptime(sorted_days_bt[0], "%Y-%m-%d")
        d_end_bt = _dt_bt.strptime(sorted_days_bt[-1], "%Y-%m-%d")
        all_days_bt = [(d_start_bt + _td_bt(days=i)).strftime("%Y-%m-%d") for i in range((d_end_bt - d_start_bt).days + 1)]
        daily_returns = np.array([daily_pnl.get(d, 0.0) for d in all_days_bt]) / initial_capital * 100
    elif daily_pnl and initial_capital > 0:
        daily_returns = np.array(list(daily_pnl.values())) / initial_capital * 100
    else:
        daily_returns = np.array([])

    if len(daily_returns) >= 5:
        dr_avg = float(np.mean(daily_returns))
        dr_std = float(np.std(daily_returns, ddof=1))
        bt_sharpe = round(dr_avg / dr_std * np.sqrt(365), 2) if dr_std > 0 else 0.0
        # TDD Sortino (Sortino & van der Meer 1991): sqrt(mean(min(r,0)^2)) over ALL N
        downside_bt = np.minimum(daily_returns, 0)
        tdd_bt = float(np.sqrt(np.mean(downside_bt ** 2)))
        bt_sortino = round(dr_avg / tdd_bt * np.sqrt(365), 2) if tdd_bt > 0 else 0.0
        # Calmar = CAGR / MDD (compound annualized growth rate — industry standard)
        # Use calendar days from daily_returns (already zero-filled) for accurate annualization
        n_days = len(daily_returns)
        growth_ratio_bt = equity / 100.0 if equity > 0 else 0.001
        years_bt = max(n_days, 1) / 365
        cagr_pct_bt = (growth_ratio_bt ** (1 / years_bt) - 1) * 100 if years_bt > 0 else 0.0
        bt_calmar = round(cagr_pct_bt / max_dd, 2) if max_dd > 0 else 0.0
        # VaR and CVaR (95% confidence, daily)
        var_95 = round(float(np.percentile(daily_returns, 5)), 4)
        tail = daily_returns[daily_returns <= var_95]
        cvar_95 = round(float(np.mean(tail)), 4) if len(tail) > 0 else var_95
    else:
        bt_sharpe, bt_sortino, bt_calmar = 0.0, 0.0, 0.0
        var_95, cvar_95 = 0.0, 0.0

    # --- DSR (Deflated Sharpe Ratio) ---
    # Returns probability [0,1] that true Sharpe > 0 after multiple-testing correction
    # (Lopez de Prado, 2014: "The Deflated Sharpe Ratio")
    deflated_sharpe = 0.0
    dsr_haircut_pct = 0.0
    if len(daily_returns) >= 10 and bt_sharpe > 0:
        n_dr = len(daily_returns)
        # Skewness and excess kurtosis (numpy-only, no scipy needed)
        dr_mean = float(np.mean(daily_returns))
        dr_s = float(np.std(daily_returns, ddof=1))
        if dr_s > 0:
            z = (daily_returns - dr_mean) / dr_s
            skw = float(np.mean(z**3) * n_dr / max((n_dr-1)*(n_dr-2), 1))  # adjusted skewness
            krt = float(np.mean(z**4) - 3)  # excess kurtosis
        else:
            skw, krt = 0.0, 0.0
        # Sharpe standard error with non-normality correction (Lo 2002)
        # Use DAILY Sharpe (not annualized) in SE formula
        daily_sharpe = dr_avg / dr_s if dr_s > 0 else 0.0
        # krt = excess kurtosis (k-3); SE formula needs (kurtosis-1)/4 = (krt+2)/4
        sr_se = np.sqrt((1 + 0.5 * daily_sharpe**2 - skw * daily_sharpe + ((krt + 2) / 4) * daily_sharpe**2) / max(n_dr - 1, 1))
        # Expected max Sharpe from n_trials strategies (daily scale)
        # Realistic: conditions^2 * 50 (combinatorial parameter search)
        n_cond = max(params.get("conditions_count", 1), 1)
        n_trials_est = max(n_cond ** 2 * 50, 100)
        gamma_em = 0.5772156649  # Euler-Mascheroni
        # Lopez de Prado (2014): E[max] ≈ sqrt(2*ln(N)) * (1 - γ/(ln(N))) + γ/sqrt(2*ln(N))
        # Denominator is ln(N), not 2*ln(N)
        ln_n = max(np.log(n_trials_est), 0.01)
        expected_max_sr = np.sqrt(2 * ln_n) * (1 - gamma_em / ln_n) + gamma_em / np.sqrt(2 * ln_n) if n_trials_est > 1 else 0
        z_dsr = (daily_sharpe - expected_max_sr) / max(sr_se, 0.001)
        # Convert to probability via normal CDF (proper DSR output)
        # Approximation: Phi(z) using Abramowitz & Stegun (no scipy needed)
        def _norm_cdf(x):
            """Standard normal CDF approximation (|error| < 7.5e-8)."""
            if x < -8:
                return 0.0
            if x > 8:
                return 1.0
            a = abs(x)
            t = 1.0 / (1.0 + 0.2316419 * a)
            d = 0.3989422804014327  # 1/sqrt(2*pi)
            p = d * np.exp(-0.5 * a * a) * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
            return 1.0 - p if x >= 0 else p
        deflated_sharpe = round(_norm_cdf(z_dsr), 4)  # Probability [0,1]
        # Haircut: % of reported Sharpe that may be data-mined
        dsr_haircut_pct = round((1 - deflated_sharpe) * 100, 1)

    # --- Monte Carlo Sign-Flip Test ---
    mc_p_value = 1.0
    mc_percentile = 50.0
    trade_pnls = [t["pnl_pct"] for t in all_trades]
    if len(trade_pnls) >= 10:
        rng = np.random.RandomState(42)
        pnl_arr = np.array(trade_pnls)
        original_return = float(np.sum(pnl_arr))
        n_sims = min(1000, max(200, len(trade_pnls) * 5))
        # Sign-flip: randomly negate each trade's PnL to test if direction matters
        signs = rng.choice([-1, 1], size=(n_sims, len(pnl_arr)))
        mc_returns = np.sum(signs * pnl_arr, axis=1)
        mc_percentile = round(float(np.mean(mc_returns <= original_return) * 100), 1)
        # One-sided p-value: how likely to see this return or better by chance
        mc_p_value = round(float(np.mean(mc_returns >= original_return)), 4)

    # --- Jensen's Alpha (risk-adjusted excess return vs BTC) ---
    jensens_alpha = 0.0

    # Yearly breakdown
    from collections import defaultdict
    yearly = defaultdict(lambda: {"wins": 0, "losses": 0, "gross_profit": 0.0, "gross_loss": 0.0, "total_pnl": 0.0})
    for tr in all_trades:
        year = int(tr["time"][:4])
        y = yearly[year]
        y["total_pnl"] += tr["pnl_pct"]
        if tr["pnl_pct"] > 0:
            y["wins"] += 1
            y["gross_profit"] += tr["pnl_pct"]
        else:
            y["losses"] += 1
            y["gross_loss"] += abs(tr["pnl_pct"])

    yearly_stats = []
    for year in sorted(yearly.keys()):
        y = yearly[year]
        ytotal = y["wins"] + y["losses"]
        yearly_stats.append(YearlyStat(
            year=year,
            trades=ytotal,
            wins=y["wins"],
            win_rate=round(y["wins"] / ytotal * 100, 1) if ytotal > 0 else 0,
            total_return_pct=round(y["total_pnl"], 2),
            profit_factor=round(y["gross_profit"] / y["gross_loss"], 2) if y["gross_loss"] > 0 else (999.99 if y["gross_profit"] > 0 else 0.0),
        ))

    total_funding = sum(t.get('funding_pct', 0) for t in all_trades)

    # --- Monthly stats ---
    from collections import defaultdict as _dd
    monthly = _dd(lambda: {"wins": 0, "losses": 0, "gross_profit": 0.0, "gross_loss": 0.0, "total_pnl": 0.0})
    for tr in all_trades:
        month_key = tr["time"][:7]  # "YYYY-MM"
        m = monthly[month_key]
        m["total_pnl"] += tr["pnl_pct"]
        if tr["pnl_pct"] > 0:
            m["wins"] += 1
            m["gross_profit"] += tr["pnl_pct"]
        else:
            m["losses"] += 1
            m["gross_loss"] += abs(tr["pnl_pct"])

    monthly_stats = []
    for month_key in sorted(monthly.keys()):
        m = monthly[month_key]
        mtotal = m["wins"] + m["losses"]
        monthly_stats.append(MonthlyStat(
            month=month_key,
            trades=mtotal,
            wins=m["wins"],
            win_rate=round(m["wins"] / mtotal * 100, 1) if mtotal > 0 else 0,
            total_return_pct=round(m["total_pnl"], 2),
            profit_factor=round(m["gross_profit"] / m["gross_loss"], 2) if m["gross_loss"] > 0 else (999.99 if m["gross_profit"] > 0 else 0.0),
        ))

    # --- Trade duration stats ---
    bars_list = [t["bars_held"] for t in all_trades]
    avg_bars_held = round(sum(bars_list) / len(bars_list), 1) if bars_list else 0.0
    sorted_bars = sorted(bars_list)
    median_bars_held = float(sorted_bars[len(sorted_bars) // 2]) if sorted_bars else 0.0

    # --- PnL distribution histogram (1% buckets from -10% to +10%) ---
    pnl_buckets = [f"{i}%" for i in range(-10, 11)]
    pnl_distribution = [0] * 21  # 21 buckets: -10 to +10
    for t in all_trades:
        bucket = int(round(t["pnl_pct"]))
        bucket = max(-10, min(10, bucket))  # clamp
        pnl_distribution[bucket + 10] += 1

    # --- Additional risk metrics ---
    win_rate_dec = len(wins) / len(all_trades) if all_trades else 0
    expectancy = round(win_rate_dec * avg_win + (1 - win_rate_dec) * avg_loss, 4)
    recovery_factor = round(total_return / max_dd, 2) if max_dd > 0 else 0.0
    payoff_ratio = round(abs(avg_win / avg_loss), 2) if avg_loss != 0 else 0.0

    # --- Benchmark returns (BTC + ETH buy-and-hold) ---
    btc_hold_return_pct = 0.0
    eth_hold_return_pct = 0.0
    def _calc_hold_return(symbol):
        try:
            sym_data = data_manager.get_symbols([symbol])
            if sym_data:
                _, sym_df = sym_data[0]
                sym_df = filter_df_by_date(sym_df, getattr(req, 'start_date', None), getattr(req, 'end_date', None))
                if len(sym_df) >= 2:
                    s = float(sym_df.iloc[0]["close"])
                    e = float(sym_df.iloc[-1]["close"])
                    if s > 0:
                        return round((e - s) / s * 100, 2)
        except Exception as exc:
            logger.warning("hold_return calc failed for %s: %s", symbol, exc)
        return 0.0
    btc_hold_return_pct = _calc_hold_return("BTCUSDT")
    eth_hold_return_pct = _calc_hold_return("ETHUSDT")

    # Jensen's Alpha: strategy excess return vs benchmark (BTC), risk-adjusted
    # Alpha = R_strategy - [Rf + Beta * (R_market - Rf)]
    if btc_hold_return_pct != 0 and len(all_trades) >= 10:
        if len(daily_returns) >= 10:
            try:
                btc_data = data_manager.get_symbols(["BTCUSDT"])
                if btc_data:
                    _, btc_df = btc_data[0]
                    btc_df = filter_df_by_date(btc_df, getattr(req, 'start_date', None), getattr(req, 'end_date', None))
                    # Build BTC daily return dict: "YYYY-MM-DD" → pct_change
                    btc_closes = {}
                    for _, row in btc_df.iterrows():
                        ts = str(row.get('timestamp', ''))[:10] if 'timestamp' in row.index else str(row.name)[:10]
                        btc_closes[ts] = float(row['close'])
                    btc_dates = sorted(btc_closes.keys())
                    btc_daily_dict = {}
                    for i in range(1, len(btc_dates)):
                        prev_c = btc_closes[btc_dates[i-1]]
                        curr_c = btc_closes[btc_dates[i]]
                        if prev_c > 0:
                            btc_daily_dict[btc_dates[i]] = (curr_c - prev_c) / prev_c * 100
                    # Align strategy + BTC daily returns
                    strat_daily_dict = dict(daily_pnl)
                    common = sorted(set(strat_daily_dict.keys()) & set(btc_daily_dict.keys()))
                    if len(common) >= 10:
                        s_ret = np.array([strat_daily_dict[d] for d in common])
                        b_ret = np.array([btc_daily_dict[d] for d in common])
                        if np.std(b_ret) > 0:
                            beta = float(np.cov(s_ret, b_ret)[0, 1] / np.var(b_ret))
                            rf_daily = 5.0 / 365  # ~5% annual risk-free rate (T-bill proxy)
                            jensens_alpha = round(float(np.mean(s_ret) - rf_daily - beta * (np.mean(b_ret) - rf_daily)), 4)
                        else:
                            jensens_alpha = round(total_return - btc_hold_return_pct, 2)
                    else:
                        jensens_alpha = round(total_return - btc_hold_return_pct, 2)
            except Exception:
                jensens_alpha = round(total_return - btc_hold_return_pct, 2)
        else:
            jensens_alpha = round(total_return - btc_hold_return_pct, 2)

    # --- Statistical significance (binomial test) — must run before grade ---
    hasBreakeven = abs(avg_win) > 0 and abs(avg_loss) > 0
    edge_p_value = 1.0
    if len(all_trades) >= 10 and hasBreakeven:
        try:
            from scipy.stats import binomtest
            be_wr = abs(avg_loss) / (abs(avg_win) + abs(avg_loss)) if (abs(avg_win) + abs(avg_loss)) > 0 else 0.5
            result_binom = binomtest(len(wins), len(all_trades), be_wr, alternative='greater')
            edge_p_value = round(result_binom.pvalue, 4)
        except ImportError:
            n = len(all_trades)
            be_wr_val = abs(avg_loss) / (abs(avg_win) + abs(avg_loss)) if (abs(avg_win) + abs(avg_loss)) > 0 else 0.5
            observed_wr = len(wins) / n
            z = (observed_wr - be_wr_val) / max((be_wr_val * (1 - be_wr_val) / n) ** 0.5, 1e-9)
            # Standard normal CDF approximation (Abramowitz & Stegun, |error| < 7.5e-8)
            def _norm_cdf_fallback(x):
                if x < -8: return 0.0
                if x > 8: return 1.0
                a = abs(x)
                t = 1.0 / (1.0 + 0.2316419 * a)
                d = 0.3989422804014327
                p = d * np.exp(-0.5 * a * a) * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
                return 1.0 - p if x >= 0 else p
            edge_p_value = round(1.0 - _norm_cdf_fallback(z), 4) if z > 0 else 1.0
        except Exception as exc:
            logger.warning("p-value calculation failed: %s", exc)

    # --- Strategy grade (7 dimensions, max 16 points) ---
    pf = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (999.99 if gross_profit > 0 else 0.0)
    wr = round(len(wins) / len(all_trades) * 100, 2) if all_trades else 0
    mdd = round(max_dd, 2)
    grade_score = 0
    # PF (0-3)
    if pf >= 2.0: grade_score += 3
    elif pf >= 1.5: grade_score += 2
    elif pf >= 1.0: grade_score += 1
    # WR (0-3) — relative to break-even WR
    be_wr_grade = abs(avg_loss) / (abs(avg_win) + abs(avg_loss)) * 100 if (abs(avg_win) + abs(avg_loss)) > 0 else 50.0
    wr_margin = wr - be_wr_grade  # how much WR exceeds break-even
    if wr_margin >= 15: grade_score += 3
    elif wr_margin >= 8: grade_score += 2
    elif wr_margin >= 2: grade_score += 1
    # MDD (0-2) — capital-relative (leverage-adjusted)
    capital_mdd = max_dd_usd / initial_capital * 100 if initial_capital > 0 else mdd
    if capital_mdd < 20: grade_score += 2
    elif capital_mdd < 40: grade_score += 1
    # RF (0-2)
    if recovery_factor >= 3: grade_score += 2
    elif recovery_factor >= 1.5: grade_score += 1
    # Sharpe (0-2)
    if bt_sharpe >= 2.0: grade_score += 2
    elif bt_sharpe >= 1.0: grade_score += 1
    # Expectancy (0-2)
    if expectancy >= 0.5: grade_score += 2
    elif expectancy > 0: grade_score += 1
    # Statistical Edge (0-2) — combines p-value + MC
    if edge_p_value < 0.01 and mc_p_value < 0.05: grade_score += 2
    elif edge_p_value < 0.05 or mc_p_value < 0.10: grade_score += 1

    if grade_score >= 14: strategy_grade = "A+"
    elif grade_score >= 12: strategy_grade = "A"
    elif grade_score >= 9: strategy_grade = "B"
    elif grade_score >= 6: strategy_grade = "C"
    elif grade_score >= 3: strategy_grade = "D"
    else: strategy_grade = "F"

    grade_details = f"PF={pf} WR={wr}%(BE:{be_wr_grade:.0f}%) MDD={capital_mdd:.1f}% RF={recovery_factor} Sharpe={bt_sharpe} E={expectancy} Score={grade_score}/16"

    # --- Warnings ---
    warnings = []
    # Liquidation risk: leverage × SL > 100% means potential total loss
    # sl_pct in params is already percentage (e.g. 10.0 = 10%), not decimal
    sl_pct_val = float(params.get("sl_pct", params.get("sl", 10.0)))
    liq_risk = leverage_val * sl_pct_val
    if liq_risk > 100:
        warnings.append(f"⚠ Liquidation risk: {leverage_val}x leverage × {sl_pct_val:.0f}% SL = {liq_risk:.0f}% capital at risk (>100%). Consider reducing leverage or SL.")
    if mdd > 20:
        warnings.append(f"High drawdown: {mdd:.1f}%. With {leverage_val}x leverage, real capital loss could reach {mdd * leverage_val / 100 * 100:.0f}%.")
    if len(all_trades) < 30:
        warnings.append(f"Low sample size: {len(all_trades)} trades. Results may not be statistically reliable.")
    if len(all_trades) < 100 and len(all_trades) >= 30:
        warnings.append(f"Moderate sample size: {len(all_trades)} trades. Consider expanding the test period or adding more coins for robust statistics (recommended: 100+).")
    if pf > 3.0 and len(all_trades) > 50:
        warnings.append("Very high Profit Factor may indicate overfitting. Run OOS validation to verify.")
    if bt_sharpe > 3.0 and len(all_trades) >= 30:
        warnings.append(f"Sharpe Ratio {bt_sharpe:.2f} is unusually high (>3.0). This often indicates overfitting or look-ahead bias. Verify with out-of-sample testing.")
    if btc_hold_return_pct > 0 and total_return < btc_hold_return_pct:
        warnings.append(f"Strategy underperforms BTC buy-and-hold ({btc_hold_return_pct:.1f}%) over the same period.")
    if edge_p_value > 0.05 and len(all_trades) >= 30:
        warnings.append(f"Strategy edge not statistically significant (p={edge_p_value:.3f}). Win rate may not be reliably above break-even.")
    if deflated_sharpe < 0.5 and bt_sharpe > 0.5 and deflated_sharpe > 0:
        warnings.append(f"Deflated Sharpe Ratio is low ({deflated_sharpe:.1%}). Only {deflated_sharpe:.0%} probability the Sharpe ({bt_sharpe:.2f}) survives multiple-testing correction.")
    if jensens_alpha < 0 and len(all_trades) >= 30:
        warnings.append(f"Negative Jensen's Alpha ({jensens_alpha:.2f}%). Strategy underperforms benchmark on risk-adjusted basis.")
    if mc_p_value > 0.10 and len(all_trades) >= 30:
        warnings.append(f"Monte Carlo test: strategy return not significantly better than random (p={mc_p_value:.3f}).")
    if len(all_trades) >= 10:
        warnings.append("Survivorship bias: only currently listed assets are tested. Delisted coins are excluded, which may affect results.")

    # Holding period warning: timeframe × max_bars
    tf_hours = {"1H": 1, "2H": 2, "4H": 4, "6H": 6, "12H": 12, "1D": 24, "1W": 168}
    tf_str = getattr(req, 'timeframe', '1H') or '1H'
    tf_h = tf_hours.get(tf_str.upper(), 1)
    max_bars_val = int(getattr(req, 'max_bars', 48))
    hold_hours = tf_h * max_bars_val
    if hold_hours > 168:  # > 1 week
        warnings.append(f"Max holding period: {tf_str} x {max_bars_val} bars = {hold_hours}h ({hold_hours/24:.0f} days). Long holding periods increase exposure to market risk and funding costs.")
    if _missing_symbols:
        warnings.append(f"Symbols not found (skipped): {', '.join(_missing_symbols[:10])}{'...' if len(_missing_symbols) > 10 else ''}. These coins may be delisted or unavailable.")

    # --- Anchored Walk-Forward Consistency (IS grows, OOS slides) ---
    walk_forward_consistency = 0.0
    walk_forward_details = ""
    if len(all_trades) >= 50:
        def _wf_metrics(tlist):
            w = [t for t in tlist if t["pnl_pct"] > 0]
            l = [t for t in tlist if t["pnl_pct"] <= 0]
            _wr = len(w) / len(tlist) * 100 if tlist else 0
            gp = sum(t["pnl_pct"] for t in w) if w else 0
            gl = abs(sum(t["pnl_pct"] for t in l)) if l else 0
            _pf = gp / gl if gl > 0 else 999.99
            return _wr, _pf
        # 5 rolling windows: each uses 60% IS, 40% OOS
        n = len(all_trades)
        n_windows = 5
        window_size = n // n_windows
        wf_ratios = []
        wf_window_details = []
        for i in range(n_windows - 1):
            # IS = windows 0..i, OOS = window i+1
            is_end = (i + 1) * window_size
            oos_start = is_end
            oos_end = min(oos_start + window_size, n)
            is_trades = all_trades[:is_end]
            oos_trades = all_trades[oos_start:oos_end]
            if len(oos_trades) < 5:
                continue
            is_wr, is_pf = _wf_metrics(is_trades)
            oos_wr, oos_pf = _wf_metrics(oos_trades)
            wr_r = min(oos_wr / max(is_wr, 0.01), 2.0)
            pf_r = min(oos_pf / max(is_pf, 0.01), 2.0)
            ratio = (wr_r + pf_r) / 2
            wf_ratios.append(ratio)
            wf_window_details.append(f"W{i+1}: IS WR={is_wr:.0f}% PF={is_pf:.1f} → OOS WR={oos_wr:.0f}% PF={oos_pf:.1f} ({ratio:.2f})")
        if wf_ratios:
            walk_forward_consistency = round(sum(wf_ratios) / len(wf_ratios), 2)
            walk_forward_details = " | ".join(wf_window_details)
            if walk_forward_consistency < 0.7:
                warnings.append(f"Walk-forward degradation detected ({walk_forward_consistency:.2f}). OOS performance significantly worse than IS.")

    # --- Market Regime Performance Split ---
    regime_performance = None
    try:
        btc_data = None
        btc_list = data_manager.get_symbols(["BTCUSDT"])
        btc_data = btc_list[0][1] if btc_list else None
        if btc_data is not None and len(btc_data) > 50:
            btc_close = btc_data["close"].values.astype(float)
            btc_dates = btc_data["timestamp"].astype(str).values
            # SMA20 and SMA50
            sma20 = pd.Series(btc_close).rolling(20).mean().values
            sma50 = pd.Series(btc_close).rolling(50).mean().values
            # Build date->regime map
            regime_map = {}
            for i in range(50, len(btc_data)):
                d = btc_dates[i][:10]
                if sma20[i] > sma50[i] and btc_close[i] > sma20[i]:
                    regime_map[d] = "bull"
                elif sma20[i] < sma50[i] and btc_close[i] < sma20[i]:
                    regime_map[d] = "bear"
                else:
                    regime_map[d] = "sideways"
            # Classify trades
            regime_trades = {"bull": [], "bear": [], "sideways": []}
            for t in all_trades:
                trade_date = t["time"][:10]
                regime = regime_map.get(trade_date, "sideways")
                regime_trades[regime].append(t)
            # Build metrics per regime
            def _regime_metrics(trades_list):
                if not trades_list:
                    return {"trades": 0, "win_rate": 0.0, "total_return": 0.0, "profit_factor": 0.0, "avg_pnl": 0.0}
                w = [t for t in trades_list if t["pnl_pct"] > 0]
                l = [t for t in trades_list if t["pnl_pct"] <= 0]
                gp = sum(t["pnl_pct"] for t in w) if w else 0.0
                gl = abs(sum(t["pnl_pct"] for t in l)) if l else 0
                return {
                    "trades": len(trades_list),
                    "win_rate": round(len(w) / len(trades_list) * 100, 2),
                    "total_return": round(sum(t["pnl_pct"] for t in trades_list), 2),
                    "profit_factor": round(gp / gl, 2) if gl > 0 else (999.99 if gp > 0 else 0.0),
                    "avg_pnl": round(sum(t["pnl_pct"] for t in trades_list) / len(trades_list), 4),
                }
            regime_performance = {
                "bull": _regime_metrics(regime_trades["bull"]),
                "bear": _regime_metrics(regime_trades["bear"]),
                "sideways": _regime_metrics(regime_trades["sideways"]),
            }
    except Exception as e:
        logger.warning(f"Regime performance calculation failed: {e}")
        regime_performance = None

    compute_ms = int((time.time() - t_start) * 1000)

    # Build trade items for response (cap at 500)
    trade_items = [
        TradeItem(
            symbol=t["symbol"],
            direction=t["direction"],
            entry_time=t["entry_time"],
            exit_time=t["exit_time"],
            entry_price=round(t["entry_price"], 6),
            exit_price=round(t["exit_price"], 6),
            pnl_pct=round(t["pnl_pct"], 4),
            pnl_usd=round(t.get("pnl_usd", 0), 4),
            exit_reason=t["exit_reason"],
            bars_held=t["bars_held"],
        )
        for t in all_trades[:500]
    ]

    response = BacktestResponse(
        name=req.name,
        direction=req.direction,
        sl_pct=req.sl_pct,
        tp_pct=req.tp_pct,
        max_bars=req.max_bars,
        indicators_used=params["indicators"],
        conditions_count=params["conditions_count"],
        total_trades=len(all_trades),
        wins=len(wins),
        losses=len(losses),
        win_rate=round(len(wins) / len(all_trades) * 100, 2),
        total_return_pct=round(total_return, 2),
        profit_factor=round(gross_profit / gross_loss, 2) if gross_loss > 0 else (999.99 if gross_profit > 0 else 0.0),
        avg_win_pct=round(avg_win, 4),
        avg_loss_pct=round(avg_loss, 4),
        max_drawdown_pct=round(max_dd, 2),
        max_consecutive_losses=max_consec,
        tp_count=tp_count,
        sl_count=sl_count,
        timeout_count=timeout_count,
        total_funding_pct=round(total_funding, 2),
        sharpe_ratio=bt_sharpe,
        sortino_ratio=bt_sortino,
        calmar_ratio=bt_calmar,
        coins_used=len(coin_list),
        data_range=data_manager.data_range(),
        equity_curve=downsample_equity(eq_times, eq_values),
        is_valid=True,
        validation_errors=[],
        coin_results=[cr.model_dump() for cr in coin_results],
        trades=trade_items,
        compounding=is_compounding,
        per_coin_usd=per_coin_usd,
        leverage=leverage_val,
        initial_capital_usd=round(initial_capital, 2),
        total_return_usd=round(total_pnl_usd, 2),
        total_return_pct_portfolio=portfolio_return_pct,
        max_drawdown_usd=round(max_dd_usd, 2),
        yearly_stats=yearly_stats,
        compute_time_ms=compute_ms,
        expectancy=expectancy,
        recovery_factor=recovery_factor,
        payoff_ratio=payoff_ratio,
        btc_hold_return_pct=btc_hold_return_pct,
        eth_hold_return_pct=eth_hold_return_pct,
        var_95=var_95,
        cvar_95=cvar_95,
        strategy_grade=strategy_grade,
        grade_details=grade_details,
        edge_p_value=edge_p_value,
        warnings=warnings,
        walk_forward_consistency=walk_forward_consistency,
        walk_forward_details=walk_forward_details,
        deflated_sharpe=deflated_sharpe,
        dsr_haircut_pct=dsr_haircut_pct,
        mc_p_value=mc_p_value,
        mc_percentile=mc_percentile,
        jensens_alpha=jensens_alpha,
        avg_bars_held=avg_bars_held,
        median_bars_held=median_bars_held,
        monthly_stats=monthly_stats,
        positions_skipped=skipped,
        pnl_distribution=pnl_distribution,
        pnl_buckets=pnl_buckets,
        regime_performance=regime_performance,
    )

    # Cache the result
    set_cached(bt_key, response.model_dump())

    return response


@app.post("/backtest", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest):
    """
    Run a custom strategy backtest using the ConditionEngine.
    This is the core Strategy Builder endpoint.
    """
    if data_manager.coin_count == 0:
        raise HTTPException(503, "Data not loaded yet. Try again shortly.")

    # Normalize direction to lowercase
    if req.direction:
        req.direction = req.direction.lower()

    # Cache lookup (fast path — keep in event loop)
    bt_key = backtest_cache_key(req)
    cached = get_cached(bt_key)
    if cached is not None:
        return cached

    # CPU-bound work → thread (prevents event loop blocking)
    return await asyncio.to_thread(_run_backtest_sync, req, bt_key)


# --- Export Endpoints ---

_export_cache = {}
_MAX_EXPORT = 50


def store_export(trades_list: list) -> str:
    """Store trades for CSV export, return hash key."""
    raw = json.dumps(trades_list, sort_keys=True, default=str)
    h = hashlib.md5(raw.encode()).hexdigest()
    _export_cache[h] = trades_list
    if len(_export_cache) > _MAX_EXPORT:
        oldest = next(iter(_export_cache))
        del _export_cache[oldest]
    return h


@app.get("/export/csv")
async def export_csv(hash: str):
    """Download backtest results as CSV."""
    if hash not in _export_cache:
        raise HTTPException(404, "Result not found. Run a backtest first.")
    trades = _export_cache[hash]
    import io
    import csv
    from fastapi.responses import StreamingResponse
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "symbol", "direction", "entry_time", "exit_time",
        "entry_price", "exit_price", "pnl_pct", "exit_reason", "bars_held"
    ])
    for t in trades:
        writer.writerow([
            t.get("symbol", ""), t.get("direction", ""),
            t.get("entry_time", ""), t.get("exit_time", ""),
            t.get("entry_price", ""), t.get("exit_price", ""),
            t.get("pnl_pct", ""), t.get("exit_reason", ""),
            t.get("bars_held", ""),
        ])
    output.seek(0)
    filename = f"pruviq_backtest_{hash[:8]}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ---------------------------------------------------------------------------
# Daily Rankings
# ---------------------------------------------------------------------------

RANKING_DIR = "/Users/jepo/Desktop/autotrader/data/daily_rankings"

_rankings_cache: dict = {}
_RANKINGS_CACHE_TTL = 60


def _get_daily_rankings_sync(
    date: Optional[str],
    period: str,
    group: str,
) -> dict:
    VALID_PERIODS = {"7d", "30d", "365d"}
    VALID_GROUPS = {"top30", "top50", "top100", "btc"}

    # Normalise inputs
    period = period.lower()
    group = group.lower()
    if period not in VALID_PERIODS:
        period = "30d"
    if group not in VALID_GROUPS:
        group = "top50"

    ranking_dir = Path(RANKING_DIR)

    # Resolve target filename
    if date is None:
        date = datetime.now(timezone.utc).strftime("%Y%m%d")

    # Validate date format (YYYYMMDD digits only — prevent path traversal)
    if date and (not date.isdigit() or len(date) != 8):
        raise HTTPException(400, "Invalid date format. Use YYYYMMDD.")

    target_file = ranking_dir / f"ranking_{date}.json"

    # Fallback to most-recent file if requested date not found
    if not target_file.exists():
        candidates = sorted(ranking_dir.glob("ranking_*.json"), reverse=True)
        if not candidates:
            raise HTTPException(404, "No ranking data available.")
        target_file = candidates[0]
        # Extract actual date from filename
        date = target_file.stem.replace("ranking_", "")

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except Exception as e:
        logger.error(f"Failed to read ranking file {date}: {e}")
        raise HTTPException(500, "Failed to read ranking data.")

    generated_at = raw.get("generated_at", raw.get("date", ""))
    # Normalise date to YYYY-MM-DD display format
    try:
        display_date = datetime.strptime(date, "%Y%m%d").strftime("%Y-%m-%d")
    except ValueError:
        display_date = date

    # Walk-Forward 검증 실패 전략 제외 (구조적 손실 확인 2026-03-14)
    WF_FAILED_KEYS = {
        ("mean-reversion", "short", "4H"),
        ("mean-reversion", "short", "6H"),
        ("rsi-divergence", "long",  "4H"),
    }

    # ── Resolve entry list: new 'periods' key → fallback 'results' ──
    all_entries: list = []
    periods_data = raw.get("periods", {})
    if periods_data and period in periods_data and group in periods_data[period]:
        # New format: periods.{period}.{group} → list of entries
        all_entries = periods_data[period][group]
    elif periods_data and period in periods_data:
        # Period exists but requested group doesn't — try nearest group in same period
        # Order: top50 > top30 > top100 > btc
        fallback_order = ["top50", "top30", "top100", "btc"]
        period_groups = periods_data[period]
        for fg in fallback_order:
            if fg in period_groups and period_groups[fg]:
                all_entries = period_groups[fg]
                break
    elif not periods_data:
        # Legacy file: flatten all sections from 'results'
        results = raw.get("results", {})
        for section_entries in results.values():
            if isinstance(section_entries, list):
                all_entries.extend(section_entries)
    # else: period not found at all → all_entries stays empty

    # De-duplicate by (strategy, direction, timeframe) and filter WF failures
    seen: set = set()
    unique_entries: list = []
    for e in all_entries:
        key = (e.get("strategy"), e.get("direction"), e.get("timeframe", "1H"))
        if key in WF_FAILED_KEYS:
            continue
        if key not in seen:
            seen.add(key)
            unique_entries.append(e)

    # Filter out 0-trade entries (no data = not meaningful for ranking)
    unique_entries = [e for e in unique_entries if e.get("total_trades", 0) > 0]

    # Rank by profit_factor desc (then win_rate as tiebreaker)
    ranked = sorted(
        unique_entries,
        key=lambda x: (x.get("profit_factor", 0), x.get("win_rate", 0)),
        reverse=True,
    )

    # ── rank_change: compare today's ranks to yesterday (same period/group) ──
    yesterday_date = (datetime.strptime(date, "%Y%m%d") - timedelta(days=1)).strftime("%Y%m%d")
    yesterday_file = ranking_dir / f"ranking_{yesterday_date}.json"
    yesterday_rank_map: dict = {}
    if yesterday_file.exists():
        try:
            with open(yesterday_file, "r", encoding="utf-8") as f:
                yraw = json.load(f)
            yentries: list = []
            yperiods = yraw.get("periods", {})
            if yperiods and period in yperiods and group in yperiods[period]:
                yentries = yperiods[period][group]
            else:
                for section_entries in yraw.get("results", {}).values():
                    if isinstance(section_entries, list):
                        yentries.extend(section_entries)
            seen_y: set = set()
            yuniq: list = []
            for e in yentries:
                k = (e.get("strategy"), e.get("direction"), e.get("timeframe", "1H"))
                if k not in WF_FAILED_KEYS and k not in seen_y and e.get("total_trades", 0) > 0:
                    seen_y.add(k)
                    yuniq.append(e)
            yranked = sorted(yuniq, key=lambda x: (x.get("profit_factor", 0), x.get("win_rate", 0)), reverse=True)
            for i, e in enumerate(yranked):
                k = (e.get("strategy"), e.get("direction"), e.get("timeframe", "1H"))
                yesterday_rank_map[k] = i + 1
        except Exception as exc:
            logger.warning("yesterday ranking load failed: %s", exc)

    # ── streak: consecutive days in Top N ────────────────────────
    top_n_keys = {(e.get("strategy"), e.get("direction"), e.get("timeframe", "1H")) for e in ranked[:10]}
    streak_map: dict = {}
    for strat_key in top_n_keys:
        count = 0
        for i in range(7):
            day = (datetime.strptime(date, "%Y%m%d") - timedelta(days=i)).strftime("%Y%m%d")
            day_file = ranking_dir / f"ranking_{day}.json"
            if not day_file.exists():
                break
            try:
                with open(day_file, "r", encoding="utf-8") as f:
                    draw = json.load(f)
                dentries: list = []
                dperiods = draw.get("periods", {})
                if dperiods and period in dperiods and group in dperiods[period]:
                    dentries = dperiods[period][group]
                else:
                    for section_entries in draw.get("results", {}).values():
                        if isinstance(section_entries, list):
                            dentries.extend(section_entries)
                dseen: set = set()
                duniq: list = []
                for e in dentries:
                    k = (e.get("strategy"), e.get("direction"), e.get("timeframe", "1H"))
                    if k not in WF_FAILED_KEYS and k not in dseen and e.get("total_trades", 0) > 0:
                        dseen.add(k)
                        duniq.append(e)
                dranked = sorted(duniq, key=lambda x: (x.get("profit_factor", 0), x.get("win_rate", 0)), reverse=True)
                top10_keys = {(e.get("strategy"), e.get("direction"), e.get("timeframe", "1H")) for e in dranked[:10]}
                if strat_key in top10_keys:
                    count += 1
                else:
                    break
            except Exception:
                break
        streak_map[strat_key] = count

    def _make_entry(e: dict, rank: int) -> dict:
        trades = e.get("total_trades", 0)
        strat_key = (e.get("strategy"), e.get("direction"), e.get("timeframe", "1H"))
        yrank = yesterday_rank_map.get(strat_key)
        rank_change = (yrank - rank) if yrank is not None else None  # positive = improved
        return {
            "rank": rank,
            "name_ko": e.get("category_ko", e.get("strategy", "")),
            "name_en": e.get("category_en", e.get("strategy", "")),
            "strategy": e.get("strategy", ""),
            "direction": e.get("direction", ""),
            "win_rate": round(e.get("win_rate", 0), 2),
            "profit_factor": min(round(e.get("profit_factor", 0), 2), 99.99),  # cap sentinel 999.99
            "total_return": round(e.get("total_return", 0), 2),
            "total_trades": trades,
            "sharpe": round(e.get("sharpe", 0), 2),
            "max_drawdown": round(e.get("max_drawdown", 0), 2),
            "timeframe": e.get("timeframe", "1H"),
            "sl_pct": e.get("sl_pct"),
            "tp_pct": e.get("tp_pct"),
            "low_sample": trades < 100,
            "rank_change": rank_change,
            "streak": streak_map.get(strat_key, 1),
        }

    top3 = [_make_entry(e, i + 1) for i, e in enumerate(ranked[:3])]
    worst3 = [_make_entry(e, i + 1) for i, e in enumerate(reversed(ranked[-3:]))]

    # Summary stats
    wr_50plus = sum(1 for e in unique_entries if e.get("win_rate", 0) >= 50)
    total = len(unique_entries)

    # ── Detect available periods/groups from file ────────────────
    available_periods: list = []
    available_groups: list = []
    if periods_data:
        available_periods = sorted(periods_data.keys())
        all_groups: set = set()
        for pg in periods_data.values():
            all_groups.update(pg.keys())
        # Canonical order
        order = ["top30", "top50", "top100", "btc"]
        available_groups = [g for g in order if g in all_groups]
    if not available_periods:
        available_periods = ["30d"]
    if not available_groups:
        available_groups = ["top50"]

    # Collect weekly best: scan last 7 days of ranking files (same period/group)
    weekly_map: dict = {}
    for i in range(7):
        day = (datetime.strptime(date, "%Y%m%d") - timedelta(days=i)).strftime("%Y%m%d")
        day_file = ranking_dir / f"ranking_{day}.json"
        if not day_file.exists():
            continue
        try:
            with open(day_file, "r", encoding="utf-8") as f:
                day_raw = json.load(f)
            day_entries: list = []
            dp = day_raw.get("periods", {})
            if dp and period in dp and group in dp[period]:
                day_entries = dp[period][group]
            else:
                day_results = day_raw.get("results", {})
                for section_entries in day_results.values():
                    if isinstance(section_entries, list):
                        day_entries.extend(section_entries)
            for e in day_entries:
                key = (e.get("strategy"), e.get("direction"), e.get("timeframe", "1H"))
                if key in WF_FAILED_KEYS:
                    continue
                if key not in weekly_map:
                    weekly_map[key] = {"entries": [], "meta": e}
                weekly_map[key]["entries"].append(e)
        except Exception:
            continue

    weekly_best3: list = []
    if weekly_map:
        weekly_agg = []
        for key, data in weekly_map.items():
            entries = data["entries"]
            meta = data["meta"]
            avg_pf = sum(e.get("profit_factor", 0) for e in entries) / len(entries)
            avg_wr = sum(e.get("win_rate", 0) for e in entries) / len(entries)
            weekly_agg.append({
                "key": key,
                "avg_pf": avg_pf,
                "avg_wr": avg_wr,
                "days": len(entries),
                "meta": meta,
            })
        weekly_agg.sort(key=lambda x: (x["avg_pf"], x["avg_wr"]), reverse=True)
        for i, item in enumerate(weekly_agg[:3]):
            meta = item["meta"]
            trades = meta.get("total_trades", 0)
            weekly_best3.append({
                "rank": i + 1,
                "name_ko": meta.get("category_ko", meta.get("strategy", "")),
                "name_en": meta.get("category_en", meta.get("strategy", "")),
                "strategy": meta.get("strategy", ""),
                "direction": meta.get("direction", ""),
                "win_rate": round(item["avg_wr"], 2),
                "profit_factor": min(round(item["avg_pf"], 2), 99.99),  # cap sentinel/low-sample extremes
                "total_return": round(meta.get("total_return", 0), 2),
                "total_trades": trades,
                "sharpe": round(meta.get("sharpe", 0), 2),
                "max_drawdown": round(meta.get("max_drawdown", 0), 2),
                "timeframe": meta.get("timeframe", "1H"),
                "days_in_top": item["days"],
                "low_sample": trades < 100,
            })

    low_sample_count = sum(1 for e in unique_entries if e.get("total_trades", 0) < 100)

    return {
        "date": display_date,
        "generated_at": generated_at,
        "period": period,
        "group": group,
        "top3": top3,
        "worst3": worst3,
        "weekly_best3": weekly_best3,
        "summary": {"wr_50plus": wr_50plus, "total": total},
        "low_sample_count": low_sample_count if low_sample_count > 0 else None,
        "available_periods": available_periods,
        "available_groups": available_groups,
    }


@app.get("/rankings/daily")
async def get_daily_rankings(
    date: Optional[str] = None,
    period: str = "30d",
    group: str = "top50",
):
    """Return daily strategy rankings from pre-computed JSON files."""
    cache_key = (date, period, group)
    cached = _rankings_cache.get(cache_key)
    if cached and (time.time() - cached[1]) < _RANKINGS_CACHE_TTL:
        return cached[0]
    result = await asyncio.to_thread(_get_daily_rankings_sync, date, period, group)
    _rankings_cache[cache_key] = (result, time.time())
    if len(_rankings_cache) > 50:
        oldest_key = min(_rankings_cache, key=lambda k: _rankings_cache[k][1])
        _rankings_cache.pop(oldest_key, None)
    return result


# ── OG Image Generation ──────────────────────────────────────────────
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

_og_cache: dict = {}
_OG_CACHE_MAX = 200


@app.get("/og")
async def generate_og_image(
    strategy: str = "bb-squeeze-short",
    dir: str = "short",
    wr: float = 0,
    pf: float = 0,
    ret: float = 0,
    trades: int = 0,
    mdd: float = 0,
):
    """Generate a 1200x630 OG image with strategy metrics."""
    cache_key = f"{strategy}_{dir}_{wr}_{pf}_{ret}_{trades}_{mdd}"
    if cache_key in _og_cache:
        return Response(
            content=_og_cache[cache_key],
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    W, H = 1200, 630
    bg_color = (9, 9, 11)
    accent = (0, 229, 255)
    white = (255, 255, 255)
    muted = (160, 160, 170)
    green = (34, 197, 94)
    red = (248, 113, 113)

    img = Image.new("RGB", (W, H), bg_color)
    draw = ImageDraw.Draw(img)

    try:
        font_lg = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 48)
        font_md = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
        font_sm = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
        font_xs = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except Exception:
        font_lg = ImageFont.load_default()
        font_md = font_lg
        font_sm = font_lg
        font_xs = font_lg

    # Header
    draw.text((60, 40), "PRUVIQ", fill=accent, font=font_md)

    # Strategy name
    strategy_name = strategy.replace("-", " ").upper()
    draw.text((60, 100), strategy_name, fill=white, font=font_lg)

    # Direction badge
    draw.text((60, 165), dir.upper(), fill=accent, font=font_sm)

    # Metrics grid
    metrics = [
        ("Win Rate", f"{wr:.1f}%", green if wr >= 50 else red),
        ("Profit Factor", f"{pf:.2f}", green if pf >= 1.0 else red),
        ("Return", f"{'+' if ret >= 0 else ''}{ret:.1f}%", green if ret >= 0 else red),
        ("Max DD", f"{mdd:.1f}%", red),
    ]

    box_w, box_h = 240, 140
    start_x, start_y = 60, 240
    gap = 30

    for i, (label, value, color) in enumerate(metrics):
        x = start_x + i * (box_w + gap)
        y = start_y
        draw.rounded_rectangle(
            [x, y, x + box_w, y + box_h], radius=12, fill=(20, 20, 25)
        )
        draw.text((x + 20, y + 15), label, fill=muted, font=font_xs)
        draw.text((x + 20, y + 50), value, fill=color, font=font_md)

    # Trades count
    draw.text((60, 420), f"{trades:,} trades", fill=muted, font=font_sm)

    # Footer
    draw.text((60, 560), "pruviq.com", fill=muted, font=font_sm)
    draw.text((350, 560), "Don't Believe. Verify.", fill=accent, font=font_sm)

    # Top accent line
    draw.rectangle([0, 0, W, 4], fill=accent)

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    png_bytes = buf.getvalue()

    # Cache (LRU eviction)
    if len(_og_cache) >= _OG_CACHE_MAX:
        _og_cache.pop(next(iter(_og_cache)))
    _og_cache[cache_key] = png_bytes

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


# ── Bot Code Generation ──────────────────────────────────────────────
from src.codegen.bot_generator import generate_bot_zip
from api.schemas import GenerateBotRequest


@app.post("/generate-bot")
async def generate_bot(req: GenerateBotRequest):
    """Generate a downloadable trading bot zip from strategy config."""
    try:
        zip_bytes = generate_bot_zip(
            strategy_id=req.strategy_id,
            direction=req.direction,
            sl_pct=req.sl_pct,
            tp_pct=req.tp_pct,
            max_bars=req.max_bars,
            leverage=req.leverage,
            position_size=req.position_size_usd,
            coins=req.coins,
            avoid_hours=req.avoid_hours,
            wr=req.backtest_win_rate,
            pf=req.backtest_profit_factor,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bot generation failed: {e}")
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="pruviq_bot_{req.strategy_id}.zip"',
        },
    )

# ---------------------------------------------------------------------------
# Email Subscription
# ---------------------------------------------------------------------------

SUBSCRIBERS_FILE = Path(os.environ.get("SUBSCRIBERS_FILE", "/Users/jepo/pruviq-data/subscribers.json"))


@app.post("/api/subscribe")
async def subscribe_email(req: SubscribeRequest):
    """Subscribe an email to weekly strategy alerts."""
    import re
    import fcntl

    # Validate email format
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', req.email):
        raise HTTPException(422, detail="Invalid email format")

    email = req.email.lower().strip()

    # Read / write with file lock
    SUBSCRIBERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if SUBSCRIBERS_FILE.exists():
        data = json.loads(SUBSCRIBERS_FILE.read_text())
    else:
        data = {"subscribers": []}

    # Duplicate check
    existing = [s for s in data["subscribers"] if s["email"] == email]
    if existing:
        if existing[0].get("active", True):
            return {"ok": True, "message": "Already subscribed"}
        else:
            existing[0]["active"] = True
            existing[0]["resubscribed_at"] = datetime.utcnow().isoformat()
    else:
        data["subscribers"].append({
            "email": email,
            "lang": req.lang,
            "subscribed_at": datetime.utcnow().isoformat(),
            "active": True,
        })

    # Atomic write
    tmp = SUBSCRIBERS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.rename(SUBSCRIBERS_FILE)

    return {"ok": True, "message": "Subscribed successfully"}


@app.get("/api/unsubscribe")
async def unsubscribe_email(email: str, token: str):
    """Unsubscribe via signed link in emails."""
    from fastapi.responses import HTMLResponse

    secret = os.environ.get("UNSUBSCRIBE_SECRET", "pruviq-unsub-2026")
    expected = hmac.new(secret.encode(), email.lower().encode(), hashlib.sha256).hexdigest()[:16]

    if token != expected:
        raise HTTPException(403, detail="Invalid unsubscribe token")

    if SUBSCRIBERS_FILE.exists():
        data = json.loads(SUBSCRIBERS_FILE.read_text())
        for s in data["subscribers"]:
            if s["email"] == email.lower():
                s["active"] = False
        SUBSCRIBERS_FILE.write_text(json.dumps(data, indent=2))

    return HTMLResponse(
        "<html><body style=\"font-family:sans-serif;text-align:center;padding:60px\">"
        "<h2>Unsubscribed</h2>"
        "<p>You will no longer receive weekly strategy emails.</p>"
        "<a href=\"https://pruviq.com\">Back to PRUVIQ</a>"
        "</body></html>"
    )
