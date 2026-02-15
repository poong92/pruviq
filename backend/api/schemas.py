"""
PRUVIQ API — Pydantic Models
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class SimulationRequest(BaseModel):
    """시뮬레이션 요청"""
    strategy: str = Field(default="bb-squeeze", description="Strategy ID")
    direction: str = Field(default="short", description="long | short | both")
    sl_pct: float = Field(default=10.0, ge=1.0, le=30.0, description="Stop Loss %")
    tp_pct: float = Field(default=8.0, ge=1.0, le=30.0, description="Take Profit %")
    max_bars: int = Field(default=48, ge=6, le=168, description="Max holding period (bars)")
    market_type: str = Field(default="futures", description="spot | futures")
    symbols: Optional[List[str]] = Field(default=None, description="Specific symbols (null = top 50)")
    top_n: int = Field(default=50, ge=1, le=535, description="Number of coins if symbols is null")


class TradeItem(BaseModel):
    symbol: str
    direction: str
    entry_time: str
    exit_time: str
    pnl_pct: float
    exit_reason: str
    bars_held: int


class EquityPoint(BaseModel):
    time: str
    value: float


class SimulationResponse(BaseModel):
    """시뮬레이션 결과"""
    strategy: str
    direction: str
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

    coins_used: int
    data_range: str
    equity_curve: List[EquityPoint]


class CoinInfo(BaseModel):
    symbol: str
    rows: int
    date_from: str
    date_to: str


class StrategyInfo(BaseModel):
    id: str
    name: str
    description: str
    default_params: dict


class HealthResponse(BaseModel):
    status: str
    version: str
    coins_loaded: int
    uptime_seconds: float


# --- Coin Explorer Schemas ---

class OhlcvBar(BaseModel):
    t: int  # Unix timestamp (seconds)
    o: float
    h: float
    l: float
    c: float
    v: float
    bb_upper: Optional[float] = None
    bb_lower: Optional[float] = None
    bb_mid: Optional[float] = None
    ema20: Optional[float] = None
    ema50: Optional[float] = None
    vol_ratio: Optional[float] = None


class OhlcvResponse(BaseModel):
    symbol: str
    timeframe: str = "1H"
    total_bars: int
    data: List[OhlcvBar]


class CoinSimRequest(BaseModel):
    symbol: str
    sl_pct: float = Field(default=10.0, ge=1.0, le=30.0)
    tp_pct: float = Field(default=8.0, ge=1.0, le=30.0)
    max_bars: int = Field(default=48, ge=6, le=168)
    direction: str = Field(default="short")
    market_type: str = Field(default="futures")


class TradeDetail(BaseModel):
    entry_time: int  # Unix timestamp (seconds)
    entry_price: float
    exit_time: int  # Unix timestamp (seconds)
    exit_price: float
    pnl_pct: float
    exit_reason: str
    bars_held: int


class CoinSimResponse(BaseModel):
    symbol: str
    total_trades: int
    win_rate: float
    profit_factor: float
    total_return_pct: float
    max_drawdown_pct: float
    tp_count: int
    sl_count: int
    timeout_count: int
    trades: List[TradeDetail]


class CoinStats(BaseModel):
    symbol: str
    price: float
    change_24h: float
    volume_24h: float
    trades: int
    win_rate: float
    profit_factor: float
    total_return_pct: float


class CoinStatsResponse(BaseModel):
    generated: str
    strategy: str
    params: dict
    coins: List[CoinStats]
