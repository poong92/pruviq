"""
Parameter Constraint Engine — pure math, no DB, no side effects.

Every field relationship is explicitly defined here.
All UI disable/enable logic derives from these rules.

Dependency graph:
  position_sizing_method → {position_size_usdt | multiplier}
  leverage_source        → {leverage | FOLLOW_SIGNAL}
  sl_source              → {sl_pct | FOLLOW_SIGNAL}
  tp_source              → {tp_pct | trail_pct | FOLLOW_SIGNAL}
  tp_source=TRAILING     → tp_pct disabled (mutual exclusion)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# ── OKX fee rate (taker, futures) ──────────────────────────────────────
OKX_TAKER_FEE = 0.0005  # 0.05% per side


# ── Validation result ──────────────────────────────────────────────────

@dataclass
class ConstraintResult:
    valid: bool                        # False = hard block (cannot execute)
    hard_errors: list[str] = field(default_factory=list)   # execution impossible
    warnings: list[str] = field(default_factory=list)      # suboptimal but allowed
    disabled_fields: list[str] = field(default_factory=list)  # UI must grey out
    calculator: dict[str, Any] = field(default_factory=dict)  # real-time numbers


# ── Field dependency rules ─────────────────────────────────────────────

def get_disabled_fields(params: dict) -> list[str]:
    """
    Given current params, return list of fields that must be disabled in UI.
    This is the single source of truth for frontend disable logic.
    """
    disabled = []

    sizing = params.get("position_sizing_method", "fixed")
    if sizing == "fixed":
        disabled.append("multiplier")
    elif sizing == "multiplier":
        disabled.append("position_size_usdt")

    lev_src = params.get("leverage_source", "custom")
    if lev_src == "follow_signal":
        disabled.append("leverage")

    sl_src = params.get("sl_source", "follow_signal")
    if sl_src == "follow_signal":
        disabled.extend(["sl_pct", "sl_price"])
    elif sl_src == "custom_pct":
        disabled.append("sl_price")
    elif sl_src == "custom_price":
        disabled.append("sl_pct")

    tp_src = params.get("tp_source", "follow_signal")
    if tp_src == "follow_signal":
        disabled.extend(["tp_pct", "trail_pct"])
    elif tp_src == "custom_pct":
        disabled.append("trail_pct")
    elif tp_src == "trailing":
        disabled.append("tp_pct")   # trailing and fixed TP are mutually exclusive

    return disabled


# ── Real-time calculator ───────────────────────────────────────────────

def calculate(params: dict, context: dict) -> dict[str, Any]:
    """
    Compute real-time P&L metrics from current params + account context.

    params:
      position_size_usdt   USDT amount (when sizing=fixed)
      multiplier           multiplier (when sizing=multiplier)
      leverage             int
      sl_pct               stop loss % (positive, e.g. 2.0 = 2%)
      tp_pct               take profit % (positive, e.g. 4.0 = 4%)

    context:
      available_margin     USDT available in account
      signal_position_size USDT size from signal (for multiplier mode)
      symbol_min_order     minimum order size for symbol (USDT)
      signal_leverage      leverage from signal (for follow_signal mode)
      signal_sl_pct        sl from signal
      signal_tp_pct        tp from signal
    """
    available_margin = float(context.get("available_margin", 0))
    signal_pos_size = float(context.get("signal_position_size", 100))
    signal_lev = float(context.get("signal_leverage", 1))
    signal_sl = float(context.get("signal_sl_pct", 10))
    signal_tp = float(context.get("signal_tp_pct", 8))

    # ── Resolve position size ──
    sizing = params.get("position_sizing_method", "fixed")
    if sizing == "multiplier":
        multiplier = float(params.get("multiplier", 1.0))
        position_size = signal_pos_size * multiplier
    else:
        position_size = float(params.get("position_size_usdt", 100))

    # ── Resolve leverage ──
    lev_src = params.get("leverage_source", "custom")
    leverage = signal_lev if lev_src == "follow_signal" else float(params.get("leverage", 1))
    leverage = max(1.0, leverage)

    # ── Resolve SL/TP ──
    sl_src = params.get("sl_source", "follow_signal")
    sl_pct = signal_sl if sl_src == "follow_signal" else float(params.get("sl_pct", signal_sl))

    tp_src = params.get("tp_source", "follow_signal")
    if tp_src == "trailing":
        tp_pct = float(params.get("trail_pct", signal_tp))
    elif tp_src == "follow_signal":
        tp_pct = signal_tp
    else:
        tp_pct = float(params.get("tp_pct", signal_tp))

    # ── Core calculations ──
    notional = position_size * leverage              # total market exposure
    margin_required = position_size / leverage        # initial margin (for isolated)
    fee_cost = notional * OKX_TAKER_FEE * 2          # entry + exit

    gross_profit = position_size * (tp_pct / 100)
    gross_loss   = position_size * (sl_pct / 100)

    net_profit = gross_profit - fee_cost
    net_loss   = gross_loss   + fee_cost

    risk_reward = round(net_profit / net_loss, 2) if net_loss > 0 else 0
    margin_used_pct = round(margin_required / available_margin * 100, 1) if available_margin > 0 else 0

    # Breakeven: minimum tp_pct to cover fees
    breakeven_pct = round(fee_cost / position_size * 100, 4) if position_size > 0 else 0

    return {
        "position_size_usdt": round(position_size, 2),
        "leverage": leverage,
        "notional_usdt": round(notional, 2),
        "margin_required_usdt": round(margin_required, 2),
        "margin_used_pct": margin_used_pct,
        "sl_pct": sl_pct,
        "tp_pct": tp_pct,
        "gross_profit_usdt": round(gross_profit, 2),
        "gross_loss_usdt": round(gross_loss, 2),
        "fee_cost_usdt": round(fee_cost, 4),
        "net_profit_usdt": round(net_profit, 2),
        "net_loss_usdt": round(net_loss, 2),
        "risk_reward_ratio": risk_reward,
        "breakeven_pct": breakeven_pct,
    }


# ── Constraint validation ──────────────────────────────────────────────

def validate(params: dict, context: dict) -> ConstraintResult:
    """
    Full validation: hard errors + soft warnings + disabled fields + calculator.

    Hard errors   → execution is impossible (UI blocks submit)
    Warnings      → suboptimal but allowed (UI shows yellow)
    """
    errors: list[str] = []
    warnings: list[str] = []
    disabled = get_disabled_fields(params)

    available_margin = float(context.get("available_margin", 0))
    symbol_min_order = float(context.get("symbol_min_order", 5))  # USDT

    calc = calculate(params, context)
    position_size = calc["position_size_usdt"]
    leverage      = calc["leverage"]
    sl_pct        = calc["sl_pct"]
    tp_pct        = calc["tp_pct"]
    fee_cost      = calc["fee_cost_usdt"]
    margin_req    = calc["margin_required_usdt"]

    # ── HARD ERRORS (block execution) ─────────────────────────────────

    # 1. Minimum order size
    if position_size < symbol_min_order:
        errors.append(
            f"포지션 크기 ${position_size:.2f}가 OKX 최소 주문액 ${symbol_min_order:.2f} 미만"
        )

    # 2. Margin overflow
    if available_margin > 0 and margin_req > available_margin * 0.95:
        errors.append(
            f"증거금 ${margin_req:.2f} 필요 — 가용잔고 ${available_margin:.2f}의 95% 초과"
        )

    # 3. TP smaller than fees (guaranteed loss)
    if calc["net_profit_usdt"] <= 0:
        errors.append(
            f"수수료 ${fee_cost:.4f} 이후 순이익이 0 이하 — TP를 높이거나 포지션 크기를 키우세요"
        )

    # 4. SL direction error
    if sl_pct <= 0:
        errors.append("손절(SL)은 0보다 커야 합니다")

    if tp_pct <= 0:
        errors.append("익절(TP)은 0보다 커야 합니다")

    # 5. SL > TP (would stop out before profiting in wrong direction logic)
    if sl_pct >= tp_pct * 3:
        errors.append(
            f"손절({sl_pct}%)이 익절({tp_pct}%)의 3배 이상 — 설정을 확인하세요"
        )

    # 6. Leverage bounds
    if leverage < 1:
        errors.append("레버리지는 최소 1x")
    if leverage > 125:
        errors.append("OKX 최대 레버리지 125x 초과")

    # ── SOFT WARNINGS (allow but caution) ─────────────────────────────

    # R:R below 1
    rr = calc["risk_reward_ratio"]
    if rr < 1.0 and not errors:
        warnings.append(
            f"손익비 {rr:.2f} — 100번 이기고 100번 지면 손해. 1.0 이상 권장"
        )

    # High leverage
    if leverage >= 10:
        warnings.append(f"레버리지 {leverage:.0f}x — 청산 위험. 10x 이하 권장")

    # SL too tight (noise zone)
    if sl_pct < 0.5:
        warnings.append(f"손절 {sl_pct}% — 시장 노이즈에 오작동 가능. 0.5% 이상 권장")

    # Large position relative to balance
    if available_margin > 0:
        pct_of_balance = margin_req / available_margin * 100
        if pct_of_balance > 30:
            warnings.append(
                f"계좌의 {pct_of_balance:.1f}% 사용 — 30% 이하 권장"
            )

    # Win rate needed to break even
    if rr > 0:
        breakeven_wr = round(1 / (1 + rr) * 100, 1)
        if breakeven_wr > 50:
            warnings.append(
                f"이 손익비에서 손익분기 승률: {breakeven_wr}% 이상 필요"
            )

    return ConstraintResult(
        valid=len(errors) == 0,
        hard_errors=errors,
        warnings=warnings,
        disabled_fields=disabled,
        calculator=calc,
    )
