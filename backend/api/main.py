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
)
from api.data_manager import DataManager
from api.indicator_cache import IndicatorCache
from src.simulation.engine import CostModel
from src.simulation.engine_fast import run_fast
from src.strategies.bb_squeeze import BBSqueezeStrategy

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
            strategy = BBSqueezeStrategy(avoid_hours=AVOID_HOURS)
            indicator_cache.build(data_manager, strategy)
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
        print("Pre-computing indicators...")
        strategy = BBSqueezeStrategy(avoid_hours=AVOID_HOURS)
        indicator_cache.build(data_manager, strategy)
        print(f"Indicators cached for {indicator_cache.count} coins in {indicator_cache._build_time:.1f}s")

        # Pre-compute coin stats for /coins/stats endpoint
        print("Pre-computing coin stats...")
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
    if request.url.path in ("/simulate", "/simulate/coin"):
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
    return [
        StrategyInfo(
            id="bb-squeeze",
            name="BB Squeeze",
            description="Bollinger Band squeeze breakout. Enters on volatility expansion after contraction.",
            default_params={
                "sl_pct": 10.0,
                "tp_pct": 8.0,
                "max_bars": 48,
                "direction": "short",
                "avoid_hours": AVOID_HOURS,
            },
        ),
    ]


@app.post("/simulate", response_model=SimulationResponse)
async def simulate(req: SimulationRequest):
    """Run a strategy simulation with pre-computed indicators."""

    if req.strategy != "bb-squeeze":
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")

    if data_manager.coin_count == 0:
        raise HTTPException(503, "Data not loaded yet. Try again shortly.")

    # Check cache
    ckey = cache_key(req)
    cached = get_cached(ckey)
    if cached:
        return SimulationResponse(**cached)

    # Get pre-computed indicator data (or raw data as fallback)
    use_precomputed = indicator_cache.count > 0

    if req.symbols:
        coins = indicator_cache.get_symbols(req.symbols) if use_precomputed else data_manager.get_symbols(req.symbols)
        if not coins:
            raise HTTPException(404, "None of the requested symbols found.")
    else:
        coins = indicator_cache.get_top_n(data_manager, req.top_n) if use_precomputed else data_manager.get_top_n(req.top_n)

    # Build strategy + cost model
    strategy = BBSqueezeStrategy(avoid_hours=AVOID_HOURS)
    cost_model = CostModel.futures() if req.market_type == "futures" else CostModel.spot()

    # Run simulation across all coins (vectorized fast engine)
    all_trades = []
    for sym, df in coins:
        if not use_precomputed:
            df = strategy.calculate_indicators(df.copy())

        result = run_fast(
            df, strategy, sym,
            sl_pct=req.sl_pct / 100,
            tp_pct=req.tp_pct / 100,
            max_bars=req.max_bars,
            fee_pct=cost_model.fee_pct,
            slippage_pct=cost_model.slippage_pct,
            direction=req.direction,
            market_type=req.market_type,
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
            strategy=req.strategy, direction=req.direction,
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
        "direction": req.direction,
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

        # Price & 24h change from last 2 bars
        last_close = float(df["close"].iloc[-1])
        prev_close = float(df["close"].iloc[-2]) if len(df) >= 2 else last_close
        change_24h = round(((last_close - prev_close) / prev_close) * 100, 2) if prev_close else 0
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
    df = indicator_cache.get(symbol)
    if df is None:
        raise HTTPException(404, f"Symbol not found: {symbol}")

    strategy = BBSqueezeStrategy(avoid_hours=AVOID_HOURS)
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


@app.post("/admin/refresh")
async def refresh_data():
    """Manually trigger data refresh from Binance."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _refresh_data)
    return {"status": "ok", "coins": indicator_cache.count, "generated": coin_stats_cache["generated"] if coin_stats_cache else None}
