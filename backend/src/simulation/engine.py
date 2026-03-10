"""
PRUVIQ Simulation Engine v0.1

깨끗한 시뮬레이션 엔진 — 처음부터 검증된 로직으로.

핵심 원칙:
1. Look-ahead bias 제거
   - 시그널: 완성된 캔들(prev)로만 판단
   - 진입: 다음 캔들 시가(open)
   - 청산: SL/TP 도달 시 해당 가격, TIMEOUT 시 close

2. 비용 모델링
   - 수수료: 현물 0.1%, 선물 0.04% (maker/taker 평균)
   - 슬리피지: 0.02% (기본)

3. 투명성
   - 모든 파라미터 기록
   - 거래별 상세 로그
"""

from dataclasses import dataclass, field
from typing import Protocol, Optional
import pandas as pd
import numpy as np


@dataclass
class Trade:
    """단일 거래"""
    symbol: str
    direction: str              # "long" | "short"
    entry_time: str
    exit_time: str
    entry_price: float
    exit_price: float
    pnl_pct: float              # 비용 차감 후 순수익률
    pnl_gross_pct: float        # 비용 전 수익률
    fee_pct: float              # 수수료
    exit_reason: str            # "tp" | "sl" | "timeout"
    bars_held: int


@dataclass
class SimulationResult:
    """시뮬레이션 결과"""
    strategy_name: str
    symbol: str
    params: dict
    market_type: str            # "spot" | "futures"

    # 성과
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    total_return_pct: float
    profit_factor: float
    avg_win_pct: float
    avg_loss_pct: float

    # 리스크
    max_drawdown_pct: float
    max_consecutive_losses: int

    # 비용
    total_fees_pct: float

    # 청산별
    tp_count: int
    sl_count: int
    timeout_count: int

    # Risk-adjusted
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0

    # 상세
    trades: list = field(default_factory=list)
    equity_curve: list = field(default_factory=list)


@dataclass
class CostModel:
    """거래 비용 모델"""
    fee_pct: float = 0.001      # 0.1% (현물 기본)
    slippage_pct: float = 0.0002  # 0.02%
    funding_rate_8h: float = 0.0001  # 0.01% per 8h funding period

    @staticmethod
    def spot():
        return CostModel(fee_pct=0.001, slippage_pct=0.0002, funding_rate_8h=0.0)

    @staticmethod
    def futures():
        """Futures taker fee (0.08%/side) — AutoTrader parity."""
        return CostModel(fee_pct=0.0008, slippage_pct=0.0002, funding_rate_8h=0.0001)


class Strategy(Protocol):
    """전략 인터페이스"""
    name: str

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """지표 계산 (df에 컬럼 추가)"""
        ...

    def check_signal(self, df: pd.DataFrame, idx: int) -> Optional[str]:
        """
        시그널 확인 — idx는 '완성된' 캔들의 인덱스.
        진입은 idx+1의 open에서 발생.
        return: "long", "short", or None
        """
        ...

    def get_params(self) -> dict:
        ...


