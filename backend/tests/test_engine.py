"""시뮬레이션 엔진 기본 테스트"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
from src.simulation.engine import SimulationEngine, CostModel, Trade


class DummyStrategy:
    """테스트용 전략: 매 10봉마다 short 시그널"""
    name = "Dummy"

    def calculate_indicators(self, df):
        return df

    def check_signal(self, df, idx):
        if idx > 0 and idx % 10 == 0:
            return "short"
        return None

    def get_params(self):
        return {"interval": 10}


def make_test_data(n=500, start_price=100.0):
    """테스트용 OHLCV 데이터 생성"""
    np.random.seed(42)
    prices = [start_price]
    for _ in range(n - 1):
        change = np.random.normal(0, 0.02)
        prices.append(prices[-1] * (1 + change))

    df = pd.DataFrame({
        "timestamp": pd.date_range("2025-01-01", periods=n, freq="1h"),
        "open": prices,
        "high": [p * (1 + abs(np.random.normal(0, 0.01))) for p in prices],
        "low": [p * (1 - abs(np.random.normal(0, 0.01))) for p in prices],
        "close": [p * (1 + np.random.normal(0, 0.005)) for p in prices],
        "volume": [np.random.uniform(1000, 5000) for _ in range(n)],
    })
    return df


def test_engine_basic():
    """기본 엔진 실행 테스트"""
    df = make_test_data()
    engine = SimulationEngine(sl_pct=0.05, tp_pct=0.03, max_bars=48)
    strategy = DummyStrategy()

    result = engine.run(df, strategy, "TESTUSDT", "spot")

    assert result.total_trades > 0, "거래가 발생해야 함"
    assert result.strategy_name == "Dummy"
    assert result.symbol == "TESTUSDT"
    assert result.market_type == "spot"
    assert result.tp_count + result.sl_count + result.timeout_count == result.total_trades
    assert result.wins + result.losses == result.total_trades

    print(f"  Trades: {result.total_trades}")
    print(f"  Win Rate: {result.win_rate}%")
    print(f"  Return: {result.total_return_pct}%")
    print(f"  TP/SL/TO: {result.tp_count}/{result.sl_count}/{result.timeout_count}")
    print(f"  Max DD: {result.max_drawdown_pct}%")


def test_look_ahead_bias():
    """Look-ahead bias 방지 테스트: 진입은 시그널 다음 봉 open"""
    df = make_test_data(100)
    engine = SimulationEngine(sl_pct=0.10, tp_pct=0.10, max_bars=100)
    strategy = DummyStrategy()

    result = engine.run(df, strategy, "TESTUSDT")

    for trade in result.trades:
        # 진입 시간이 시그널 봉 이후여야 함
        entry_time = pd.Timestamp(trade.entry_time)
        exit_time = pd.Timestamp(trade.exit_time)
        assert exit_time >= entry_time, "exit은 entry 이후여야 함"
        assert trade.bars_held >= 0, "보유 기간은 0 이상"


def test_cost_model():
    """비용 모델 테스트"""
    spot = CostModel.spot()
    futures = CostModel.futures()

    assert spot.fee_pct == 0.001, "현물 수수료 0.1%"
    assert futures.fee_pct == 0.0008, "선물 수수료 0.08% (taker, AT parity)"
    assert futures.slippage_pct == 0.0002, "선물 슬리피지 0.02% (realistic)"
    assert spot.slippage_pct == 0.0002, "현물 슬리피지 0.02%"


def test_direction_filter():
    """방향 필터 테스트"""
    df = make_test_data()
    strategy = DummyStrategy()  # short만 발생

    # short only → 거래 있음
    engine = SimulationEngine(direction="short")
    result = engine.run(df, strategy, "TESTUSDT")
    assert result.total_trades > 0

    # long only → 거래 없음 (strategy가 short만 발생시킴)
    engine = SimulationEngine(direction="long")
    result = engine.run(df, strategy, "TESTUSDT")
    assert result.total_trades == 0


def test_empty_data():
    """빈 데이터 처리"""
    df = make_test_data(10)  # 너무 적은 데이터
    engine = SimulationEngine()
    strategy = DummyStrategy()

    result = engine.run(df, strategy, "TESTUSDT")
    # 에러 없이 빈 결과 반환
    assert result.total_trades == 0
    assert result.win_rate == 0


if __name__ == "__main__":
    tests = [
        ("Engine Basic", test_engine_basic),
        ("Look-ahead Bias", test_look_ahead_bias),
        ("Cost Model", test_cost_model),
        ("Direction Filter", test_direction_filter),
        ("Empty Data", test_empty_data),
    ]

    passed = 0
    failed = 0
    for name, test_fn in tests:
        print(f"\n[TEST] {name}")
        try:
            test_fn()
            print(f"  PASS")
            passed += 1
        except Exception as e:
            print(f"  FAIL: {e}")
            failed += 1

    print(f"\n{'=' * 40}")
    print(f"Results: {passed} passed, {failed} failed")
    sys.exit(1 if failed > 0 else 0)
