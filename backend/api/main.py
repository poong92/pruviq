"""
PRUVIQ Simulation API v0.1

FastAPI server for running strategy simulations on-demand.
Designed for Mac Mini deployment with Cloudflare Tunnel.

Usage:
    uvicorn backend.api.main:app --host 0.0.0.0 --port 8080 --workers 4
"""

import os
import sys
import time
import hashlib
import json
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, List
from collections import OrderedDict
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import numpy as np
import pandas as pd
from datetime import datetime, timezone

logger = logging.getLogger("pruviq")

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.schemas import (
    SimulationRequest, SimulationResponse, EquityPoint,
    CoinInfo, StrategyInfo, HealthResponse,
    OhlcvBar, OhlcvResponse,
    CoinSimRequest, CoinSimResponse, TradeDetail,
    CoinStats, CoinStatsResponse,
    MarketOverview, MarketMover, FundingRate,
    NewsItem, NewsResponse,
    CompareRequest, CompareResponse, StrategyResult,
    MacroIndicator, DerivativesData, EconomicEvent, MacroResponse,
)
from api.data_manager import DataManager
from api.indicator_cache import IndicatorCache
from src.simulation.engine import CostModel
from src.simulation.engine_fast import run_fast
from src.strategies.bb_squeeze import BBSqueezeStrategy
from src.strategies.registry import STRATEGY_REGISTRY, get_strategy, get_all_strategies