class SimulationEngine:
    """
    전략 시뮬레이션 엔진

    사용법:
        engine = SimulationEngine(sl_pct=0.10, tp_pct=0.08, max_bars=48)
        result = engine.run(df, strategy, "BTCUSDT")
    """

    def __init__(
        self,
        sl_pct: float = 0.10,
        tp_pct: float = 0.08,
        max_bars: int = 48,
        cost_model: CostModel = None,
        direction: str = "both",     # "long" | "short" | "both"
    ):
        self.sl_pct = sl_pct
        self.tp_pct = tp_pct
        self.max_bars = max_bars
        self.cost_model = cost_model or CostModel.spot()
        self.direction = direction

    def run(
        self,
        df: pd.DataFrame,
        strategy: Strategy,
        symbol: str,
        market_type: str = "spot",
    ) -> SimulationResult:
        """시뮬레이션 실행"""

        # 1. 지표 계산
        df = strategy.calculate_indicators(df.copy())

        # 2. 거래 시뮬레이션
        trades = self._simulate(df, strategy, symbol)

        # 3. 결과 집계
        return self._build_result(trades, strategy, symbol, market_type)

    def _simulate(self, df: pd.DataFrame, strategy: Strategy, symbol: str) -> list:
        """바 단위 시뮬레이션"""
        trades = []
        in_position = False
        entry_idx = 0
        entry_price = 0.0
        position_dir = ""

        # idx: 완성된 캔들 → 시그널 확인
        # idx+1: 다음 캔들 open에서 진입
        for idx in range(len(df) - 1):

            if in_position:
                # 청산 체크
                bars_held = idx - entry_idx
                current = df.iloc[idx]

                sl_hit, tp_hit = self._check_exit(
                    position_dir, entry_price, current
                )

                exit_price = None
                exit_reason = None

                if sl_hit:
                    exit_price = self._get_sl_price(position_dir, entry_price)
                    exit_reason = "sl"
                elif tp_hit:
                    exit_price = self._get_tp_price(position_dir, entry_price)
                    exit_reason = "tp"
                elif bars_held >= self.max_bars:
                    exit_price = float(current["close"])
                    exit_reason = "timeout"

                if exit_price is not None:
                    trade = self._record_trade(
                        symbol, position_dir, entry_idx, idx,
                        entry_price, exit_price, exit_reason,
                        bars_held, df,
                    )
                    trades.append(trade)
                    in_position = False

            else:
                # 시그널 체크 (완성된 캔들 기준)
                signal = strategy.check_signal(df, idx)

                if signal is None:
                    continue
                if self.direction != "both" and signal != self.direction:
                    continue

                # 진입: 다음 캔들 시가
                next_bar = df.iloc[idx + 1]
                entry_price = float(next_bar["open"])

                # 슬리피지 적용
                if signal == "long":
                    entry_price *= (1 + self.cost_model.slippage_pct)
                else:
                    entry_price *= (1 - self.cost_model.slippage_pct)

                entry_idx = idx + 1
                position_dir = signal
                in_position = True

        return trades

    def _check_exit(self, direction: str, entry_price: float, bar) -> tuple:
        """SL/TP 도달 체크 (high/low 사용)"""
        high = float(bar["high"])
        low = float(bar["low"])

        if direction == "short":
            sl_price = entry_price * (1 + self.sl_pct)
            tp_price = entry_price * (1 - self.tp_pct)
            sl_hit = high >= sl_price
            tp_hit = low <= tp_price
        else:  # long
            sl_price = entry_price * (1 - self.sl_pct)
            tp_price = entry_price * (1 + self.tp_pct)
            sl_hit = low <= sl_price
            tp_hit = high >= tp_price

        # 둘 다 같은 봉에서 hit → 보수적으로 SL
        if sl_hit and tp_hit:
            return True, False

        return sl_hit, tp_hit

    def _get_sl_price(self, direction: str, entry_price: float) -> float:
        if direction == "short":
            return entry_price * (1 + self.sl_pct)
        return entry_price * (1 - self.sl_pct)

    def _get_tp_price(self, direction: str, entry_price: float) -> float:
        if direction == "short":
            return entry_price * (1 - self.tp_pct)
        return entry_price * (1 + self.tp_pct)

    def _record_trade(
        self, symbol, direction, entry_idx, exit_idx,
        entry_price, exit_price, exit_reason, bars_held, df,
    ) -> Trade:
        """거래 기록"""
        # 슬리피지 (청산)
        if direction == "long":
            exit_price_adj = exit_price * (1 - self.cost_model.slippage_pct)
        else:
            exit_price_adj = exit_price * (1 + self.cost_model.slippage_pct)

        # 손익 계산
        if direction == "long":
            pnl_gross = (exit_price_adj - entry_price) / entry_price
        else:
            pnl_gross = (entry_price - exit_price_adj) / entry_price

        # 수수료 (진입 + 청산)
        fee = self.cost_model.fee_pct * 2
        pnl_net = pnl_gross - fee

        return Trade(
            symbol=symbol,
            direction=direction,
            entry_time=str(df.iloc[entry_idx]["timestamp"]),
            exit_time=str(df.iloc[exit_idx]["timestamp"]),
            entry_price=entry_price,
            exit_price=exit_price,
            pnl_pct=round(pnl_net * 100, 4),
            pnl_gross_pct=round(pnl_gross * 100, 4),
            fee_pct=round(fee * 100, 4),
            exit_reason=exit_reason,
            bars_held=bars_held,
        )

    def _build_result(
        self, trades: list, strategy: Strategy, symbol: str, market_type: str
    ) -> SimulationResult:
        """결과 집계"""
        if not trades:
            return SimulationResult(
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

        total_return = sum(t.pnl_pct for t in trades)
        gross_profit = sum(t.pnl_pct for t in wins) if wins else 0
        gross_loss = abs(sum(t.pnl_pct for t in losses)) if losses else 0.0
        total_fees = sum(t.fee_pct for t in trades)

        # Max drawdown (equity curve)
        equity = 0
        peak = 0
        max_dd = 0
        equity_curve = []
        for t in trades:
            equity += t.pnl_pct
            peak = max(peak, equity)
            dd_pct = (peak - equity) / peak * 100 if peak > 0 else 0.0  # % of peak
            dd_pct = min(dd_pct, 100.0)  # Cap at 100%
            max_dd = max(max_dd, dd_pct)
            equity_curve.append(round(equity, 2))

        # Max consecutive losses
        max_consec = 0
        current_consec = 0
        for t in trades:
            if t.pnl_pct <= 0:
                current_consec += 1
                max_consec = max(max_consec, current_consec)
            else:
                current_consec = 0

        # Risk-adjusted metrics — daily-return based (annualized sqrt(365))
        from collections import defaultdict as _dd_eng
        daily_pnl_eng = _dd_eng(float)
        for t in trades:
            day_key = t.exit_time[:10]  # YYYY-MM-DD
            daily_pnl_eng[day_key] += t.pnl_pct
        daily_returns_eng = np.array(list(daily_pnl_eng.values())) if daily_pnl_eng else np.array([])

        if len(daily_returns_eng) >= 5:
            dr_avg = float(np.mean(daily_returns_eng))
            dr_std = float(np.std(daily_returns_eng, ddof=1))
            sharpe = round(dr_avg / dr_std * np.sqrt(365), 2) if dr_std > 0 else 0.0
            # TDD Sortino (Sortino & van der Meer 1991): sqrt(mean(min(r,0)^2)) over ALL observations
            downside = np.minimum(daily_returns_eng, 0)
            tdd = float(np.sqrt(np.mean(downside ** 2)))
            sortino = round(dr_avg / tdd * np.sqrt(365), 2) if tdd > 0 else 0.0
            # Calmar: CAGR / MDD (compound annualized growth rate)
            n_days_eng = len(daily_pnl_eng)
            growth_ratio_eng = (equity + 100) / 100 if equity > -100 else 0.001
            years_eng = max(n_days_eng, 1) / 365
            cagr_pct_eng = (growth_ratio_eng ** (1 / years_eng) - 1) * 100 if years_eng > 0 else 0.0
            calmar = round(cagr_pct_eng / max_dd, 2) if max_dd > 0 else 0.0
        else:
            sharpe, sortino, calmar = 0.0, 0.0, 0.0

        return SimulationResult(
            strategy_name=strategy.name,
            symbol=symbol,
            params=strategy.get_params(),
            market_type=market_type,
            total_trades=len(trades),
            wins=len(wins),
            losses=len(losses),
            win_rate=round(len(wins) / len(trades) * 100, 2),
            total_return_pct=round(total_return, 2),
            profit_factor=round(gross_profit / gross_loss, 2) if gross_loss > 0 else (999.99 if gross_profit > 0 else 0.0),
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
            equity_curve=equity_curve,
        )
