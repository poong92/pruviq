"""
Research Framework — 범용 전략 연구 인프라

모든 연구 스크립트가 이 프레임워크를 사용한다.
데이터 로딩, 시뮬레이션, 메트릭 계산, 결과 저장을 표준화.

사용법:
    from research.framework import ResearchEngine
    engine = ResearchEngine(top_n=30)
    result = engine.simulate("atr-breakout", "short", sl=7, tp=7)
    engine.save("experiment_name", results)
"""

import csv
import hashlib
import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# Add backend to path
_BACKEND = Path(__file__).parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from src.strategies.registry import STRATEGY_REGISTRY, get_strategy
from src.simulation.engine_fast import run_fast


# ============================================================
# Constants
# ============================================================
DATA_DIRS = [
    _BACKEND / "data" / "futures",
    Path.home() / "Desktop" / "autotrader" / "data" / "futures",
    Path.home() / "pruviq-data" / "futures",
]

COST_MODEL = {
    "fee_pct": 0.0008,       # 0.08% per side
    "slippage_pct": 0.0002,  # 0.02%
    "funding_rate_8h": 0.0001,  # 0.01% per 8h
}

STRATEGY_GROUPS = {
    "squeeze": {"bb-squeeze-short", "bb-squeeze-long", "hv-squeeze", "keltner-squeeze"},
    "trend": {"macd-cross", "supertrend", "ma-cross", "adx-trend", "ichimoku"},
    "reversal": {"rsi-divergence", "mean-reversion", "stochastic-rsi"},
    "breakout": {"momentum-long", "atr-breakout", "donchian-breakout", "heikin-ashi"},
}


# ============================================================
# Metrics
# ============================================================
def calc_metrics(pnls: list) -> dict:
    """Calculate standard metrics from a list of trade PnLs (%)."""
    if not pnls:
        return {"pf": 0, "wr": 0, "trades": 0, "sharpe": 0, "sortino": 0,
                "mdd": 0, "ret": 0, "avg_win": 0, "avg_loss": 0,
                "max_consec_loss": 0, "calmar": 0}

    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]
    tw = sum(wins) if wins else 0
    tl = abs(sum(losses)) if losses else 0.001

    # Equity curve (100-based, compound)
    eq = [100.0]
    for p in pnls:
        eq.append(eq[-1] * (1 + p / 100))
    ea = np.array(eq)
    peaks = np.maximum.accumulate(ea)
    dd = (peaks - ea) / peaks * 100
    mdd = float(np.max(dd))

    # Sharpe (annualized, sqrt(N) scaling)
    pa = np.array(pnls)
    std = float(np.std(pa))
    sharpe = float(np.mean(pa) / std * np.sqrt(len(pa))) if std > 0 else 0

    # Sortino
    downside = pa[pa < 0]
    down_std = float(np.std(downside)) if len(downside) > 0 else 0.001
    sortino = float(np.mean(pa) / down_std * np.sqrt(len(pa))) if down_std > 0 else 0

    # Max consecutive losses
    max_consec = consec = 0
    for p in pnls:
        if p <= 0:
            consec += 1
            max_consec = max(max_consec, consec)
        else:
            consec = 0

    total_ret = sum(pnls)
    calmar = round(total_ret / mdd, 2) if mdd > 0 else 0

    return {
        "pf": round(tw / tl, 2),
        "wr": round(len(wins) / len(pnls) * 100, 1),
        "trades": len(pnls),
        "sharpe": round(sharpe, 2),
        "sortino": round(sortino, 2),
        "mdd": round(mdd, 1),
        "ret": round(total_ret, 1),
        "avg_win": round(np.mean(wins), 2) if wins else 0,
        "avg_loss": round(np.mean(losses), 2) if losses else 0,
        "max_consec_loss": max_consec,
        "calmar": calmar,
    }


