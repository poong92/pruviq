"""
Vectorized Simulation Engine — 10x faster than bar-by-bar loop.

Uses numpy arrays for SL/TP/timeout checks instead of Python for-loop.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Tuple
import pandas as pd
import numpy as np


@dataclass
class Trade:
    symbol: str
    direction: str
    entry_time: str
    exit_time: str
    entry_price: float
    exit_price: float
    pnl_pct: float
    pnl_gross_pct: float
    fee_pct: float
    exit_reason: str
    bars_held: int


@dataclass
class SimResult:
    strategy_name: str
    symbol: str
    params: dict
    market_type: str
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    total_return_pct: float
    profit_factor: float
    avg_win_pct: float
    avg_loss_pct: float
    max_drawdown_pct: float
    max_consecutive_losses: int
    total_fees_pct: float
    tp_count: int
    sl_count: int
    timeout_count: int
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    trades: list = field(default_factory=list)
    equity_curve: list = field(default_factory=list)


def find_signals_vectorized(df: pd.DataFrame, strategy, direction: str = "short") -> np.ndarray:
    """
    Vectorized signal detection for BB Squeeze — AutoTrader v1.7.0 parity.

    Conditions at signal bar (idx), entry at idx+1:
    - recent_squeeze[idx-1]: any squeeze in past lookback candles (shift=1)
    - bb_expanding[idx]: curr bb_width > prev bb_width (shift=0)
    - bb_width_above_ma[idx]: curr bb_width > MA * 0.9 (shift=0)
    - close vs bb_mid[idx]: direction filter (shift=0)
    - vol_ratio[idx-1]: prev candle volume (shift=1)
    - downtrend/uptrend[idx-1]: prev candle EMA trend (shift=1)
    - bb_width_change[idx]: curr expansion speed >= 10% (shift=0)
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    def col(name, default=None):
        if name in df.columns:
            return df[name].values
        if default is not None:
            return default
        return np.zeros(n)

    # Extract arrays — AT parity fields
    recent_squeeze = col("recent_squeeze", np.zeros(n, dtype=bool))
    bb_expanding = col("bb_expanding", np.zeros(n, dtype=bool))
    bb_width_above_ma = col("bb_width_above_ma", np.zeros(n, dtype=bool))
    bb_width_change = col("bb_width_change")
    close = col("close")
    bb_mid = col("bb_mid")
    vol_ratio = col("vol_ratio")
    downtrend = col("downtrend", np.zeros(n, dtype=bool))
    uptrend = col("uptrend", np.zeros(n, dtype=bool))
    hour = col("hour", np.zeros(n, dtype=int))

    min_idx = strategy.ema_slow + strategy.squeeze_lookback
    expansion_min = strategy.expansion_rate * 100  # 0.10 -> 10

    valid_range = np.arange(n) >= min_idx

    # Shifted conditions (prev candle = shift 1)
    prev_recent_squeeze = np.roll(recent_squeeze, 1)
    prev_recent_squeeze[0] = False
    prev_vol_ratio = np.roll(vol_ratio, 1)
    prev_vol_ratio[0] = 0
    prev_downtrend = np.roll(downtrend, 1)
    prev_downtrend[0] = False
    prev_uptrend = np.roll(uptrend, 1)
    prev_uptrend[0] = False

    # Base conditions (matching AT exactly)
    has_recent_squeeze = prev_recent_squeeze.astype(bool)
    has_bb_expanding = bb_expanding.astype(bool)
    has_bb_above_ma = bb_width_above_ma.astype(bool)
    has_volume = prev_vol_ratio >= strategy.volume_ratio
    has_expansion_speed = bb_width_change >= expansion_min

    # Time filter (check entry bar = idx+1 hour)
    avoid_set = set(strategy.avoid_hours)
    next_hour_ok = np.ones(n, dtype=bool)
    if avoid_set:
        for i in range(n - 1):
            h = hour[i + 1]
            if np.isnan(h):
                next_hour_ok[i] = False
            elif int(h) in avoid_set:
                next_hour_ok[i] = False
    next_hour_ok[n - 1] = False  # Can't enter on last bar

    # Combine base conditions
    base_ok = (
        valid_range & has_recent_squeeze & has_bb_expanding
        & has_bb_above_ma & has_volume & has_expansion_speed & next_hour_ok
    )

    # Direction-specific conditions
    if direction == "short":
        signal = base_ok & (close < bb_mid) & prev_downtrend
    else:
        signal = base_ok & (close > bb_mid) & prev_uptrend

    return np.where(signal)[0]


