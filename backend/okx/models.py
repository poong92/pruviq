"""
OKX Broker Pydantic models — request/response schemas.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# ── Orders ─────────────────────────────────────────────────

class PlaceOrderResponse(BaseModel):
    ord_id: str
    cl_ord_id: str = ""
    tag: str = "c12571e26a02OCDE"
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


# ── Simulation → Execution bridge ──────────────────────────

class SimToExecRequest(BaseModel):
    """PRUVIQ simulation result → OKX live trade."""
    strategy: str = Field(..., description="Strategy ID (e.g. bb-squeeze-short)")
    direction: str = Field(..., description="long or short")
    symbol: str = Field(..., description="PRUVIQ symbol (e.g. BTCUSDT)")
    sl_pct: float = Field(..., description="Stop-loss %")
    tp_pct: float = Field(..., description="Take-profit %")
    position_size_usdt: float = Field(..., ge=1, description="Position size in USDT")
    leverage: int = Field(1, ge=1, le=125)