# Config
VERSION = "0.1.0"
DATA_DIR = Path(os.getenv(
    "PRUVIQ_DATA_DIR",
    str(Path(__file__).parent.parent.parent.parent / "autotrader" / "data" / "futures")
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


REFRESH_INTERVAL = 3600  # seconds (1 hour)

def _refresh_data():
    """Refresh CSV data from Binance, rebuild caches."""
    try:
        from scripts.update_ohlcv import update_symbol, SKIP
        files = sorted(DATA_DIR.glob("*_1h.csv"))
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
            coin_stats_cache = _build_coin_stats(strategy)
            logger.info(f"Reload complete: {indicator_cache.count} coins")
        else:
            logger.info("No new data from Binance")
    except Exception as e:
        logger.error(f"Data refresh failed: {e}")


async def _background_refresh():
    """Periodically refresh data from Binance."""
    while True:
        await asyncio.sleep(REFRESH_INTERVAL)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _refresh_data)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load data and pre-compute indicators on startup."""
    print(f"Loading data from {DATA_DIR}...")
    data_manager.load(DATA_DIR)
    print(f"Loaded {data_manager.coin_count} coins in {data_manager._load_time:.1f}s")

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
        coin_stats_cache = _build_coin_stats(strategy)
        print(f"Coin stats cached for {len(coin_stats_cache['coins'])} coins")

    # Start background refresh
    refresh_task = asyncio.create_task(_background_refresh())
    print(f"Background data refresh scheduled every {REFRESH_INTERVAL}s")

    yield

    refresh_task.cancel()


app = FastAPI(
    title="PRUVIQ Simulation API",
    version=VERSION,
    description="Run crypto strategy simulations with realistic costs.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pruviq.com",
        "https://www.pruviq.com",
        "http://localhost:4321",
        "http://localhost:3000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# --- Rate Limiting ---

def check_rate_limit(client_ip: str) -> bool:
    """Simple in-memory rate limiter."""
    now = time.time()
    if client_ip not in rate_limits:
        rate_limits[client_ip] = []

    rate_limits[client_ip] = [t for t in rate_limits[client_ip] if now - t < 60]

    if len(rate_limits[client_ip]) >= RATE_LIMIT_PER_MIN:
        return False

    rate_limits[client_ip].append(now)
    return True


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path in ("/simulate", "/simulate/coin", "/simulate/compare", "/backtest"):
        client_ip = request.client.host if request.client else "unknown"
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


# --- Helpers ---

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


@app.post("/simulate", response_model=SimulationResponse)
async def simulate(req: SimulationRequest):
    """Run a strategy simulation with pre-computed indicators."""

    if data_manager.coin_count == 0:
        raise HTTPException(503, "Data not loaded yet. Try again shortly.")

    # Resolve strategy from registry
    # Support both "bb-squeeze" (legacy) and "bb-squeeze-short" (new) formats
    strategy_id = req.strategy
    if strategy_id == "bb-squeeze":
        strategy_id = f"bb-squeeze-{req.direction or 'short'}"

    if strategy_id not in STRATEGY_REGISTRY:
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")

    strategy, default_direction, defaults = get_strategy(strategy_id)
    direction = req.direction if req.direction is not None else default_direction

    # Check cache
    ckey = cache_key(req)
    cached = get_cached(ckey)
    if cached:
        return SimulationResponse(**cached)

    # Get pre-computed indicator data
    has_cache = indicator_cache.strategy_count(strategy_id) > 0

    if req.symbols:
        coins = indicator_cache.get_symbols_for_strategy(strategy_id, req.symbols) if has_cache else data_manager.get_symbols(req.symbols)
        if not coins:
            raise HTTPException(404, "None of the requested symbols found.")
    else:
        coins = indicator_cache.get_top_n_for_strategy(strategy_id, data_manager, req.top_n) if has_cache else data_manager.get_top_n(req.top_n)

    cost_model = CostModel.futures() if req.market_type == "futures" else CostModel.spot()

    # Run simulation across all coins
    all_trades = []
    for sym, df in coins:
        if not has_cache:
            df = strategy.calculate_indicators(df.copy())

        result = run_fast(
            df, strategy, sym,
            sl_pct=req.sl_pct / 100,
            tp_pct=req.tp_pct / 100,
            max_bars=req.max_bars,
            fee_pct=cost_model.fee_pct,
            slippage_pct=cost_model.slippage_pct,
            direction=direction,
            market_type=req.market_type,
            strategy_id=strategy_id,
        )

        for trade in result.trades:
            all_trades.append({
                "time": trade.entry_time,
                "pnl_pct": trade.pnl_pct,
                "exit_reason": trade.exit_reason,
            })

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
            total_fees_pct=0, tp_count=0, sl_count=0, timeout_count=0,
            coins_used=len(coins), data_range=data_manager.data_range(),
            equity_curve=[],
        )
        set_cached(ckey, resp.model_dump())
        return resp

    wins = [t for t in all_trades if t["pnl_pct"] > 0]
    losses = [t for t in all_trades if t["pnl_pct"] <= 0]
    gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.001
    total_return = sum(t["pnl_pct"] for t in all_trades)
    total_fees = len(all_trades) * (cost_model.fee_pct * 2 * 100)

    avg_win = (sum(t["pnl_pct"] for t in wins) / len(wins)) if wins else 0
    avg_loss = (sum(t["pnl_pct"] for t in losses) / len(losses)) if losses else 0

    # Equity curve + MDD
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    eq_times = []
    eq_values = []
    max_consec = 0
    cur_consec = 0

    for t in all_trades:
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

    resp_data = {
        "strategy": req.strategy,
        "direction": direction,
        "params": strategy.get_params(),
        "market_type": req.market_type,
        "total_trades": len(all_trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(all_trades) * 100, 2),
        "total_return_pct": round(total_return, 2),
        "profit_factor": round(gross_profit / gross_loss, 2),
        "avg_win_pct": round(avg_win, 4),
        "avg_loss_pct": round(avg_loss, 4),
        "max_drawdown_pct": round(max_dd, 2),
        "max_consecutive_losses": max_consec,
        "total_fees_pct": round(total_fees, 2),
        "tp_count": tp_count,
        "sl_count": sl_count,
        "timeout_count": timeout_count,
        "coins_used": len(coins),
        "data_range": data_manager.data_range(),
        "equity_curve": downsample_equity(eq_times, eq_values),
    }

    set_cached(ckey, resp_data)
    return SimulationResponse(**resp_data)


# --- Coin Explorer Helpers ---

def _ts_to_unix(ts) -> int:
    """Convert pandas Timestamp or string to Unix seconds."""
    if hasattr(ts, 'timestamp'):
        return int(ts.timestamp())
    return int(pd.Timestamp(str(ts)).timestamp())


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
        )

        # Price & 24h change (compare last close vs 24 bars ago)
        last_close = float(df["close"].iloc[-1])
        close_24h_ago = float(df["close"].iloc[-25]) if len(df) >= 25 else float(df["close"].iloc[0])
        change_24h = round(((last_close - close_24h_ago) / close_24h_ago) * 100, 2) if close_24h_ago else 0
        volume_24h = float(df["volume"].iloc[-24:].sum()) if len(df) >= 24 else float(df["volume"].sum())

        coins_list.append(CoinStats(
            symbol=symbol,
            price=round(last_close, 6),
            change_24h=change_24h,
            volume_24h=round(volume_24h, 2),
            trades=result.total_trades,
            win_rate=result.win_rate,
            profit_factor=result.profit_factor,
            total_return_pct=result.total_return_pct,
        ))

    return {
        "generated": datetime.now(timezone.utc).isoformat(),
        "strategy": "bb-squeeze-short",
        "params": {"sl_pct": 10, "tp_pct": 8, "max_bars": 48},
        "coins": coins_list,
    }


# --- Coin Explorer Endpoints ---

@app.get("/ohlcv/{symbol}", response_model=OhlcvResponse)
async def get_ohlcv(symbol: str, limit: int = 3000):
    """Get OHLCV + indicator data for a single coin."""
    symbol = symbol.upper()
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

    return OhlcvResponse(symbol=symbol, total_bars=len(bars), data=bars)


@app.post("/simulate/coin", response_model=CoinSimResponse)
async def simulate_coin(req: CoinSimRequest):
    """Simulate a single coin and return individual trade details."""
    symbol = req.symbol.upper()

    # Use bb-squeeze-short by default for backwards compat
    strategy_id = f"bb-squeeze-{req.direction}"
    if strategy_id not in STRATEGY_REGISTRY:
        strategy_id = "bb-squeeze-short"

    df = indicator_cache.get_for_strategy(strategy_id, symbol)
    if df is None:
        # Fallback to legacy flat cache
        df = indicator_cache.get(symbol)
    if df is None:
        raise HTTPException(404, f"Symbol not found: {symbol}")

    strategy, _, _ = get_strategy(strategy_id)
    cost_model = CostModel.futures() if req.market_type == "futures" else CostModel.spot()

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
        trades=trades,
    )


@app.get("/coins/stats", response_model=CoinStatsResponse)
async def get_coin_stats():
    """Get pre-computed stats for all coins."""
    if coin_stats_cache is None:
        raise HTTPException(503, "Coin stats not computed yet.")
    return CoinStatsResponse(**coin_stats_cache)


@app.post("/simulate/compare", response_model=CompareResponse)
async def simulate_compare(req: CompareRequest):
    """Run all strategies under identical SL/TP conditions for comparison."""
    if data_manager.coin_count == 0:
        raise HTTPException(503, "Data not loaded yet. Try again shortly.")

    cost_model = CostModel.futures()
    results = []

    for strategy_id, entry in STRATEGY_REGISTRY.items():
        strategy, direction, _ = get_strategy(strategy_id)

        # Get coins for this strategy
        has_cache = indicator_cache.strategy_count(strategy_id) > 0
        coins = indicator_cache.get_top_n_for_strategy(strategy_id, data_manager, req.top_n) if has_cache else data_manager.get_top_n(req.top_n)

        all_trades = []
        for sym, df in coins:
            if not has_cache:
                df = strategy.calculate_indicators(df.copy())

            result = run_fast(
                df, strategy, sym,
                sl_pct=req.sl_pct / 100,
                tp_pct=req.tp_pct / 100,
                max_bars=req.max_bars,
                fee_pct=cost_model.fee_pct,
                slippage_pct=cost_model.slippage_pct,
                direction=direction,
                market_type="futures",
                strategy_id=strategy_id,
            )
            for trade in result.trades:
                all_trades.append({"time": trade.entry_time, "pnl_pct": trade.pnl_pct, "exit_reason": trade.exit_reason})

        all_trades.sort(key=lambda t: t["time"])

        if not all_trades:
            results.append(StrategyResult(
                strategy_id=strategy_id, name=entry["name"],
                direction=direction, status=entry["status"],
                total_trades=0, wins=0, losses=0, win_rate=0,
                total_return_pct=0, profit_factor=0, max_drawdown_pct=0,
                tp_count=0, sl_count=0, timeout_count=0, equity_curve=[],
            ))
            continue

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

        results.append(StrategyResult(
            strategy_id=strategy_id,
            name=entry["name"],
            direction=direction,
            status=entry["status"],
            total_trades=len(all_trades),
            wins=len(wins),
            losses=len(losses),
            win_rate=round(len(wins) / len(all_trades) * 100, 2),
            total_return_pct=round(sum(t["pnl_pct"] for t in all_trades), 2),
            profit_factor=round(gross_profit / gross_loss, 2),
            max_drawdown_pct=round(max_dd, 2),
            tp_count=sum(1 for t in all_trades if t["exit_reason"] == "tp"),
            sl_count=sum(1 for t in all_trades if t["exit_reason"] == "sl"),
            timeout_count=sum(1 for t in all_trades if t["exit_reason"] == "timeout"),
            equity_curve=downsample_equity(eq_times, eq_values),
        ))

    return CompareResponse(
        sl_pct=req.sl_pct,
        tp_pct=req.tp_pct,
        max_bars=req.max_bars,
        coins_used=req.top_n,
        data_range=data_manager.data_range(),
        strategies=results,
    )


@app.post("/admin/refresh")
async def refresh_data():
    """Manually trigger data refresh from Binance."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _refresh_data)
    return {"status": "ok", "coins": indicator_cache.count, "generated": coin_stats_cache["generated"] if coin_stats_cache else None}


# --- Market Dashboard ---

import xml.etree.ElementTree as ET
import requests as http_requests
from email.utils import parsedate_to_datetime

MARKET_CACHE_TTL = 120  # 2 minutes
_market_cache: Optional[dict] = None
_market_cache_time: float = 0
_news_cache: Optional[dict] = None
_news_cache_time: float = 0


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
    """Fetch global market data from CoinGecko."""
    try:
        resp = http_requests.get("https://api.coingecko.com/api/v3/global", timeout=5)
        resp.raise_for_status()
        data = resp.json()["data"]
        return {
            "total_market_cap_b": round(data["total_market_cap"].get("usd", 0) / 1e9, 1),
            "btc_dominance": round(data.get("market_cap_percentage", {}).get("btc", 0), 1),
            "total_volume_24h_b": round(data["total_volume"].get("usd", 0) / 1e9, 1),
        }
    except Exception as e:
        logger.warning(f"CoinGecko fetch failed: {e}")
        return {"total_market_cap_b": 0, "btc_dominance": 0, "total_volume_24h_b": 0}


def _fetch_coingecko_tickers() -> tuple:
    """Fetch market tickers from CoinGecko (NO Binance API).
    Returns (top_gainers, top_losers, btc_price, btc_change, eth_price, eth_change).
    """
    try:
        resp = http_requests.get(
            "https://api.coingecko.com/api/v3/coins/markets"
            "?vs_currency=usd&order=market_cap_desc&per_page=250&sparkline=false"
            "&price_change_percentage=24h",
            timeout=10,
        )
        resp.raise_for_status()
        coins = resp.json()

        # BTC / ETH
        btc = next((c for c in coins if c["symbol"] == "btc"), None)
        eth = next((c for c in coins if c["symbol"] == "eth"), None)
        btc_price = round(btc["current_price"], 2) if btc else 0
        btc_change = round(btc.get("price_change_percentage_24h") or 0, 2) if btc else 0
        eth_price = round(eth["current_price"], 2) if eth else 0
        eth_change = round(eth.get("price_change_percentage_24h") or 0, 2) if eth else 0

        # Filter coins with valid change data, convert symbol to USDT format
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
        logger.warning(f"CoinGecko tickers fetch failed: {e}")
        return [], [], 0, 0, 0, 0


def _fetch_coingecko_funding() -> list:
    """Fetch extreme funding rates from CoinGecko derivatives (NO Binance API).
    CoinGecko funding_rate is already a percentage decimal (e.g. -0.005 = -0.5%).
    We filter to major exchanges only to avoid noisy data.
    """
    MAJOR_EXCHANGES = {"binance", "bybit", "okx", "bitget", "dydx", "htx", "gate", "kucoin", "mexc"}
    try:
        resp = http_requests.get(
            "https://api.coingecko.com/api/v3/derivatives"
            "?include_tickers=unexpired",
            timeout=10,
        )
        resp.raise_for_status()
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
    """Build complete market overview. All data from CoinGecko + Alternative.me (NO Binance)."""
    fg = _fetch_fear_greed()
    cg = _fetch_coingecko_global()
    gainers, losers, btc_price, btc_change, eth_price, eth_change = _fetch_coingecko_tickers()
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
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
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
    """Get market overview with BTC/ETH prices, Fear & Greed, top movers, funding rates."""
    global _market_cache, _market_cache_time
    now = time.time()
    if _market_cache and (now - _market_cache_time) < MARKET_CACHE_TTL:
        return MarketOverview(**_market_cache)

    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, _build_market_overview)
    _market_cache = data
    _market_cache_time = now
    return MarketOverview(**data)