def conflicts(a_strategy, a_direction, b_strategy, b_direction) -> bool:
    """Check if two strategy+direction pairs conflict (redundant or cancel out)."""
    base_a = a_strategy.replace("-short", "").replace("-long", "")
    base_b = b_strategy.replace("-short", "").replace("-long", "")

    # Same base strategy, opposite direction = cancel
    if base_a == base_b and a_direction != b_direction:
        return True

    # Same group, same direction = redundant
    for group_strats in STRATEGY_GROUPS.values():
        if a_strategy in group_strats and b_strategy in group_strats:
            if a_direction == b_direction:
                return True

    return False


# ============================================================
# Indicators (standalone, reusable)
# ============================================================
def hurst_exponent(series: np.ndarray, lags=None) -> float:
    """Hurst exponent via R/S analysis. H>0.5=trending, H<0.5=mean-reverting."""
    n = len(series)
    if n < 100:
        return 0.5

    if lags is None:
        lags = list(range(10, min(n // 4, 200), 5))

    rs_log = []
    for lag in lags:
        rs_list = []
        for start in range(0, n - lag, lag):
            seg = series[start:start + lag]
            m = np.mean(seg)
            deviate = np.cumsum(seg - m)
            r = np.ptp(deviate)  # max - min
            s = np.std(seg, ddof=1)
            if s > 1e-10:
                rs_list.append(r / s)
        if rs_list:
            rs_log.append((np.log(lag), np.log(np.mean(rs_list))))

    if len(rs_log) < 3:
        return 0.5

    x = np.array([v[0] for v in rs_log])
    y = np.array([v[1] for v in rs_log])
    slope, _ = np.polyfit(x, y, 1)
    return float(np.clip(slope, 0.01, 0.99))


def volume_profile(close: np.ndarray, volume: np.ndarray, n_bins=20):
    """Calculate Volume Profile. Returns POC price and value area bounds."""
    if len(close) < 10 or np.sum(volume) == 0:
        return None

    price_min, price_max = np.min(close), np.max(close)
    if price_max <= price_min:
        return None

    bins = np.linspace(price_min, price_max, n_bins + 1)
    bin_volumes = np.zeros(n_bins)

    for j in range(len(close)):
        idx = int((close[j] - price_min) / (price_max - price_min) * (n_bins - 1))
        idx = min(idx, n_bins - 1)
        bin_volumes[idx] += volume[j]

    poc_idx = np.argmax(bin_volumes)
    poc_price = (bins[poc_idx] + bins[poc_idx + 1]) / 2

    # Value Area (70% of volume)
    total_vol = np.sum(bin_volumes)
    sorted_indices = np.argsort(bin_volumes)[::-1]
    cumulative = 0
    va_indices = []
    for idx in sorted_indices:
        cumulative += bin_volumes[idx]
        va_indices.append(idx)
        if cumulative >= total_vol * 0.7:
            break

    va_low = bins[min(va_indices)]
    va_high = bins[max(va_indices) + 1]

    return {
        "poc": poc_price,
        "va_low": va_low,
        "va_high": va_high,
        "poc_idx": poc_idx,
    }


# ============================================================
# Research Engine
# ============================================================
class ResearchEngine:
    """Standardized research environment."""

    def __init__(self, top_n=30, verbose=True):
        self.verbose = verbose
        self.data_dir = self._find_data_dir()
        self.coins = self._load_coins(top_n)
        self.indicator_cache = {}
        self._run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._results_dir = _BACKEND / "research" / datetime.now().strftime("%Y%m%d")
        self._results_dir.mkdir(parents=True, exist_ok=True)

        if verbose:
            print(f"ResearchEngine initialized")
            print(f"  Data: {self.data_dir} ({len(self.coins)} coins)")
            print(f"  Output: {self._results_dir}")

    def _find_data_dir(self):
        for d in DATA_DIRS:
            if d.exists() and any(d.glob("*_1h.csv")):
                return d
        raise FileNotFoundError("No OHLCV data found")

    def _load_coins(self, top_n):
        files = sorted(self.data_dir.glob("*_1h.csv"),
                       key=lambda f: f.stat().st_size, reverse=True)
        coins = []
        for f in files[:top_n]:
            sym = f.stem.replace("_1h", "").upper()
            try:
                df = pd.read_csv(f)
                if "timestamp" in df.columns:
                    df["timestamp"] = pd.to_datetime(df["timestamp"])
                if len(df) > 500:
                    coins.append((sym, df))
            except Exception:
                continue
        return coins

    def get_btc(self) -> Optional[pd.DataFrame]:
        """Get BTC dataframe."""
        for sym, df in self.coins:
            if sym == "BTCUSDT":
                return df.copy()
        return None

    def precompute(self, strategy_ids=None):
        """Pre-compute indicators for strategies. Caches for reuse."""
        if strategy_ids is None:
            strategy_ids = list(STRATEGY_REGISTRY.keys())

        for sid in strategy_ids:
            if sid in self.indicator_cache:
                continue
            strategy, _, _ = get_strategy(sid)
            coin_list = []
            for sym, df in self.coins:
                coin_list.append((sym, strategy.calculate_indicators(df.copy())))
            self.indicator_cache[sid] = coin_list

        if self.verbose:
            print(f"  Indicators cached: {len(self.indicator_cache)} strategies × {len(self.coins)} coins")

    def simulate(self, strategy_id, direction, sl=7, tp=7, max_bars=48,
                 symbols=None, start_date=None, end_date=None,
                 coins_override=None) -> list:
        """Run simulation. Returns list of trade PnL%."""
        strategy, default_dir, _ = get_strategy(strategy_id)
        actual_dir = direction or default_dir

        # Use cached or compute fresh
        if strategy_id in self.indicator_cache:
            coin_source = self.indicator_cache[strategy_id]
        else:
            coin_source = []
            source = coins_override or self.coins
            for sym, df in source:
                coin_source.append((sym, strategy.calculate_indicators(df.copy())))

        pnls = []
        for sym, df_ind in coin_source:
            if symbols and sym not in symbols:
                continue

            df = df_ind
            if start_date and "timestamp" in df.columns:
                df = df[df["timestamp"] >= pd.Timestamp(start_date)]
            if end_date and "timestamp" in df.columns:
                df = df[df["timestamp"] <= pd.Timestamp(end_date)]

            if len(df) < 50:
                continue

            result = run_fast(
                df, strategy, sym,
                sl_pct=sl / 100, tp_pct=tp / 100, max_bars=max_bars,
                fee_pct=COST_MODEL["fee_pct"],
                slippage_pct=COST_MODEL["slippage_pct"],
                direction=actual_dir,
                market_type="futures",
                strategy_id=strategy_id,
                funding_rate_8h=COST_MODEL["funding_rate_8h"],
            )
            for t in result.trades:
                pnls.append(t.pnl_pct)

        return pnls

    def simulate_metrics(self, strategy_id, direction, **kwargs) -> dict:
        """Simulate and return metrics dict."""
        pnls = self.simulate(strategy_id, direction, **kwargs)
        m = calc_metrics(pnls)
        m["strategy"] = strategy_id
        m["direction"] = direction
        return m

    def save(self, name, results, metadata=None):
        """Save results as CSV + JSON with checksum."""
        if not results:
            return

        # CSV
        csv_path = self._results_dir / f"{name}.csv"
        with open(csv_path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=results[0].keys())
            w.writeheader()
            w.writerows(results)

        # JSON with metadata
        json_path = self._results_dir / f"{name}.json"
        output = {
            "run_id": self._run_id,
            "timestamp": datetime.now().isoformat(),
            "name": name,
            "rows": len(results),
            "coins": len(self.coins),
            "cost_model": COST_MODEL,
            "metadata": metadata or {},
            "data": results,
        }
        with open(json_path, "w") as f:
            json.dump(output, f, indent=2, default=str)

        # Checksum
        with open(csv_path, "rb") as f:
            md5 = hashlib.md5(f.read()).hexdigest()

        if self.verbose:
            print(f"  ✓ {csv_path.name}: {len(results)} rows (md5: {md5[:8]})")

        return csv_path

    def log(self, msg):
        if self.verbose:
            print(f"  {msg}")
