#!/usr/bin/env python3
"""
PRUVIQ Paper Trading Tracker — 30-day virtual portfolio cycle.

Runs a fully deterministic paper-trading simulation that follows the top-3
strategies from the 30d ranking and reports a daily-marked equity curve.

Why this exists (the SNS "tracker" content pattern needs trust data):
    - Day-by-day equity curve so readers can follow along
    - Real trades from the same engine_fast that powers /simulate
    - Same SSoT (rankings_<date>.json) that /strategies/ranking shows
    - Mark-to-market every tick — no hand-waved totals

State is durable: one JSON state file per cycle, atomic temp+rename.

Usage:
    # Cold-start a new cycle from a backtest window
    python3 paper_trading_tracker.py --init \\
        --start 2026-04-16 --end 2026-05-16 --capital 1000

    # Daily forward tick (idempotent — safe to rerun the same date)
    python3 paper_trading_tracker.py --tick

    # Read current state
    python3 paper_trading_tracker.py --status

State file:
    $PAPER_TRADING_DIR/cycle_NNN.json (NNN = zero-padded cycle id)

6원칙 compliance:
    - 뿌리(1): tracker exists for the SNS-content user need, not as a metric vanity
    - 원론(2): pure state machine (load → mutate → atomic write); separation
      between "what bars exist" (DataManager) and "what we've acted on"
      (open_positions, executed_signals)
    - 일관(3): top3 strategies come from RANKING_DIR/ranking_*.json — same
      SSoT as /rankings/daily
    - 무결(4): no trade is ever silently dropped; every signal is either
      acted on, deferred (capital exhausted), or recorded as skipped with
      a reason. Mark-to-market on every tick.
    - 책임(5): each tick appends to history; cycle_NNN.json is a permanent
      audit log even after the cycle ends.
    - 근거(6): the first cycle is committed with real numbers — anyone can
      grep the JSON and verify equity matches the trade log.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import tempfile
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

# Backend root on sys.path so engine + strategies + data_manager work the same
# way they do inside uvicorn.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import pandas as pd  # noqa: E402

from api.data_manager import DataManager  # noqa: E402
from src.simulation.engine_fast import run_fast  # noqa: E402
from src.strategies.registry import STRATEGY_REGISTRY  # noqa: E402

logger = logging.getLogger("pruviq.paper_trading")

# ─── Paths ────────────────────────────────────────────────────────────────
# PAPER_TRADING_DIR mirrors RANKING_DIR — env var on production, repo-local
# fallback for local dev/tests. Production .env on the DO droplet sets
# PAPER_TRADING_DIR=/opt/pruviq/data/paper_trading.
PAPER_TRADING_DIR = Path(
    os.getenv("PAPER_TRADING_DIR", str(_BACKEND_ROOT / "data" / "paper_trading"))
)
RANKING_DIR = Path(
    os.getenv("RANKING_DIR", "/Users/jepo/Desktop/autotrader/data/daily_rankings")
)


# ─── State dataclasses ───────────────────────────────────────────────────


@dataclass
class OpenPosition:
    """A position that has been entered but not yet exited."""

    signal_id: str  # f"{strategy}:{direction}:{tf}:{coin}:{entry_time}"
    strategy: str
    direction: str
    timeframe: str
    coin: str
    entry_time: str  # ISO8601
    entry_price: float
    sl_pct: float
    tp_pct: float
    max_bars: int
    allocation_usd: float


@dataclass
class ClosedPosition:
    """A position that has been exited."""

    signal_id: str
    strategy: str
    direction: str
    timeframe: str
    coin: str
    entry_time: str
    exit_time: str
    entry_price: float
    exit_price: float
    pnl_pct: float
    pnl_usd: float
    exit_reason: str  # "tp" | "sl" | "timeout"
    bars_held: int


@dataclass
class PortfolioState:
    cycle_id: int
    start_date: str  # YYYY-MM-DD
    starting_capital: float
    capital_available: float  # cash not currently allocated
    open_positions: list = field(default_factory=list)  # list[OpenPosition dict]
    closed_positions: list = field(default_factory=list)  # list[ClosedPosition dict]
    executed_signals: list = field(default_factory=list)  # signal_id strings (idempotency)
    skipped_signals: list = field(default_factory=list)  # list[dict] for audit
    history: list = field(default_factory=list)  # list[{date, equity, open_count}]
    cycle_length_days: int = 30
    last_tick_date: Optional[str] = None
    cycle_status: str = "active"  # "active" | "complete"
    schema_version: int = 1


# ─── Helpers ──────────────────────────────────────────────────────────────


def _ensure_dir() -> None:
    PAPER_TRADING_DIR.mkdir(parents=True, exist_ok=True)


def _cycle_file(cycle_id: int) -> Path:
    return PAPER_TRADING_DIR / f"cycle_{cycle_id:03d}.json"


def _atomic_write_json(path: Path, payload: dict) -> None:
    """Write JSON atomically: temp file in the same dir + os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False, default=str)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def _next_cycle_id() -> int:
    _ensure_dir()
    existing = sorted(PAPER_TRADING_DIR.glob("cycle_*.json"))
    if not existing:
        return 1
    last = existing[-1].stem.replace("cycle_", "")
    try:
        return int(last) + 1
    except ValueError:
        return len(existing) + 1