@app.get("/news", response_model=NewsResponse)
async def get_news():
    """Get aggregated crypto news from RSS feeds."""
    global _news_cache, _news_cache_time
    now = time.time()
    if _news_cache and (now - _news_cache_time) < MARKET_CACHE_TTL:
        return NewsResponse(**_news_cache)

    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, _build_news)
    _news_cache = data
    _news_cache_time = now
    return NewsResponse(**data)


# --- Macro Economic Endpoints ---

MACRO_CACHE_TTL = 300  # 5 minutes
_macro_cache: Optional[dict] = None
_macro_cache_time: float = 0

# FRED API (free, no key needed for public series, 120 req/min)
FRED_SERIES = {
    "DFF": {"name": "Fed Funds Rate", "unit": "%", "source": "FRED"},
    "DGS10": {"name": "US 10Y Treasury", "unit": "%", "source": "FRED"},
    "DGS2": {"name": "US 2Y Treasury", "unit": "%", "source": "FRED"},
    "DTWEXBGS": {"name": "US Dollar Index (Broad)", "unit": "Index", "source": "FRED"},
    "T10Y2Y": {"name": "10Y-2Y Yield Spread", "unit": "%", "source": "FRED"},
    "VIXCLS": {"name": "VIX (Volatility Index)", "unit": "Index", "source": "FRED"},
}