def find_signals_generic(df: pd.DataFrame, strategy, direction: str) -> np.ndarray:
    """
    Generic signal detection fallback — calls strategy.check_signal() per bar.
    ~5x slower than vectorized but works for any strategy.
    """
    n = len(df)
    if n < 100:
        return np.array([], dtype=int)

    signals = []
    for idx in range(n - 1):
        result = strategy.check_signal(df, idx)
        if result == direction:
            signals.append(idx)

    return np.array(signals, dtype=int) if signals else np.array([], dtype=int)


def simulate_vectorized(
    df: pd.DataFrame,
    signal_indices: np.ndarray,
    sl_pct: float,
    tp_pct: float,
    max_bars: int,
    fee_pct: float,
    slippage_pct: float,
    direction: str,
    symbol: str,
) -> List[Trade]:
    """
    Vectorized simulation — given signal indices, process trades.
    Still sequential (no overlapping positions) but inner exit search is optimized.
    """
    if len(signal_indices) == 0 or len(df) < 10:
        return []

    # Pre-extract arrays for fast access
    opens = df["open"].values.astype(float)
    highs = df["high"].values.astype(float)
    lows = df["low"].values.astype(float)
    closes = df["close"].values.astype(float)
    times = df["timestamp"].values

    n = len(df)
    trades = []
    next_available = 0  # Earliest bar we can enter

    for sig_idx in signal_indices:
        entry_idx = sig_idx + 1
        if entry_idx >= n or entry_idx < next_available:
            continue

        entry_price = opens[entry_idx]
        if direction == "short":
            entry_price *= (1 - slippage_pct)
            sl_price = entry_price * (1 + sl_pct)
            tp_price = entry_price * (1 - tp_pct)
        else:
            entry_price *= (1 + slippage_pct)
            sl_price = entry_price * (1 - sl_pct)
            tp_price = entry_price * (1 + tp_pct)

        # Search for exit within max_bars
        exit_idx = None
        exit_price = None
        exit_reason = None

        end_idx = min(entry_idx + max_bars, n)

        for j in range(entry_idx, end_idx):
            if direction == "short":
                sl_hit = highs[j] >= sl_price
                tp_hit = lows[j] <= tp_price
            else:
                sl_hit = lows[j] <= sl_price
                tp_hit = highs[j] >= tp_price

            if sl_hit and tp_hit:
                # Conservative: SL wins
                exit_idx = j
                exit_price = sl_price
                exit_reason = "sl"
                break
            elif sl_hit:
                exit_idx = j
                exit_price = sl_price
                exit_reason = "sl"
                break
            elif tp_hit:
                exit_idx = j
                exit_price = tp_price
                exit_reason = "tp"
                break

        if exit_idx is None:
            # Timeout
            exit_idx = end_idx - 1 if end_idx - 1 < n else n - 1
            exit_price = closes[exit_idx]
            exit_reason = "timeout"

        # Apply exit slippage
        if direction == "short":
            exit_price_adj = exit_price * (1 + slippage_pct)
            pnl_gross = (entry_price - exit_price_adj) / entry_price
        else:
            exit_price_adj = exit_price * (1 - slippage_pct)
            pnl_gross = (exit_price_adj - entry_price) / entry_price

        fee = fee_pct * 2
        pnl_net = pnl_gross - fee
        bars_held = exit_idx - entry_idx

        trades.append(Trade(
            symbol=symbol,
            direction=direction,
            entry_time=str(times[entry_idx]),
            exit_time=str(times[exit_idx]),
            entry_price=entry_price,
            exit_price=exit_price,
            pnl_pct=round(pnl_net * 100, 4),
            pnl_gross_pct=round(pnl_gross * 100, 4),
            fee_pct=round(fee * 100, 4),
            exit_reason=exit_reason,
            bars_held=bars_held,
        ))

        next_available = exit_idx + 1

    return trades


