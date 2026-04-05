"""
OKX Broker Pydantic models — request/response schemas.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────

class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    POST_ONLY = "post_only"


class TdMode(str, Enum):
    CASH = "cash"
    ISOLATED = "isolated"
    CROSS = "cross"


class PosSide(str, Enum):
    LONG = "long"
    SHORT = "short"
    NET = "net"


# ── OAuth ──────────────────────────────────────────────

class OAuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int = 3600  # 1 hour
    scope: str = ""


class OAuthState(BaseModel):
    """유저별 OAuth 상태"""
    user_id: str
    access_token: str
    refresh_token: str
    expires_at: float  # unix timestamp
    scope: str = "trade"


# ── Orders ─────────────────────────────────────────────

class PlaceOrderRequest(BaseModel):
    """시뮬 결과 → OKX 주문 변환"""
    symbol: str = Field(..., description="PRUVIQ 심볼 (e.g. BTCUSDT)")
    side: Side
    size: str = Field(..., description="주문 수량")
    order_type: OrderType = OrderType.MARKET
    price: Optional[str] = None
    sl_pct: Optional[float] = Field(None, description="SL % (시뮬 결과)")
    tp_pct: Optional[float] = Field(None, description="TP % (시뮬 결과)")
    td_mode: TdMode = TdMode.ISOLATED
    leverage: int = 1


class PlaceOrderResponse(BaseModel):
    ord_id: str
    cl_ord_id: str = ""
    tag: str = "PRUVIQ"
    s_code: str = "0"
    s_msg: str = ""


class PositionInfo(BaseModel):
    inst_id: str
    pos: str
    avg_px: str
    liq_px: str = ""
    pnl: str = ""
    lever: str = ""
    mgn_mode: str = ""
    pos_side: str = ""


class BalanceInfo(BaseModel):
    ccy: str
    bal: str
    avail_bal: str
    frozen_bal: str = "0"


# ── Simulation → Execution bridge ──────────────────────

class SimToExecRequest(BaseModel):
    """PRUVIQ 시뮬 결과를 실거래로 변환하는 요청"""
    strategy: str = Field(..., description="전략 ID (e.g. bb-squeeze-short)")
    direction: str = Field(..., description="long or short")
    symbol: str = Field(..., description="PRUVIQ 심볼")
    sl_pct: float = Field(..., description="시뮬 SL %")
    tp_pct: float = Field(..., description="시뮬 TP %")
    position_size_usdt: float = Field(..., description="투입 금액 USDT")
    leverage: int = Field(1, ge=1, le=125)