def _fetch_fred_series(series_id: str) -> dict:
    """Fetch latest value from FRED public API (no API key needed for observation)."""
    try:
        url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
        resp = http_requests.get(url, timeout=8)
        resp.raise_for_status()
        lines = resp.text.strip().split("\n")
        if len(lines) < 2:
            return {}
        # Parse CSV: DATE,VALUE
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
        result = {
            "value": float(latest_line[1]),
            "updated": latest_line[0],
        }
        if prev_line:
            result["previous"] = float(prev_line[1])
        return result
    except Exception as e:
        logger.warning(f"FRED fetch failed for {series_id}: {e}")
        return {}


def _build_macro_data() -> dict:
    """Build macro economic dashboard data. NO Binance API (shared IP with autotrader)."""
    indicators = []
    for series_id, info in FRED_SERIES.items():
        data = _fetch_fred_series(series_id)
        if data:
            indicators.append(MacroIndicator(
                id=series_id,
                name=info["name"],
                value=data["value"],
                previous=data.get("previous"),
                unit=info["unit"],
                updated=data.get("updated", ""),
                source=info["source"],
            ))

    return MacroResponse(
        indicators=indicators,
        derivatives=None,
        events=[],  # TradingView widget handles calendar on frontend
        generated=datetime.now(timezone.utc).isoformat(),
    ).model_dump()