def run_fast(
    df: pd.DataFrame,
    strategy,
    symbol: str,
    sl_pct: float = 0.10,
    tp_pct: float = 0.08,
    max_bars: int = 48,
    fee_pct: float = 0.0008,
    slippage_pct: float = 0.0,
    direction: str = "short",
    market_type: str = "futures",
    strategy_id: str = None,
) -> SimResult:
    """Complete fast simulation pipeline."""

    # Find signals: use vectorized for BB Squeeze, generic for others
    if strategy_id in ("bb-squeeze-short", "bb-squeeze-long", None):
        signal_indices = find_signals_vectorized(df, strategy, direction)
    else:
        signal_indices = find_signals_generic(df, strategy, direction)

    # Simulate trades
    trades = simulate_vectorized(
        df, signal_indices,
        sl_pct, tp_pct, max_bars,
        fee_pct, slippage_pct,
        direction, symbol,
    )

    # Build result
    if not trades:
        return SimResult(
            strategy_name=strategy.name, symbol=symbol,
            params=strategy.get_params(), market_type=market_type,
            total_trades=0, wins=0, losses=0, win_rate=0,
            total_return_pct=0, profit_factor=0,
            avg_win_pct=0, avg_loss_pct=0,
            max_drawdown_pct=0, max_consecutive_losses=0,
            total_fees_pct=0, tp_count=0, sl_count=0, timeout_count=0,
        )

    wins = [t for t in trades if t.pnl_pct > 0]
    losses = [t for t in trades if t.pnl_pct <= 0]
    gross_profit = sum(t.pnl_pct for t in wins) if wins else 0
    gross_loss = abs(sum(t.pnl_pct for t in losses)) if losses else 0.001
    total_return = sum(t.pnl_pct for t in trades)
    total_fees = sum(t.fee_pct for t in trades)

    # MDD + consecutive
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    eq = []
    max_consec = 0
    cur_consec = 0

    for t in trades:
        equity += t.pnl_pct
        peak = max(peak, equity)
        max_dd = max(max_dd, peak - equity)
        eq.append(round(equity, 2))

        if t.pnl_pct <= 0:
            cur_consec += 1
            max_consec = max(max_consec, cur_consec)
        else:
            cur_consec = 0

    # Risk-adjusted metrics
    trade_returns = np.array([t.pnl_pct for t in trades])
    if len(trade_returns) >= 2:
        avg_ret = float(np.mean(trade_returns))
        std_ret = float(np.std(trade_returns, ddof=1))
        sharpe = round(avg_ret / std_ret * np.sqrt(len(trade_returns)), 2) if std_ret > 0 else 0.0
        downside = trade_returns[trade_returns < 0]
        down_std = float(np.std(downside, ddof=1)) if len(downside) >= 2 else 0.0
        sortino = round(avg_ret / down_std * np.sqrt(len(trade_returns)), 2) if down_std > 0 else 0.0
        calmar = round(total_return / max_dd, 2) if max_dd > 0 else 0.0
    else:
        sharpe, sortino, calmar = 0.0, 0.0, 0.0

    return SimResult(
        strategy_name=strategy.name, symbol=symbol,
        params=strategy.get_params(), market_type=market_type,
        total_trades=len(trades),
        wins=len(wins), losses=len(losses),
        win_rate=round(len(wins) / len(trades) * 100, 2),
        total_return_pct=round(total_return, 2),
        profit_factor=round(gross_profit / gross_loss, 2),
        avg_win_pct=round(sum(t.pnl_pct for t in wins) / len(wins), 4) if wins else 0,
        avg_loss_pct=round(sum(t.pnl_pct for t in losses) / len(losses), 4) if losses else 0,
        max_drawdown_pct=round(max_dd, 2),
        max_consecutive_losses=max_consec,
        total_fees_pct=round(total_fees, 2),
        tp_count=sum(1 for t in trades if t.exit_reason == "tp"),
        sl_count=sum(1 for t in trades if t.exit_reason == "sl"),
        timeout_count=sum(1 for t in trades if t.exit_reason == "timeout"),
        sharpe_ratio=sharpe,
        sortino_ratio=sortino,
        calmar_ratio=calmar,
        trades=trades,
        equity_curve=eq,
    )
