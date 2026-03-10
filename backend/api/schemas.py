"""
PRUVIQ API — Pydantic Models
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal

# Valid candle timeframes (1H is the base; others are resampled on-demand)
VALID_TIMEFRAMES = ("1H", "2H", "4H", "6H", "12H", "1D", "1W")


class SimulationRequest(BaseModel):
    """시뮬레이션 요청"""
    strategy: str = Field(default="bb-squeeze", description="Strategy ID")
    direction: Optional[str] = Field(default=None, description="long | short | both (null = use strategy default)")
    sl_pct: float = Field(default=10.0, ge=1.0, le=30.0, description="Stop Loss %")
    tp_pct: float = Field(default=8.0, ge=1.0, le=30.0, description="Take Profit %")
    max_bars: int = Field(default=48, ge=6, le=168, description="Max holding period (bars)")
    market_type: str = Field(default="futures", description="spot | futures")
    symbols: Optional[List[str]] = Field(default=None, description="Specific symbols (null = use top_n)")
    top_n: Optional[int] = Field(default=None, ge=1, description="Number of coins (null = all coins)")
    start_date: Optional[str] = Field(default=None, description="Backtest start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="Backtest end date (YYYY-MM-DD)")
    timeframe: str = Field(default="1H", description="Candle timeframe: 1H, 2H, 4H, 6H, 12H, 1D, 1W")
    compounding: bool = Field(default=False, description="True = reinvest profits (compound), False = fixed position size (simple)")


class TradeItem(BaseModel):
    symbol: str
    direction: str
    entry_time: str
    exit_time: str
    entry_price: float = 0.0
    exit_price: float = 0.0
    pnl_pct: float
    pnl_usd: float = 0.0
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
    total_funding_pct: float = 0.0

    tp_count: int
    sl_count: int
    timeout_count: int

    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0

    coins_used: int
    data_range: str
    equity_curve: List[EquityPoint]
    coin_results: List["CoinResult"] = []


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
    start_date: Optional[str] = Field(default=None, description="Backtest start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="Backtest end date (YYYY-MM-DD)")
    timeframe: str = Field(default="1H", description="Candle timeframe: 1H, 2H, 4H, 6H, 12H, 1D, 1W")


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
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    trades: List[TradeDetail]


class CoinStats(BaseModel):
    symbol: str
    price: float
    change_24h: float
    volume_24h: float
    trades: int = 0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    total_return_pct: float = 0.0
    # CoinGecko metadata (enriched from coins-stats.json)
    name: Optional[str] = None
    image: Optional[str] = None
    change_1h: Optional[float] = None
    change_7d: Optional[float] = None
    market_cap: Optional[float] = None
    market_cap_rank: Optional[int] = None
    sparkline_7d: Optional[list] = None


class CoinResult(BaseModel):
    """Per-coin simulation result in portfolio backtest."""
    symbol: str
    trades: int
    wins: int
    losses: int
    win_rate: float
    profit_factor: float
    total_return_pct: float
    avg_pnl_pct: float
    tp_count: int
    sl_count: int
    timeout_count: int


class CoinStatsResponse(BaseModel):
    generated: str
    strategy: str
    params: dict
    coins: List[CoinStats]


# --- Market Dashboard Schemas ---

class MarketMover(BaseModel):
    symbol: str
    price: float
    change_24h: float
    volume_24h: float


class FundingRate(BaseModel):
    symbol: str
    rate: float
    annual_pct: float


class MarketOverview(BaseModel):
    btc_price: float = 0
    btc_change_24h: float = 0
    eth_price: float = 0
    eth_change_24h: float = 0
    fear_greed_index: int = 0
    fear_greed_label: str = "N/A"
    total_market_cap_b: float = 0
    btc_dominance: float = 0
    total_volume_24h_b: float = 0
    top_gainers: List[MarketMover] = []
    top_losers: List[MarketMover] = []
    extreme_funding: List[FundingRate] = []
    generated: str = ""


class NewsItem(BaseModel):
    title: str
    link: str
    source: str
    published: str
    summary: str = ""


class NewsResponse(BaseModel):
    items: List[NewsItem]
    generated: str


# --- Strategy Comparison Schemas ---

class CompareRequest(BaseModel):
    """Compare all strategies under identical conditions."""
    sl_pct: float = Field(default=10.0, ge=1.0, le=30.0, description="Stop Loss %")
    tp_pct: float = Field(default=8.0, ge=1.0, le=30.0, description="Take Profit %")
    max_bars: int = Field(default=48, ge=6, le=168, description="Max holding period (bars)")
    top_n: Optional[int] = Field(default=None, ge=1, description="Number of coins (null = all)")


class StrategyResult(BaseModel):
    """Result for a single strategy in comparison."""
    strategy_id: str
    name: str
    direction: str
    status: str
    total_trades: int
    wins: int
    losses: int
    win_rate: float
    total_return_pct: float
    profit_factor: float
    max_drawdown_pct: float
    tp_count: int
    sl_count: int
    timeout_count: int
    equity_curve: List[EquityPoint]


class CompareResponse(BaseModel):
    """Comparison across all strategies."""
    sl_pct: float
    tp_pct: float
    max_bars: int
    coins_used: int
    data_range: str
    strategies: List[StrategyResult]
# --- Strategy Builder ---

class ConditionItem(BaseModel):
    """A single condition or nested group."""
    field: Optional[str] = None
    op: Optional[str] = None
    value: Optional[float] = None  # For literal comparisons
    value_bool: Optional[bool] = None  # For boolean comparisons
    field2: Optional[str] = None  # For field-to-field comparisons
    shift: int = Field(default=1, ge=0, le=10, description="Candle shift (1=prev candle)")
    # Nested group
    type: Optional[str] = None  # "AND" or "OR"
    conditions: Optional[List["ConditionItem"]] = None


class BacktestRequest(BaseModel):
    """Custom strategy backtest request from Strategy Builder."""
    name: str = Field(default="Custom Strategy", max_length=100)
    direction: str = Field(default="short", description="short | long")
    indicators: dict = Field(
        default={"bb": {}, "ema": {}, "volume": {}, "candle": {}},
        description="Indicator configs: {'bb': {'period': 20}, 'ema': {}, ...}"
    )
    entry: dict = Field(
        description="Entry conditions tree: {'type': 'AND', 'conditions': [...]}"
    )
    avoid_hours: List[int] = Field(default=[], description="UTC hours to avoid (0-23)")
    sl_pct: float = Field(default=10.0, ge=0.5, le=50.0, description="Stop Loss %")
    tp_pct: float = Field(default=8.0, ge=0.5, le=100.0, description="Take Profit %")
    max_bars: int = Field(default=48, ge=1, le=168, description="Max holding period (bars)")
    top_n: Optional[int] = Field(default=None, ge=1, description="Number of coins (null = all)")
    symbols: Optional[List[str]] = Field(default=None, description="Specific symbols")
    start_date: Optional[str] = Field(default=None, description="Backtest start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="Backtest end date (YYYY-MM-DD)")
    timeframe: str = Field(default="1H", description="Candle timeframe: 1H, 2H, 4H, 6H, 12H, 1D, 1W")
    per_coin_usd: float = Field(default=60.0, ge=1.0, le=10000.0, description="USD per coin position")
    leverage: int = Field(default=5, ge=1, le=125, description="Leverage multiplier")
    max_concurrent_positions: int = Field(default=100, ge=1, le=1000, description="Max simultaneous open positions")
    compounding: bool = Field(default=False, description="True = reinvest profits (compound), False = fixed position size (simple)")


class MonthlyStat(BaseModel):
    """Per-month performance breakdown."""
    month: str  # "YYYY-MM"
    trades: int
    wins: int
    win_rate: float
    total_return_pct: float
    profit_factor: float


class YearlyStat(BaseModel):
    """Per-year performance breakdown."""
    year: int
    trades: int
    wins: int
    win_rate: float
    total_return_pct: float
    profit_factor: float


class RegimeMetrics(BaseModel):
    trades: int
    win_rate: float
    total_return: float
    profit_factor: float
    avg_pnl: float


class RegimePerformance(BaseModel):
    bull: RegimeMetrics
    bear: RegimeMetrics
    sideways: RegimeMetrics


class BacktestResponse(BaseModel):
    """Custom strategy backtest result."""
    name: str
    direction: str
    sl_pct: float
    tp_pct: float
    max_bars: int
    indicators_used: List[str]
    conditions_count: int

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

    tp_count: int
    sl_count: int
    timeout_count: int

    total_funding_pct: float = 0.0

    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0

    coins_used: int
    data_range: str
    equity_curve: List[EquityPoint]
    coin_results: List["CoinResult"] = []
    trades: List[TradeItem] = []

    # Portfolio metrics
    compounding: bool = False
    per_coin_usd: float = 60.0
    leverage: int = 5
    initial_capital_usd: float = 0.0
    total_return_usd: float = 0.0
    total_return_pct_portfolio: float = 0.0
    max_drawdown_usd: float = 0.0

    # Additional risk metrics
    expectancy: float = 0.0            # WR * avg_win + (1-WR) * avg_loss
    recovery_factor: float = 0.0       # total_return / max_drawdown
    payoff_ratio: float = 0.0          # avg_win / abs(avg_loss)

    # Benchmark comparison
    btc_hold_return_pct: float = 0.0   # BTC buy-and-hold return over same period
    eth_hold_return_pct: float = 0.0   # ETH buy-and-hold return over same period

    # Risk metrics (daily)
    var_95: float = 0.0     # Value at Risk (95% confidence, daily %)
    cvar_95: float = 0.0    # Conditional VaR / Expected Shortfall (daily %)

    # Strategy grade (A/B/C/D/F)
    strategy_grade: str = ""
    grade_details: str = ""

    # Statistical significance
    edge_p_value: float = 1.0           # Binomial test p-value (WR vs break-even WR)

    # Warnings
    warnings: List[str] = []

    # Walk-forward consistency (rolling 5-window, ideal=1.0)
    walk_forward_consistency: float = 0.0
    walk_forward_details: str = ""

    # Overfitting detection
    deflated_sharpe: float = 0.0       # DSR (Deflated Sharpe Ratio)
    dsr_haircut_pct: float = 0.0       # How much Sharpe is inflated (%)
    mc_p_value: float = 1.0            # Monte Carlo permutation p-value
    mc_percentile: float = 50.0        # Strategy percentile vs random shuffle

    # Risk-adjusted alpha
    jensens_alpha: float = 0.0         # Excess return vs benchmark (risk-adjusted)

    # Trade duration stats
    avg_bars_held: float = 0.0
    median_bars_held: float = 0.0
    positions_skipped: int = 0  # trades skipped due to concurrent position limit
    pnl_distribution: List[int] = []  # histogram: count of trades in each 1% PnL bucket [-10..+10]
    pnl_buckets: List[str] = []       # bucket labels

    # Market regime performance
    regime_performance: Optional["RegimePerformance"] = None

    # Validation info
    is_valid: bool
    validation_errors: List[str] = []
    yearly_stats: List["YearlyStat"] = []
    monthly_stats: List["MonthlyStat"] = []
    compute_time_ms: int = 0


class PresetListItem(BaseModel):
    """Preset strategy summary for listing."""
    id: str
    name: str
    direction: str
    indicators: List[str]
    conditions_count: int
    sl_pct: float
    tp_pct: float


class IndicatorInfo(BaseModel):
    """Available indicator for Strategy Builder."""
    id: str
    name: str
    fields: List[str]
    default_params: dict


# --- Macro Economic Schemas ---

# --- OOS Validation & Monte Carlo Schemas ---

class OOSPeriodMetrics(BaseModel):
    """Metrics for one period (IS or OOS)."""
    trades: int
    win_rate: float
    total_return: float
    profit_factor: float
    max_dd: float
    avg_win: float
    avg_loss: float


class OOSResult(BaseModel):
    """IS vs OOS comparison."""
    is_metrics: OOSPeriodMetrics
    oos_metrics: OOSPeriodMetrics
    degradation_ratio: float
    overfit_risk: str  # LOW, MEDIUM, HIGH


class MCEquityBand(BaseModel):
    """Equity percentile at a trade index."""
    trade_idx: int
    p5: float
    p25: float
    p50: float
    p75: float
    p95: float


class MonteCarloResult(BaseModel):
    """Monte Carlo simulation result."""
    mean_return: float
    median_return: float
    std_return: float
    percentile_5: float
    percentile_25: float
    percentile_75: float
    percentile_95: float
    worst_case_return: float
    best_case_return: float
    worst_case_mdd: float
    positive_pct: float
    n_simulations: int
    n_trades: int
    equity_bands: List[MCEquityBand]


class ValidateRequest(BaseModel):
    """OOS validation + Monte Carlo request."""
    strategy: str = Field(default="bb-squeeze", description="Strategy ID")
    direction: Optional[str] = Field(default=None)
    sl_pct: float = Field(default=10.0, ge=1.0, le=30.0)
    tp_pct: float = Field(default=8.0, ge=1.0, le=30.0)
    max_bars: int = Field(default=48, ge=6, le=168)
    market_type: str = Field(default="futures")
    top_n: Optional[int] = Field(default=None, ge=1, description="Number of coins (null = all)")
    symbols: Optional[List[str]] = Field(default=None)
    oos_pct: float = Field(default=30.0, ge=10.0, le=50.0, description="OOS split %")
    mc_runs: int = Field(default=1000, ge=100, le=5000, description="Monte Carlo runs")
    start_date: Optional[str] = Field(default=None, description="Backtest start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(default=None, description="Backtest end date (YYYY-MM-DD)")
    timeframe: str = Field(default="1H", description="Candle timeframe: 1H, 2H, 4H, 6H, 12H, 1D, 1W")


class ValidateResponse(BaseModel):
    """OOS validation + Monte Carlo response."""
    strategy: str
    direction: str
    coins_used: int
    data_range: str
    oos_pct: float
    oos: OOSResult
    monte_carlo: MonteCarloResult


class MacroIndicator(BaseModel):
    """A single macro economic indicator."""
    id: str
    name: str
    value: float
    change: Optional[float] = None
    previous: Optional[float] = None
    unit: str = ""
    updated: str = ""
    source: str = ""

class DerivativesData(BaseModel):
    """Crypto derivatives market data."""
    btc_open_interest_b: Optional[float] = 0
    eth_open_interest_b: Optional[float] = 0
    btc_ls_ratio: Optional[float] = 0  # long/short ratio
    eth_ls_ratio: Optional[float] = 0
    btc_oi_change_24h: Optional[float] = 0
    eth_oi_change_24h: Optional[float] = 0
    note: Optional[str] = None

class EconomicEvent(BaseModel):
    """Upcoming economic calendar event."""
    date: str
    time_utc: str = ""
    country: str = ""
    event: str
    impact: str = ""  # high, medium, low
    forecast: Optional[str] = None
    previous: Optional[str] = None

class MacroResponse(BaseModel):
    """Macro economic dashboard response."""
    indicators: List[MacroIndicator] = []
    derivatives: Optional[DerivativesData] = None
    events: List[EconomicEvent] = []
    generated: str = ""