@app.get("/macro", response_model=MacroResponse)
async def get_macro():
    """Get macro economic indicators and derivatives data."""
    global _macro_cache, _macro_cache_time
    now = time.time()
    if _macro_cache and (now - _macro_cache_time) < MACRO_CACHE_TTL:
        return MacroResponse(**_macro_cache)

    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, _build_macro_data)
    _macro_cache = data
    _macro_cache_time = now
    return MacroResponse(**data)


# --- Strategy Builder Endpoints (v1.1) ---

from src.engine.condition_engine import (
    ConditionEngine, validate_strategy_json,
    get_preset_strategies, PRESET_STRATEGIES,
)
from src.engine.indicator_pipeline import get_available_indicators, INDICATOR_REGISTRY
from api.schemas import (
    BacktestRequest, BacktestResponse, PresetListItem, IndicatorInfo, YearlyStat,
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

    # Get coins
    if req.symbols:
        coin_list = data_manager.get_symbols(req.symbols)
    else:
        coin_list = data_manager.get_top_n(req.top_n)

    if not coin_list:
        raise HTTPException(404, "No coins found.")

    # Run simulation
    cost_model = CostModel.futures()
    all_trades = []

    for sym, df_raw in coin_list:
        # Compute indicators via ConditionEngine
        df = engine.prepare_dataframe(df_raw.copy())

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
        )

        for trade in trades:
            all_trades.append({
                "time": trade.entry_time,
                "pnl_pct": trade.pnl_pct,
                "exit_reason": trade.exit_reason,
            })

    all_trades.sort(key=lambda t: t["time"])

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
            tp_count=0, sl_count=0, timeout_count=0,
            coins_used=len(coin_list), data_range=data_manager.data_range(),
            equity_curve=[],
            is_valid=True, validation_errors=[],
            compute_time_ms=int((time.time() - t_start) * 1000),
        )

    wins = [t for t in all_trades if t["pnl_pct"] > 0]
    losses = [t for t in all_trades if t["pnl_pct"] <= 0]
    gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.001
    total_return = sum(t["pnl_pct"] for t in all_trades)

    avg_win = (sum(t["pnl_pct"] for t in wins) / len(wins)) if wins else 0
    avg_loss = (sum(t["pnl_pct"] for t in losses) / len(losses)) if losses else 0

    # Equity + MDD
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    eq_times = []
    eq_values = []
    max_consec = 0
    cur_consec = 0

    for t in all_trades:
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

    compute_ms = int((time.time() - t_start) * 1000)

    return BacktestResponse(
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
        coins_used=len(coin_list),
        data_range=data_manager.data_range(),
        equity_curve=downsample_equity(eq_times, eq_values),
        is_valid=True,
        validation_errors=[],
        yearly_stats=yearly_stats,
        compute_time_ms=compute_ms,
    )