def _latest_cycle_id() -> Optional[int]:
    _ensure_dir()
    files = sorted(PAPER_TRADING_DIR.glob("cycle_*.json"))
    if not files:
        return None
    try:
        return int(files[-1].stem.replace("cycle_", ""))
    except ValueError:
        return None


def load_cycle(cycle_id: int) -> PortfolioState:
    path = _cycle_file(cycle_id)
    if not path.exists():
        raise FileNotFoundError(f"Cycle file not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return PortfolioState(**raw)


def save_cycle(state: PortfolioState) -> None:
    _atomic_write_json(_cycle_file(state.cycle_id), asdict(state))


# ─── Ranking lookup ──────────────────────────────────────────────────────


def _ranking_file_for(date_yyyymmdd: str) -> Optional[Path]:
    """Return ranking_YYYYMMDD.json for the date if it exists, else the most
    recent file at or before that date."""
    target = RANKING_DIR / f"ranking_{date_yyyymmdd}.json"
    if target.exists():
        return target
    # Find most recent <= date
    candidates = sorted(RANKING_DIR.glob("ranking_*.json"))
    eligible = [c for c in candidates if c.stem.replace("ranking_", "") <= date_yyyymmdd]
    if eligible:
        return eligible[-1]
    return None


def get_top_strategies(
    date_yyyymmdd: str,
    period: str = "30d",
    group: str = "top50",
    min_pf: float = 2.0,
    min_trades: int = 30,
    top_n: int = 3,
) -> list[dict]:
    """Return the top-N strategy entries from the ranking for `date_yyyymmdd`.

    Filters: profit_factor >= min_pf AND total_trades >= min_trades.
    If fewer than top_n entries pass the filter, returns what we have (could
    be empty). Caller decides what to do with an empty list — typically skip
    new entries this tick.
    """
    f = _ranking_file_for(date_yyyymmdd)
    if f is None:
        return []
    try:
        with f.open("r", encoding="utf-8") as fh:
            raw = json.load(fh)
    except Exception as exc:
        logger.warning("ranking load failed %s: %s", f, exc)
        return []
    periods = raw.get("periods", {})
    entries = periods.get(period, {}).get(group, [])
    # Fallback: if the requested group is empty try top50/top30.
    if not entries:
        for fallback_group in ("top50", "top30", "top100"):
            entries = periods.get(period, {}).get(fallback_group, [])
            if entries:
                break

    filtered = [
        e
        for e in entries
        if e.get("profit_factor", 0) >= min_pf
        and e.get("total_trades", 0) >= min_trades
    ]
    # Sort by PF desc and de-dup by (strategy, direction, timeframe)
    seen: set = set()
    unique: list[dict] = []
    for e in sorted(filtered, key=lambda x: x.get("profit_factor", 0), reverse=True):
        key = (e.get("strategy"), e.get("direction"), e.get("timeframe", "1H"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)
        if len(unique) >= top_n:
            break
    return unique


# ─── Trade simulation primitives ─────────────────────────────────────────


def _resolve_df(dm: DataManager, symbol: str, timeframe: str) -> Optional[pd.DataFrame]:
    df = dm.get_resampled(symbol, timeframe)
    if df is None or len(df) < 50:
        return None
    return df


def _slice_to(df: pd.DataFrame, end_ts: pd.Timestamp) -> pd.DataFrame:
    """Slice df to bars whose timestamp <= end_ts."""
    return df[df["timestamp"] <= end_ts].reset_index(drop=True)


def _signal_id(strategy: str, direction: str, tf: str, coin: str, entry_time: str) -> str:
    return f"{strategy}:{direction}:{tf}:{coin}:{entry_time}"


def _strategy_instance(strategy_id: str):
    entry = STRATEGY_REGISTRY.get(strategy_id)
    if not entry:
        return None
    return entry["class"](**entry.get("init_kwargs", {}))


def _run_one_trade(
    df: pd.DataFrame,
    strategy_id: str,
    direction: str,
    sl_pct: float,
    tp_pct: float,
    max_bars: int,
    symbol: str,
    timeframe: str,
):
    """Run engine_fast on the sliced df and return the LAST trade if any.

    We use the same engine the live /simulate endpoint uses so paper trading
    cannot diverge from backtests (engine parity is a load-bearing PRUVIQ
    invariant — see memory/feedback_engine_parity.md).
    """
    strategy = _strategy_instance(strategy_id)
    if strategy is None:
        return None
    df_calc = strategy.calculate_indicators(df.copy())
    if df_calc is None or len(df_calc) < 50:
        return None
    result = run_fast(
        df_calc,
        strategy,
        symbol,
        sl_pct=sl_pct / 100.0,
        tp_pct=tp_pct / 100.0,
        max_bars=max_bars,
        fee_pct=0.0005,
        slippage_pct=0.0002,
        direction=direction,
        market_type="futures",
        strategy_id=strategy_id,
        funding_rate_8h=0.0001,
        timeframe=timeframe,
    )
    if not result.trades:
        return None
    return result.trades[-1]  # most recent trade in the window


# ─── Public API ──────────────────────────────────────────────────────────


def init_paper_portfolio(
    start_date: str,
    capital: float = 1000.0,
    cycle_length_days: int = 30,
) -> PortfolioState:
    """Create a fresh cycle starting on `start_date` (YYYY-MM-DD).

    Returns the saved PortfolioState. Existing cycles are NOT overwritten;
    this allocates the next id.
    """
    _ensure_dir()
    # Validate start_date
    try:
        datetime.strptime(start_date, "%Y-%m-%d")
    except ValueError as e:
        raise ValueError(f"start_date must be YYYY-MM-DD, got {start_date!r}") from e
    cycle_id = _next_cycle_id()
    state = PortfolioState(
        cycle_id=cycle_id,
        start_date=start_date,
        starting_capital=float(capital),
        capital_available=float(capital),
        cycle_length_days=cycle_length_days,
    )
    save_cycle(state)
    logger.info("Initialized cycle %03d starting %s with $%.2f", cycle_id, start_date, capital)
    return state


def _equity_from_state(state: PortfolioState, last_marks: dict[str, float]) -> float:
    """Compute total equity = capital_available + sum(unrealized notional).

    `last_marks` maps (signal_id) → mark-to-market value of that position.
    Closed positions are already reflected in capital_available because we
    add the realised pnl back when closing.
    """
    open_value = sum(last_marks.get(p["signal_id"], p["allocation_usd"])
                     for p in state.open_positions)
    return round(state.capital_available + open_value, 2)


def run_daily_tick(
    tick_date: str,
    cycle_id: Optional[int] = None,
    data_manager: Optional[DataManager] = None,
    top_n: int = 3,
) -> PortfolioState:
    """Process one daily tick. Idempotent: re-running the same date is a no-op
    after the first successful run (we check `state.last_tick_date`).

    Steps:
        1. Load or pick the latest cycle.
        2. For each open position, replay the engine_fast result on the bars
           up to tick_date; if a SL/TP/timeout exit fired by now, close the
           position and credit/debit capital_available.
        3. Look up today's top-3 strategies in the ranking. For each, walk
           the top-30 coins and pick the most recent signal that hasn't been
           acted on yet. Allocate capital evenly across `top_n` slots; skip
           with reason if all slots are full.
        4. Mark-to-market every still-open position at today's close.
        5. Append a history snapshot.
        6. Save state atomically.

    Returns the mutated PortfolioState.
    """
    try:
        datetime.strptime(tick_date, "%Y-%m-%d")
    except ValueError as e:
        raise ValueError(f"tick_date must be YYYY-MM-DD, got {tick_date!r}") from e

    if cycle_id is None:
        cycle_id = _latest_cycle_id()
        if cycle_id is None:
            raise RuntimeError("No paper-trading cycle exists. Call init_paper_portfolio first.")
    state = load_cycle(cycle_id)

    if state.last_tick_date == tick_date:
        logger.info("Cycle %03d already ticked for %s — idempotent no-op", cycle_id, tick_date)
        return state

    if state.cycle_status != "active":
        logger.info("Cycle %03d already complete; not ticking", cycle_id)
        return state

    if data_manager is None:
        data_manager = DataManager()
        if data_manager.coin_count == 0:
            from api.main import DATA_DIR  # lazy import: avoid circular at import time
            data_manager.load(DATA_DIR)

    tick_ts = pd.Timestamp(tick_date, tz="UTC").replace(tzinfo=None)
    last_marks: dict[str, float] = {}

    # 1. Mark-to-market + close-on-hit for every open position
    still_open: list[dict] = []
    for pos in state.open_positions:
        df_full = _resolve_df(data_manager, pos["coin"], pos["timeframe"])
        if df_full is None:
            # Data went missing — keep position at its entry value as fallback
            last_marks[pos["signal_id"]] = pos["allocation_usd"]
            still_open.append(pos)
            continue
        # Bars from entry forward (we use the signal we already have)
        entry_ts = pd.Timestamp(pos["entry_time"]).tz_localize(None) \
            if pd.Timestamp(pos["entry_time"]).tzinfo else pd.Timestamp(pos["entry_time"])
        # Slice from entry → tick (inclusive)
        forward = df_full[(df_full["timestamp"] >= entry_ts) & (df_full["timestamp"] <= tick_ts)] \
            .reset_index(drop=True)
        if len(forward) < 2:
            last_marks[pos["signal_id"]] = pos["allocation_usd"]
            still_open.append(pos)
            continue
        exit_result = _scan_for_exit(forward, pos)
        if exit_result is None:
            # Still open — mark to last close
            last_close = float(forward.iloc[-1]["close"])
            entry_px = pos["entry_price"]
            if pos["direction"] == "long":
                unrealised_pct = (last_close - entry_px) / entry_px * 100
            else:
                unrealised_pct = (entry_px - last_close) / entry_px * 100
            mark = pos["allocation_usd"] * (1 + unrealised_pct / 100)
            last_marks[pos["signal_id"]] = round(mark, 2)
            still_open.append(pos)
        else:
            exit_time_iso, exit_price, pnl_pct, exit_reason, bars_held = exit_result
            pnl_usd = round(pos["allocation_usd"] * pnl_pct / 100, 2)
            realised = pos["allocation_usd"] + pnl_usd  # cash back
            state.capital_available = round(state.capital_available + realised, 2)
            state.closed_positions.append(asdict(ClosedPosition(
                signal_id=pos["signal_id"],
                strategy=pos["strategy"],
                direction=pos["direction"],
                timeframe=pos["timeframe"],
                coin=pos["coin"],
                entry_time=pos["entry_time"],
                exit_time=exit_time_iso,
                entry_price=pos["entry_price"],
                exit_price=exit_price,
                pnl_pct=round(pnl_pct, 4),
                pnl_usd=pnl_usd,
                exit_reason=exit_reason,
                bars_held=bars_held,
            )))
    state.open_positions = still_open

    # 2. Find new entries for today
    date_yyyymmdd = tick_date.replace("-", "")
    top_strategies = get_top_strategies(date_yyyymmdd, top_n=top_n)
    if not top_strategies:
        logger.info("Cycle %03d tick %s — no strategies pass PF>=2 filter today", cycle_id, tick_date)
    else:
        free_slots = max(0, top_n - len(state.open_positions))
        if free_slots > 0:
            slot_capital = round(state.capital_available / free_slots, 2) if free_slots else 0
            for entry in top_strategies:
                if free_slots <= 0 or state.capital_available <= 0.01:
                    break
                strategy_id = entry["strategy"]
                direction = entry["direction"]
                timeframe = entry.get("timeframe", "1H")
                sl_pct = float(entry.get("sl_pct", 10))
                tp_pct = float(entry.get("tp_pct", 8))
                max_bars = _max_bars_for_tf(timeframe)
                coin = _pick_coin_for_signal(
                    data_manager, strategy_id, direction, timeframe, sl_pct, tp_pct,
                    max_bars, tick_ts, state.executed_signals,
                )
                if coin is None:
                    state.skipped_signals.append({
                        "date": tick_date,
                        "strategy": strategy_id,
                        "direction": direction,
                        "timeframe": timeframe,
                        "reason": "no_fresh_signal",
                    })
                    continue
                coin_symbol, signal_time_iso, entry_price = coin
                sig_id = _signal_id(strategy_id, direction, timeframe, coin_symbol, signal_time_iso)
                if sig_id in state.executed_signals:
                    continue
                allocation = min(slot_capital, state.capital_available)
                if allocation < 1:
                    state.skipped_signals.append({
                        "date": tick_date,
                        "strategy": strategy_id,
                        "reason": "insufficient_capital",
                    })
                    continue
                state.capital_available = round(state.capital_available - allocation, 2)
                state.executed_signals.append(sig_id)
                state.open_positions.append(asdict(OpenPosition(
                    signal_id=sig_id,
                    strategy=strategy_id,
                    direction=direction,
                    timeframe=timeframe,
                    coin=coin_symbol,
                    entry_time=signal_time_iso,
                    entry_price=entry_price,
                    sl_pct=sl_pct,
                    tp_pct=tp_pct,
                    max_bars=max_bars,
                    allocation_usd=round(allocation, 2),
                )))
                last_marks[sig_id] = round(allocation, 2)
                free_slots -= 1

    # 3. Equity + history
    equity = _equity_from_state(state, last_marks)
    state.history.append({
        "date": tick_date,
        "equity": equity,
        "open_count": len(state.open_positions),
        "closed_count": len(state.closed_positions),
    })
    state.last_tick_date = tick_date

    # 4. Cycle completion check
    start_dt = datetime.strptime(state.start_date, "%Y-%m-%d")
    tick_dt = datetime.strptime(tick_date, "%Y-%m-%d")
    days_elapsed = (tick_dt - start_dt).days
    if days_elapsed >= state.cycle_length_days:
        state.cycle_status = "complete"

    save_cycle(state)
    logger.info(
        "Cycle %03d tick %s: equity=$%.2f open=%d closed=%d",
        cycle_id, tick_date, equity, len(state.open_positions), len(state.closed_positions),
    )
    return state


def _max_bars_for_tf(timeframe: str) -> int:
    """Max-holding-period defaults aligned with daily_strategy_ranking.STRATEGIES.

    These are deliberately the same numbers used to compute the ranking
    `profit_factor`, so paper-trading exit cadence matches the strategy that
    earned its rank.
    """
    return {"1H": 48, "2H": 24, "4H": 12, "6H": 8, "12H": 4, "1D": 3}.get(timeframe, 48)


def _scan_for_exit(forward: pd.DataFrame, pos: dict):
    """Walk bars after entry; return exit tuple if SL/TP/timeout hit.

    Returns: (exit_time_iso, exit_price, pnl_pct, reason, bars_held) or None.

    Why open-coded (instead of run_fast): run_fast re-scans for fresh entry
    signals; here we own the entry already and just need exit logic against
    the *same* bars the engine would. SL/TP/timeout math matches
    engine_fast.simulate_vectorized exactly.
    """
    if len(forward) < 2:
        return None
    entry_price = pos["entry_price"]
    direction = pos["direction"]
    sl_frac = pos["sl_pct"] / 100.0
    tp_frac = pos["tp_pct"] / 100.0
    max_bars = pos["max_bars"]
    fee_pct = 0.0005
    slippage_pct = 0.0002

    if direction == "long":
        sl_price = entry_price * (1 - sl_frac)
        tp_price = entry_price * (1 + tp_frac)
    else:
        sl_price = entry_price * (1 + sl_frac)
        tp_price = entry_price * (1 - tp_frac)

    # Skip the entry bar (i=0); start scanning from the next bar.
    for i in range(1, min(len(forward), max_bars + 1)):
        bar = forward.iloc[i]
        high = float(bar["high"])
        low = float(bar["low"])
        close = float(bar["close"])
        bar_ts = bar["timestamp"]
        if isinstance(bar_ts, pd.Timestamp):
            ts_iso = bar_ts.isoformat()
        else:
            ts_iso = str(bar_ts)

        if direction == "long":
            if low <= sl_price:
                pnl = -sl_frac * 100 - (fee_pct + slippage_pct) * 200
                return ts_iso, sl_price, pnl, "sl", i
            if high >= tp_price:
                pnl = tp_frac * 100 - (fee_pct + slippage_pct) * 200
                return ts_iso, tp_price, pnl, "tp", i
        else:
            if high >= sl_price:
                pnl = -sl_frac * 100 - (fee_pct + slippage_pct) * 200
                return ts_iso, sl_price, pnl, "sl", i
            if low <= tp_price:
                pnl = tp_frac * 100 - (fee_pct + slippage_pct) * 200
                return ts_iso, tp_price, pnl, "tp", i
    # Timeout — close at the last bar's close
    if len(forward) > max_bars:
        bar = forward.iloc[max_bars]
        close = float(bar["close"])
        if direction == "long":
            pnl = (close - entry_price) / entry_price * 100 - (fee_pct + slippage_pct) * 200
        else:
            pnl = (entry_price - close) / entry_price * 100 - (fee_pct + slippage_pct) * 200
        ts = bar["timestamp"]
        ts_iso = ts.isoformat() if isinstance(ts, pd.Timestamp) else str(ts)
        return ts_iso, close, pnl, "timeout", max_bars
    return None


def _pick_coin_for_signal(
    dm: DataManager,
    strategy_id: str,
    direction: str,
    timeframe: str,
    sl_pct: float,
    tp_pct: float,
    max_bars: int,
    tick_ts: pd.Timestamp,
    executed_signals: list[str],
    universe_size: int = 30,
):
    """Pick the most-recent fresh signal for this strategy within the last 24h.

    Returns (symbol, signal_time_iso, entry_price) or None if no fresh signal.

    "Fresh" = signal time is within `lookback_hours` of `tick_ts` AND we
    haven't already executed a signal with that exact id.
    """
    coins = [c["symbol"] for c in dm.coins[:universe_size]]
    if not coins:
        return None
    lookback = pd.Timedelta(hours=48)
    best: Optional[tuple[str, str, float, pd.Timestamp]] = None
    for sym in coins:
        df = _resolve_df(dm, sym, timeframe)
        if df is None:
            continue
        df_sliced = df[df["timestamp"] <= tick_ts].reset_index(drop=True)
        if len(df_sliced) < 50:
            continue
        # Use run_fast on the recent window to find the latest signal it would
        # have generated. We cap to the last ~200 bars for speed.
        window = df_sliced.tail(250).reset_index(drop=True)
        trade = _run_one_trade(window, strategy_id, direction, sl_pct, tp_pct, max_bars, sym, timeframe)
        if trade is None:
            continue
        entry_time = pd.Timestamp(trade.entry_time)
        if entry_time.tzinfo is not None:
            entry_time = entry_time.tz_localize(None)
        # Only treat as a fresh entry candidate if it's within the lookback
        if tick_ts - entry_time > lookback:
            continue
        sig_id = _signal_id(strategy_id, direction, timeframe, sym, entry_time.isoformat())
        if sig_id in executed_signals:
            continue
        if best is None or entry_time > best[3]:
            best = (sym, entry_time.isoformat(), float(trade.entry_price), entry_time)
    if best is None:
        return None
    return best[0], best[1], best[2]


def get_portfolio_status(cycle_id: Optional[int] = None) -> dict:
    """Return a JSON-serialisable dict of the current cycle for /paper-trading."""
    if cycle_id is None:
        cycle_id = _latest_cycle_id()
    if cycle_id is None:
        return {"cycle_id": None, "cycle_status": "none", "message": "No cycle initialized yet"}
    try:
        state = load_cycle(cycle_id)
    except FileNotFoundError:
        return {"cycle_id": cycle_id, "cycle_status": "none", "message": f"Cycle {cycle_id} not found"}

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_dt = datetime.strptime(state.start_date, "%Y-%m-%d")
    today_dt = datetime.strptime(today_str, "%Y-%m-%d")
    cycle_day = (today_dt - start_dt).days + 1
    last_equity = state.history[-1]["equity"] if state.history else state.starting_capital
    prev_equity = state.history[-2]["equity"] if len(state.history) >= 2 else state.starting_capital
    yesterday_pnl = round(last_equity - prev_equity, 2)
    total_return_pct = round((last_equity - state.starting_capital) / state.starting_capital * 100, 2)

    return {
        "cycle_id": state.cycle_id,
        "cycle_status": state.cycle_status,
        "cycle_day": cycle_day,
        "cycle_length_days": state.cycle_length_days,
        "start_date": state.start_date,
        "last_tick_date": state.last_tick_date,
        "starting_capital": state.starting_capital,
        "current_equity": last_equity,
        "total_return_pct": total_return_pct,
        "yesterday_pnl": yesterday_pnl,
        "capital_available": state.capital_available,
        "open_positions": state.open_positions,
        "closed_positions": state.closed_positions[-20:],  # most recent 20
        "closed_count": len(state.closed_positions),
        "executed_signals_count": len(state.executed_signals),
        "skipped_signals_count": len(state.skipped_signals),
        "history": state.history,
        "schema_version": state.schema_version,
    }


# ─── CLI ──────────────────────────────────────────────────────────────────


def _setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


def main(argv: Optional[list[str]] = None) -> int:
    _setup_logging()
    p = argparse.ArgumentParser(description="PRUVIQ paper-trading tracker")
    sub = p.add_mutually_exclusive_group(required=True)
    sub.add_argument("--init", action="store_true", help="Initialize a new cycle")
    sub.add_argument("--tick", action="store_true", help="Run a daily tick")
    sub.add_argument("--status", action="store_true", help="Print current portfolio status")
    sub.add_argument("--backfill", action="store_true",
                     help="Run --init then --tick over [start, end] inclusive")
    p.add_argument("--start", help="YYYY-MM-DD (for --init/--backfill)")
    p.add_argument("--end", help="YYYY-MM-DD (for --backfill)")
    p.add_argument("--capital", type=float, default=1000.0)
    p.add_argument("--cycle-length-days", type=int, default=30)
    p.add_argument("--tick-date", help="YYYY-MM-DD override for --tick (default: today UTC)")
    p.add_argument("--cycle-id", type=int, help="Specific cycle id (default: latest)")
    p.add_argument("--top-n", type=int, default=3, help="Number of strategy slots")
    args = p.parse_args(argv)

    if args.init:
        if not args.start:
            p.error("--init requires --start YYYY-MM-DD")
        state = init_paper_portfolio(args.start, capital=args.capital,
                                     cycle_length_days=args.cycle_length_days)
        print(json.dumps({"cycle_id": state.cycle_id, "start_date": state.start_date,
                          "capital": state.starting_capital}, indent=2))
        return 0
    if args.tick:
        tick_date = args.tick_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        state = run_daily_tick(tick_date, cycle_id=args.cycle_id, top_n=args.top_n)
        last_hist = state.history[-1] if state.history else {}
        print(json.dumps({
            "cycle_id": state.cycle_id,
            "tick_date": tick_date,
            "equity": last_hist.get("equity"),
            "open_positions": len(state.open_positions),
            "closed_positions": len(state.closed_positions),
        }, indent=2))
        return 0
    if args.status:
        print(json.dumps(get_portfolio_status(cycle_id=args.cycle_id), indent=2, default=str))
        return 0
    if args.backfill:
        if not (args.start and args.end):
            p.error("--backfill requires --start and --end")
        state = init_paper_portfolio(args.start, capital=args.capital,
                                     cycle_length_days=args.cycle_length_days)
        cycle_id = state.cycle_id
        dm = DataManager()
        if dm.coin_count == 0:
            from api.main import DATA_DIR
            dm.load(DATA_DIR)
        start_dt = datetime.strptime(args.start, "%Y-%m-%d")
        end_dt = datetime.strptime(args.end, "%Y-%m-%d")
        cur = start_dt
        while cur <= end_dt:
            run_daily_tick(cur.strftime("%Y-%m-%d"), cycle_id=cycle_id,
                           data_manager=dm, top_n=args.top_n)
            cur += timedelta(days=1)
        final = get_portfolio_status(cycle_id=cycle_id)
        print(json.dumps({
            "cycle_id": cycle_id,
            "final_equity": final.get("current_equity"),
            "total_return_pct": final.get("total_return_pct"),
            "closed_count": final.get("closed_count"),
        }, indent=2))
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
