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
from pathlib import Path
from typing import Optional, Dict, List
from collections import OrderedDict
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "")
COINGECKO_API_KEY = os.environ.get("COINGECKO_API_KEY", "")
CG_HEADERS = {"x-cg-demo-api-key": COINGECKO_API_KEY} if COINGECKO_API_KEY else {}

import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("pruviq")

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
    VALID_TIMEFRAMES,
)
from api.data_manager import DataManager
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
    str(Path(__file__).resolve().parent.parent.parent.parent / "autotrader" / "data" / "futures")
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
_cg_metadata: Dict[str, dict] = {}
_cg_ts: float = 0.0


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
            all_strategies = get_all_strategies()
            indicator_cache.build_multi(data_manager, all_strategies)
            strategy = BBSqueezeStrategy(avoid_hours=AVOID_HOURS)
            global coin_stats_cache
            _load_coingecko_metadata()
            coin_stats_cache = _build_coin_stats(strategy)
            sim_cache.clear()
            logger.info(f"Reload complete: {indicator_cache.count} coins, cache cleared")
        else:
            logger.info("No new data from Binance")
    except Exception as e:
        logger.error(f"Data refresh failed: {e}")


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
            _news_cache = data
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"News background refresh failed: {e}")
        await asyncio.sleep(MARKET_REFRESH_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load data and pre-compute indicators on startup."""
    print(f"Loading data from {DATA_DIR} (resolved: {DATA_DIR.resolve()})...")
    data_manager.load(DATA_DIR)
    print(f"Loaded {data_manager.coin_count} coins in {data_manager._load_time:.1f}s")
    if data_manager.coin_count == 0:
        print(f"WARNING: 0 coins loaded! Check PRUVIQ_DATA_DIR={DATA_DIR}, files: {list(DATA_DIR.glob('*_1h.csv'))[:3]}")

    if data_manager.coin_count > 0:
        # Build multi-strategy indicator cache
        print("Pre-computing indicators for all strategies...")
        all_strategies = get_all_strategies()
        indicator_cache.build_multi(data_manager, all_strategies)
        for sid in all_strategies:
            cnt = indicator_cache.strategy_count(sid)
            print(f"  {sid}: {cnt} coins cached")
        print(f"Total build time: {indicator_cache._build_time:.1f}s")

        # Pre-compute coin stats for /coins/stats endpoint (primary strategy)
        print("Pre-computing coin stats...")
        strategy = BBSqueezeStrategy(avoid_hours=AVOID_HOURS)
        global coin_stats_cache
        _load_coingecko_metadata()
        coin_stats_cache = _build_coin_stats(strategy)
        print(f"Coin stats cached for {len(coin_stats_cache['coins'])} coins")

    # Pre-fetch market data before accepting requests (avoid startup race)
    print("Pre-fetching market data...")
    global _market_cache, _news_cache, _market_cache_ts
    try:
        _market_cache = await asyncio.to_thread(_build_market_overview)
        _market_cache_ts = time.time()
        _news_cache = await asyncio.to_thread(_build_news)
        print("Market cache initialized")
    except Exception as e:
        print(f"Initial market fetch failed (will retry in background): {e}")

    # Start background refresh tasks
    # IMPORTANT: Deploy with --workers 1 (global cache not shared across processes)
    refresh_task = asyncio.create_task(_background_refresh())
    market_task = asyncio.create_task(_background_market_refresh())
    print(f"Background data refresh scheduled every {REFRESH_INTERVAL}s")
    print(f"Background market refresh scheduled every {MARKET_REFRESH_INTERVAL}s")

    yield

    refresh_task.cancel()
    market_task.cancel()
    for t in (refresh_task, market_task):
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

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pruviq.com",
        "https://www.pruviq.com",
        "http://localhost:4321",
        "http://localhost:3000",
    ],
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

    if now - _last_rate_limit_cleanup > 300 and len(rate_limits) > 200:
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
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Max 30 requests per minute."},
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


def downsample_equity(times: list, values: list, n_points: int = 100) -> List[EquityPoint]:
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
            pass
    if end_date:
        try:
            mask &= ts <= pd.Timestamp(end_date) + pd.Timedelta(days=1)
        except ValueError:
            pass
    filtered = df[mask].copy()
    if len(filtered) < 100:
        return df
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


def _resolve_top_n(top_n: Optional[int]) -> int:
    """Resolve top_n: None means all coins."""
    return top_n if top_n is not None else data_manager.coin_count


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


@app.post("/simulate", response_model=SimulationResponse)
async def simulate(req: SimulationRequest):
    """Run a strategy simulation with pre-computed indicators."""

    if data_manager.coin_count == 0:
        raise HTTPException(503, "Data not loaded yet. Try again shortly.")

    # Validate timeframe
    timeframe = _validate_timeframe(getattr(req, 'timeframe', '1H') or '1H')
    resampled = _is_resampled(timeframe)

    # Resolve strategy from registry
    # Support both "bb-squeeze" (legacy) and "bb-squeeze-short" (new) formats
    strategy_id = req.strategy
    is_both = req.direction == "both"

    if strategy_id == "bb-squeeze":
        strategy_id = f"bb-squeeze-{req.direction or 'short'}" if not is_both else "bb-squeeze-short"

    if strategy_id not in STRATEGY_REGISTRY:
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")

    strategy, default_direction, defaults = get_strategy(strategy_id)

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
            coins = indicator_cache.get_symbols_for_strategy(strategy_id, req.symbols) if has_cache else data_manager.get_symbols(req.symbols)
            if not coins:
                raise HTTPException(404, "None of the requested symbols found.")
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

    for run_dir in directions_to_run:
        for sym, df in coins:
            if not has_cache:
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

            result = run_fast(
                df, strategy, sym,
                sl_pct=req.sl_pct / 100,
                tp_pct=req.tp_pct / 100,
                max_bars=req.max_bars,
                fee_pct=cost_model.fee_pct,
                slippage_pct=cost_model.slippage_pct,
                direction=run_dir,
                market_type=req.market_type,
                strategy_id=strategy_id,
                funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
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
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.001
    is_compounding = getattr(req, 'compounding', False)

    # total_return: compound vs simple
    if is_compounding:
        _compound_eq = 100.0
        for _t in all_trades:
            _compound_eq *= (1 + _t["pnl_pct"] / 100)
        total_return = round((_compound_eq / 100.0 - 1) * 100, 4)
    else:
        total_return = round(sum(t["pnl_pct"] for t in all_trades), 4)

    total_fees = len(all_trades) * (cost_model.fee_pct * 2 * 100)
    total_funding = sum(t.get('funding_pct', 0) for t in all_trades)

    avg_win = (sum(t["pnl_pct"] for t in wins) / len(wins)) if wins else 0
    avg_loss = (sum(t["pnl_pct"] for t in losses) / len(losses)) if losses else 0

    # Equity curve + MDD
    equity = 100.0 if is_compounding else 0.0
    peak = equity
    max_dd = 0.0
    eq_times = []
    eq_values = []
    max_consec = 0
    cur_consec = 0

    for t in all_trades:
        if is_compounding:
            equity = max(equity * (1 + t["pnl_pct"] / 100), 0.0)
        else:
            equity += t["pnl_pct"]
        peak = max(peak, equity)
        dd = peak - equity
        max_dd = max(max_dd, dd)
        eq_times.append(t["time"][:10])
        eq_values.append(equity)

        if t["pnl_pct"] <= 0:
            cur_consec += 1
            max_consec = max(max_consec, cur_consec)
        else:
            cur_consec = 0

    tp_count = sum(1 for t in all_trades if t["exit_reason"] == "tp")
    sl_count = sum(1 for t in all_trades if t["exit_reason"] == "sl")
    timeout_count = sum(1 for t in all_trades if t["exit_reason"] == "timeout")

    # Risk-adjusted metrics (aggregate)
    trade_pnls = np.array([t["pnl_pct"] for t in all_trades])
    if len(trade_pnls) >= 2:
        avg_ret = float(np.mean(trade_pnls))
        std_ret = float(np.std(trade_pnls, ddof=1))
        sharpe = round(avg_ret / std_ret * np.sqrt(len(trade_pnls)), 2) if std_ret > 0 else 0.0
        downside = trade_pnls[trade_pnls < 0]
        down_std = float(np.std(downside, ddof=1)) if len(downside) >= 2 else 0.0
        sortino = round(avg_ret / down_std * np.sqrt(len(trade_pnls)), 2) if down_std > 0 else 0.0
        calmar = round(total_return / max_dd, 2) if max_dd > 0 else 0.0
    else:
        sharpe, sortino, calmar = 0.0, 0.0, 0.0

    # Use actual date range if tracked, otherwise fallback to data_manager
    data_range = data_manager.data_range()
    if actual_date_min and actual_date_max:
        data_range = f"{actual_date_min} ~ {actual_date_max}"

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
        "profit_factor": _safe_float(round(gross_profit / gross_loss, 2)),
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


def _build_coin_stats(strategy) -> dict:
    """Pre-compute stats for all coins."""
    cost_model = CostModel.futures()
    coins_list = []

    for info in data_manager.coins:
        symbol = info["symbol"]
        df = indicator_cache.get(symbol)
        if df is None or len(df) < 500:
            continue

        result = run_fast(
            df, strategy, symbol,
            sl_pct=0.10, tp_pct=0.08, max_bars=48,
            fee_pct=cost_model.fee_pct,
            slippage_pct=cost_model.slippage_pct,
            direction="short", market_type="futures",
            funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
        )

        # Price & 24h change (compare last close vs 24 bars ago)
        last_close = float(df["close"].iloc[-1])
        close_24h_ago = float(df["close"].iloc[-25]) if len(df) >= 25 else float(df["close"].iloc[0])
        change_24h = round(((last_close - close_24h_ago) / close_24h_ago) * 100, 2) if close_24h_ago else 0
        volume_24h = float(df["volume"].iloc[-24:].sum()) if len(df) >= 24 else float(df["volume"].sum())

        cg = _cg_metadata.get(symbol, {})
        coins_list.append(CoinStats(
            symbol=symbol,
            price=round(last_close, 6),
            change_24h=change_24h,
            volume_24h=round(volume_24h, 2),
            trades=result.total_trades,
            win_rate=result.win_rate,
            profit_factor=result.profit_factor,
            total_return_pct=result.total_return_pct,
            name=cg.get("name"),
            image=cg.get("image"),
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
async def get_ohlcv(symbol: str, limit: int = 3000, timeframe: str = "1H"):
    """Get OHLCV + indicator data for a single coin.

    Supports multi-timeframe via the `timeframe` query parameter.
    For non-1H timeframes, data is resampled from 1H and indicators are recomputed.
    """
    symbol = symbol.upper()
    timeframe = _validate_timeframe(timeframe)

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

    if limit > 0:
        df = df.tail(limit)

    bars = []
    for _, row in df.iterrows():
        bars.append(OhlcvBar(
            t=_ts_to_unix(row["timestamp"]),
            o=round(float(row["open"]), 6),
            h=round(float(row["high"]), 6),
            l=round(float(row["low"]), 6),
            c=round(float(row["close"]), 6),
            v=round(float(row["volume"]), 2),
            bb_upper=round(float(row["bb_upper"]), 6) if "bb_upper" in df.columns and pd.notna(row.get("bb_upper")) else None,
            bb_lower=round(float(row["bb_lower"]), 6) if "bb_lower" in df.columns and pd.notna(row.get("bb_lower")) else None,
            bb_mid=round((float(row["bb_upper"]) + float(row["bb_lower"])) / 2, 6) if "bb_upper" in df.columns and pd.notna(row.get("bb_upper")) and pd.notna(row.get("bb_lower")) else None,
            ema20=round(float(row["ema_fast"]), 6) if "ema_fast" in df.columns and pd.notna(row.get("ema_fast")) else None,
            ema50=round(float(row["ema_slow"]), 6) if "ema_slow" in df.columns and pd.notna(row.get("ema_slow")) else None,
            vol_ratio=round(float(row["vol_ratio"]), 2) if "vol_ratio" in df.columns and pd.notna(row.get("vol_ratio")) else None,
        ))

    return OhlcvResponse(symbol=symbol, timeframe=timeframe, total_bars=len(bars), data=bars)


@app.post("/simulate/coin", response_model=CoinSimResponse)
async def simulate_coin(req: CoinSimRequest):
    """Simulate a single coin and return individual trade details."""
    symbol = req.symbol.upper()
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
    result = run_fast(
        df, strategy, symbol,
        sl_pct=req.sl_pct / 100,
        tp_pct=req.tp_pct / 100,
        max_bars=req.max_bars,
        fee_pct=cost_model.fee_pct,
        slippage_pct=cost_model.slippage_pct,
        direction=req.direction,
        market_type=req.market_type,
        strategy_id=strategy_id,
        funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
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
        result = run_fast(
            df, strategy, sym,
            sl_pct=req.sl_pct / 100, tp_pct=req.tp_pct / 100,
            max_bars=req.max_bars,
            fee_pct=cost_model.fee_pct, slippage_pct=cost_model.slippage_pct,
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
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.001

    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    eq_times = []
    eq_values = []
    for t in all_trades:
        equity += t["pnl_pct"]
        peak = max(peak, equity)
        max_dd = max(max_dd, peak - equity)
        eq_times.append(t["time"][:10])
        eq_values.append(equity)

    return StrategyResult(
        strategy_id=strategy_id, name=entry["name"],
        direction=direction, status=entry["status"],
        total_trades=len(all_trades), wins=len(wins), losses=len(losses),
        win_rate=round(len(wins) / len(all_trades) * 100, 2),
        total_return_pct=round(sum(t["pnl_pct"] for t in all_trades), 2),
        profit_factor=round(gross_profit / gross_loss, 2),
        max_drawdown_pct=round(max_dd, 2),
        tp_count=sum(1 for t in all_trades if t["exit_reason"] == "tp"),
        sl_count=sum(1 for t in all_trades if t["exit_reason"] == "sl"),
        timeout_count=sum(1 for t in all_trades if t["exit_reason"] == "timeout"),
        equity_curve=downsample_equity(eq_times, eq_values),
    )


COMPARE_MAX_COINS = 50  # Cap to prevent CF tunnel timeout


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

    timeframe = _validate_timeframe(getattr(req, 'timeframe', '1H') or '1H')
    resampled = _is_resampled(timeframe)

    strategy_id = req.strategy
    if strategy_id == "bb-squeeze":
        strategy_id = f"bb-squeeze-{req.direction or 'short'}"

    if strategy_id not in STRATEGY_REGISTRY:
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")

    strategy, default_direction, defaults = get_strategy(strategy_id)
    direction = req.direction if req.direction is not None else default_direction
    cost_model = CostModel.futures() if req.market_type == "futures" else CostModel.spot()

    if resampled:
        coins = _get_resampled_coins(req.symbols, req.top_n, timeframe)
        if req.symbols and not coins:
            raise HTTPException(404, "None of the requested symbols found.")
        has_cache = False
    else:
        has_cache = indicator_cache.strategy_count(strategy_id) > 0
        if req.symbols:
            coins = indicator_cache.get_symbols_for_strategy(strategy_id, req.symbols) if has_cache else data_manager.get_symbols(req.symbols)
            if not coins:
                raise HTTPException(404, "None of the requested symbols found.")
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

        for period_df, trade_list in [(df_is, is_trades_all), (df_oos, oos_trades_all)]:
            if len(period_df) < 100:
                continue
            result = run_fast(
                period_df, strategy, sym,
                sl_pct=req.sl_pct / 100,
                tp_pct=req.tp_pct / 100,
                max_bars=req.max_bars,
                fee_pct=cost_model.fee_pct,
                slippage_pct=cost_model.slippage_pct,
                direction=direction,
                market_type=req.market_type,
                strategy_id=strategy_id,
                funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
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
    if not ADMIN_API_KEY or not hmac.compare_digest(x_admin_key, ADMIN_API_KEY):
        raise HTTPException(status_code=403, detail="Forbidden")
    await asyncio.to_thread(_refresh_data)
    return {"status": "ok", "coins": indicator_cache.count, "generated": coin_stats_cache["generated"] if coin_stats_cache else None}


# --- Market Dashboard ---

try:
    import defusedxml.ElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET
import requests as http_requests
from email.utils import parsedate_to_datetime

MARKET_REFRESH_INTERVAL = 300  # seconds — background fetch every 5min (Binance primary, no rate limit concern)
_market_cache: Optional[dict] = None
_market_cache_ts: float = 0.0  # timestamp of last successful cache update


def _cg_get(url: str, timeout: int = 10, max_retries: int = 3, raise_on_fail: bool = True):
    """CoinGecko GET with 429 backoff."""
    for attempt in range(max_retries):
        try:
            resp = http_requests.get(url, headers=CG_HEADERS, timeout=timeout)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 30))
                wait = max(retry_after, 15) * (2 ** attempt)
                logger.warning(f"CoinGecko 429 on {url.split('?')[0]}, waiting {wait}s (attempt {attempt+1})")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        except http_requests.exceptions.Timeout:
            logger.warning(f"CoinGecko timeout on {url.split('?')[0]} (attempt {attempt+1})")
            continue
        except http_requests.exceptions.ConnectionError:
            logger.warning(f"CoinGecko connection error on {url.split('?')[0]} (attempt {attempt+1})")
            time.sleep(5 * (attempt + 1))
            continue
    if raise_on_fail:
        raise Exception(f"CoinGecko rate limited after {max_retries} retries")
    return None


_news_cache: Optional[dict] = None

# --- Binance Spot live ticker (30s TTL) + Futures fallback ---
BINANCE_SPOT_URL = "https://api.binance.com/api/v3/ticker/24hr"
BINANCE_FUTURES_URL = "https://fapi.binance.com/fapi/v1/ticker/24hr"
_live_spot_cache: Optional[dict] = None
_live_spot_ts: float = 0.0
_live_spot_lock = asyncio.Lock()

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
    try:
        resp = _cg_get("https://api.coingecko.com/api/v3/global", timeout=5, raise_on_fail=False)
        if resp is None:
            return {"total_market_cap_b": 0, "btc_dominance": 0, "total_volume_24h_b": 0}
        data = resp.json()["data"]
        return {
            "total_market_cap_b": round(data["total_market_cap"].get("usd", 0) / 1e9, 1),
            "btc_dominance": round(data.get("market_cap_percentage", {}).get("btc", 0), 1),
            "total_volume_24h_b": round(data["total_volume"].get("usd", 0) / 1e9, 1),
        }
    except Exception as e:
        logger.warning(f"CoinGecko global fetch failed: {e}")
        return {"total_market_cap_b": 0, "btc_dominance": 0, "total_volume_24h_b": 0}


def _fetch_binance_tickers() -> tuple:
    """Fetch market tickers from Binance Futures API (PRIMARY — free, unlimited, no API key).
    Returns (top_gainers, top_losers, btc_price, btc_change, eth_price, eth_change).
    Falls back to CoinGecko if Binance fails.
    """
    try:
        resp = http_requests.get(BINANCE_FUTURES_URL, timeout=10)
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
    try:
        resp = _cg_get(
            "https://api.coingecko.com/api/v3/coins/markets"
            "?vs_currency=usd&order=market_cap_desc&per_page=250&sparkline=false"
            "&price_change_percentage=24h",
            raise_on_fail=False,
        )
        if resp is None:
            return [], [], 0, 0, 0, 0
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

        return top_gainers, top_losers, btc_price, btc_change, eth_price, eth_change
    except Exception as e:
        logger.warning(f"CoinGecko tickers fallback also failed: {e}")
        return [], [], 0, 0, 0, 0


def _fetch_coingecko_funding() -> list:
    """Fetch extreme funding rates from CoinGecko derivatives (NO Binance API).
    CoinGecko funding_rate is already a percentage decimal (e.g. -0.005 = -0.5%).
    We filter to major exchanges only to avoid noisy data.
    """
    MAJOR_EXCHANGES = {"binance", "bybit", "okx", "bitget", "dydx", "htx", "gate", "kucoin", "mexc"}
    try:
        resp = _cg_get(
            "https://api.coingecko.com/api/v3/derivatives"
            "?include_tickers=unexpired",
            raise_on_fail=False,
        )
        if resp is None:
            return []
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

        return [
            FundingRate(
                symbol=d["symbol"],
                rate=round(d["rate"], 4),  # already % decimal
                annual_pct=round(d["rate"] * 3 * 365, 1),  # 3 periods/day * 365
            )
            for d in unique[:10]
        ]
    except Exception as e:
        logger.warning(f"CoinGecko funding fetch failed: {e}")
        return []


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
    try:
        resp = http_requests.get(url, timeout=8, headers={"User-Agent": "PRUVIQ/1.0"})
        resp.raise_for_status()
        root = ET.fromstring(resp.text)

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
        resp = http_requests.get(BINANCE_FUTURES_URL, timeout=10)
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


def _build_macro_data() -> dict:
    """Build macro data from CNBC (primary) + FRED (Fed Rate only)."""
    indicators = []
    symbol_map = {ind["symbol"]: ind for ind in CNBC_INDICATORS}

    # 1. CNBC batch (7 indicators, 1 HTTP call)
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
                indicators.append(MacroIndicator(
                    id=ind["id"], name=ind["name"], value=value,
                    change=change, unit=ind["unit"],
                    updated=q.get("last_timedate", ""), source="CNBC",
                ))
    except Exception as e:
        logger.warning(f"CNBC macro fetch failed: {e}")

    # 2. FRED: Fed Funds Rate only
    fed = _fetch_fred_series(FRED_FED_RATE["id"])
    if fed:
        change = round(fed["value"] - fed.get("previous", fed["value"]), 3) if fed.get("previous") else None
        indicators.append(MacroIndicator(
            id=FRED_FED_RATE["id"], name=FRED_FED_RATE["name"],
            value=fed["value"], change=change, unit=FRED_FED_RATE["unit"],
            updated=fed.get("updated", ""), source="FRED",
        ))

    # Fetch derivatives data with graceful fallback
    derivatives = _fetch_derivatives_data()

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
        raise HTTPException(404, f"Preset not found: {preset_id}")
    return PRESET_STRATEGIES[preset_id]


@app.post("/backtest", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest):
    """
    Run a custom strategy backtest using the ConditionEngine.
    This is the core Strategy Builder endpoint.
    """
    if data_manager.coin_count == 0:
        raise HTTPException(503, "Data not loaded yet. Try again shortly.")

    # Cache lookup
    bt_key = backtest_cache_key(req)
    cached = get_cached(bt_key)
    if cached is not None:
        return cached

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

    if not coin_list:
        raise HTTPException(404, "No coins found.")

    # Run simulation
    cost_model = CostModel.futures()
    all_trades = []
    coin_results = []

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
        trades = simulate_vectorized(
            df=df,
            signal_indices=signal_indices,
            sl_pct=req.sl_pct / 100,
            tp_pct=req.tp_pct / 100,
            max_bars=req.max_bars,
            fee_pct=cost_model.fee_pct,
            slippage_pct=cost_model.slippage_pct,
            direction=req.direction,
            symbol=sym,
            funding_rate_8h=getattr(cost_model, 'funding_rate_8h', 0.0001),
        )

        # Collect per-coin stats
        if trades:
            c_wins = [t for t in trades if t.pnl_pct > 0]
            c_losses = [t for t in trades if t.pnl_pct <= 0]
            c_gp = sum(t.pnl_pct for t in c_wins) if c_wins else 0
            c_gl = abs(sum(t.pnl_pct for t in c_losses)) if c_losses else 0.001
            c_total_ret = sum(t.pnl_pct for t in trades)
            coin_results.append(CoinResult(
                symbol=sym,
                trades=len(trades),
                wins=len(c_wins),
                losses=len(c_losses),
                win_rate=round(len(c_wins) / len(trades) * 100, 2),
                profit_factor=round(c_gp / c_gl, 2),
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
                c_gl = abs(sum(t["pnl_pct"] for t in c_losses)) if c_losses else 0.001
                c_total = sum(t["pnl_pct"] for t in trades_list)
                coin_results.append(CoinResult(
                    symbol=sym, trades=len(trades_list),
                    wins=len(c_wins), losses=len(c_losses),
                    win_rate=round(len(c_wins) / len(trades_list) * 100, 2),
                    profit_factor=round(c_gp / c_gl, 2),
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
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.001
    is_compounding = getattr(req, 'compounding', False)

    avg_win = (sum(t["pnl_pct"] for t in wins) / len(wins)) if wins else 0
    avg_loss = (sum(t["pnl_pct"] for t in losses) / len(losses)) if losses else 0

    # Portfolio USD calculations
    per_coin_usd = getattr(req, 'per_coin_usd', 60.0)
    leverage_val = getattr(req, 'leverage', 5)
    # Capital = min(max_concurrent, coins_used) × per_coin_usd
    # This reflects the actual capital needed at peak utilization, not total coins
    effective_positions = min(max_concurrent, len(coin_list))
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
        _compound_eq = 100.0
        for _t in all_trades:
            _compound_eq *= (1 + _t["pnl_pct"] / 100)
        total_return = round((_compound_eq / 100.0 - 1) * 100, 4)
    else:
        total_return = round(total_pnl_usd / initial_capital * 100, 4) if initial_capital > 0 else 0

    # Equity + MDD (in both % and USD)
    equity = 100.0 if is_compounding else 0.0
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
            equity = max(equity * (1 + t["pnl_pct"] / 100), 0.0)
            equity_usd_track = max(equity_usd_track + t["pnl_usd"], 0.0)
        else:
            pnl_on_capital = t["pnl_usd"] / initial_capital * 100 if initial_capital > 0 else 0
            equity += pnl_on_capital
            equity_usd_track += t["pnl_usd"]
        equity_usd += t.get("pnl_usd", 0)
        peak = max(peak, equity)
        peak_usd = max(peak_usd, equity_usd)
        dd = peak - equity
        dd_usd = peak_usd - equity_usd
        max_dd = max(max_dd, dd)
        max_dd_usd = max(max_dd_usd, dd_usd)
        eq_times.append(t["time"][:10])
        eq_values.append(equity)
        if t["pnl_pct"] <= 0:
            cur_consec += 1
            max_consec = max(max_consec, cur_consec)
        else:
            cur_consec = 0

    tp_count = sum(1 for t in all_trades if t["exit_reason"] == "tp")
    sl_count = sum(1 for t in all_trades if t["exit_reason"] == "sl")
    timeout_count = sum(1 for t in all_trades if t["exit_reason"] == "timeout")

    # Risk-adjusted metrics — annualized from daily returns
    # Group trades by exit date → daily PnL series
    from collections import defaultdict as dd_import
    daily_pnl = dd_import(float)
    for t in all_trades:
        day_key = t["exit_time"][:10]  # YYYY-MM-DD
        daily_pnl[day_key] += t["pnl_pct"]
    daily_returns = np.array(list(daily_pnl.values())) if daily_pnl else np.array([])

    if len(daily_returns) >= 5:
        dr_avg = float(np.mean(daily_returns))
        dr_std = float(np.std(daily_returns, ddof=1))
        bt_sharpe = round(dr_avg / dr_std * np.sqrt(365), 2) if dr_std > 0 else 0.0
        dr_down = daily_returns[daily_returns < 0]
        dr_down_std = float(np.std(dr_down, ddof=1)) if len(dr_down) >= 2 else 0.0
        bt_sortino = round(dr_avg / dr_down_std * np.sqrt(365), 2) if dr_down_std > 0 else 0.0
        # Calmar = annualized return / MDD
        n_days = len(daily_pnl)
        ann_return = total_return * (365 / max(n_days, 1)) if n_days > 0 else total_return
        bt_calmar = round(ann_return / max_dd, 2) if max_dd > 0 else 0.0
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
        # Sharpe standard error with non-normality correction
        sr_se = np.sqrt((1 + 0.5 * bt_sharpe**2 - skw * bt_sharpe + (krt / 4) * bt_sharpe**2) / max(n_dr - 1, 1))
        # Expected max Sharpe from n_trials strategies
        # Realistic: conditions^2 * 50 (combinatorial parameter search)
        n_cond = max(params.get("conditions_count", 1), 1)
        n_trials_est = max(n_cond ** 2 * 50, 100)
        gamma_em = 0.5772156649  # Euler-Mascheroni
        expected_max_sr = np.sqrt(2 * np.log(n_trials_est)) * (1 - gamma_em / max(2 * np.log(n_trials_est), 0.01)) if n_trials_est > 1 else 0
        z_dsr = (bt_sharpe - expected_max_sr) / max(sr_se, 0.001)
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
            profit_factor=round(y["gross_profit"] / max(y["gross_loss"], 0.001), 2),
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
            profit_factor=round(m["gross_profit"] / max(m["gross_loss"], 0.001), 2),
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
        except Exception:
            pass
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
            edge_p_value = round(max(0, min(1, 0.5 * (1 - min(abs(z), 6) / 6))), 4) if z > 0 else 1.0
        except Exception:
            pass

    # --- Strategy grade (7 dimensions, max 16 points) ---
    pf = round(gross_profit / gross_loss, 2) if gross_loss > 0 else 0
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

    grade_details = f"PF={pf} WR={wr}%(BE:{be_wr_grade:.0f}%) MDD={capital_mdd:.1f}% RF={recovery_factor} Sharpe={bt_sharpe} E={expectancy} Edge={grade_score}/16"

    # --- Warnings ---
    warnings = []
    if mdd > 20:
        warnings.append(f"High drawdown: {mdd:.1f}%. With {leverage_val}x leverage, real capital loss could reach {mdd * leverage_val / 100 * 100:.0f}%.")
    if len(all_trades) < 30:
        warnings.append(f"Low sample size: {len(all_trades)} trades. Results may not be statistically reliable.")
    if pf > 3.0 and len(all_trades) > 50:
        warnings.append("Very high Profit Factor may indicate overfitting. Run OOS validation to verify.")
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

    # --- Rolling 5-Window Walk-Forward Consistency ---
    walk_forward_consistency = 0.0
    walk_forward_details = ""
    if len(all_trades) >= 50:
        def _wf_metrics(tlist):
            w = [t for t in tlist if t["pnl_pct"] > 0]
            l = [t for t in tlist if t["pnl_pct"] <= 0]
            _wr = len(w) / len(tlist) * 100 if tlist else 0
            gp = sum(t["pnl_pct"] for t in w) if w else 0
            gl = abs(sum(t["pnl_pct"] for t in l)) if l else 0.001
            _pf = gp / gl if gl > 0 else 0
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
        profit_factor=round(gross_profit / gross_loss, 2),
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
    )

    # Cache the result
    set_cached(bt_key, response.model_dump())

    return response



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
