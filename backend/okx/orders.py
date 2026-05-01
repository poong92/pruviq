"""
PRUVIQ Simulation → OKX Execution bridge.
Converts simulation results to live OKX orders with broker tag.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Optional

from . import storage
from .client import OKXClient
from .models import SimToExecRequest
from .oauth import get_api_credentials

logger = logging.getLogger("okx_orders")


def _pruviq_to_okx_inst_id(symbol: str) -> str:
    """Convert PRUVIQ symbol → OKX instId (BTCUSDT → BTC-USDT-SWAP)."""
    if "-" in symbol:
        return symbol if symbol.endswith("-SWAP") else f"{symbol}-SWAP"
    for quote in ("USDT", "USDC", "USD"):
        if symbol.endswith(quote):
            return f"{symbol[:-len(quote)]}-{quote}-SWAP"
    return symbol


async def _calc_contract_sz(
    client: OKXClient,
    inst_id: str,
    position_usdt: float,
    leverage: int,
    price: float,
) -> str:
    """
    Calculate correct OKX SWAP contract size (integer contracts).

    OKX SWAP sz = number of contracts (must be integer ≥ minSz).
    Each contract = ctVal base currency.
    Example: BTC-USDT-SWAP ctVal=0.01 BTC
      $100 × 5x / (0.01 BTC × $85,000) = 0.58 → floor → 0 contracts → raise ValueError
      $500 × 5x / (0.01 BTC × $85,000) = 2.94 → floor → 2 contracts ✓
    """
    info = await client.get_instrument_info(inst_id)
    ct_val = info["ctVal"]
    min_sz = info["minSz"]
    lot_sz = info["lotSz"]

    notional = position_usdt * leverage
    raw_contracts = notional / (ct_val * price)
    # Round down to lot_sz boundary
    contracts = math.floor(raw_contracts / lot_sz) * lot_sz

    if contracts < min_sz:
        raise ValueError(
            f"Position too small for {inst_id}: "
            f"${position_usdt:.0f} × {leverage}x = ${notional:.0f} notional "
            f"= {raw_contracts:.3f} contracts (min {min_sz}). "
            f"Need at least ${ct_val * price * min_sz:.0f} notional."
        )

    return str(int(contracts))


def _round_to_tick(price: float, tick_sz: float, *, round_down: bool) -> str:
    """Snap `price` to the tickSz grid and format without scientific notation.

    OKX rejects algo-order trigger prices that are off-grid. tickSz varies
    per instrument: BTC-USDT-SWAP=0.1, DOGE-USDT-SWAP=0.00001, SHIB-1e-9.
    For SL we round conservatively (towards-stop — below entry on longs, above
    on shorts); for TP, towards-goal. The caller chooses via round_down.

    Format: %.Nf where N = decimal places implied by tickSz (no 'e-notation').
    Python's `repr(1e-9)` gives '1e-09' which OKX rejects.
    """
    if tick_sz <= 0:
        tick_sz = 0.01
    ticks = price / tick_sz
    snapped = (math.floor(ticks) if round_down else math.ceil(ticks)) * tick_sz
    # Derive decimals from tickSz (e.g. 0.00001 → 5). Guard log10 of int/float.
    try:
        decimals = max(0, -int(math.floor(math.log10(tick_sz))))
    except (ValueError, OverflowError):
        decimals = 8
    # Cap at 10 — OKX price precision ceiling.
    decimals = min(decimals, 10)
    return f"{snapped:.{decimals}f}"


def _trail_pct_to_callback_ratio(trail_pct: float) -> str:
    """Map PRUVIQ's percent-form trail_pct (e.g. 2.0 = 2%) to OKX
    callbackRatio decimal-string (e.g. "0.02").

    Parity anchor: simulator engine_fast.py:1372 uses decimal-form trailing_pct
    in `best_price * (1 - trailing_pct)`. PRUVIQ's strategy schema stores
    percent-form (strategies.py:88 `trail_pct REAL DEFAULT 3` = 3%).
    OKX move_order_stop's callbackRatio is decimal-string per its API spec.

    The /100 division happens here, in *one place only* — Phase 2.1 plan
    advisor #1: params-correctness parity is the test target, and this
    function is the single seam where the conversion lives.
    """
    return f"{trail_pct / 100:g}"


def _calc_sl_tp_prices(
    entry_price: float,
    direction: str,
    sl_pct: float,
    tp_pct: float,
    tick_sz: float = 0.01,
) -> tuple[str, str]:
    """Convert simulation SL/TP percentages to absolute prices, snapped to
    OKX tickSz grid.

    tick_sz MUST come from client.get_instrument_info(inst_id)["tickSz"] for
    low-price coins (DOGE/SHIB/PEPE). Default 0.01 is BTC-ish and rounds
    sub-cent coins to "0.00" — guaranteed OKX reject → naked position.
    """
    if direction == "short":
        sl_price = entry_price * (1 + sl_pct / 100)
        tp_price = entry_price * (1 - tp_pct / 100)
        # short: SL above entry (round up = conservative toward-stop),
        # TP below entry (round up = less aggressive goal).
        return (
            _round_to_tick(sl_price, tick_sz, round_down=False),
            _round_to_tick(tp_price, tick_sz, round_down=False),
        )
    sl_price = entry_price * (1 - sl_pct / 100)
    tp_price = entry_price * (1 + tp_pct / 100)
    # long: SL below entry (round down = conservative toward-stop),
    # TP above entry (round down = less aggressive goal).
    return (
        _round_to_tick(sl_price, tick_sz, round_down=True),
        _round_to_tick(tp_price, tick_sz, round_down=True),
    )


async def execute_from_simulation(
    session_id: str,
    req: SimToExecRequest,
    current_price: Optional[float] = None,
    cl_ord_id: Optional[str] = None,
) -> dict:
    """
    Execute simulation result as live OKX trade.

    1. Get valid OAuth token
    2. Convert symbol → OKX instId
    3. If current_price not provided (or 0), fetch mark price from OKX
    4. Place market order (with broker tag + optional clOrdId for idempotency)
    5. Set SL/TP algo orders

    cl_ord_id: optional caller-supplied client order ID. When present, OKX
    rejects duplicate submissions — use a deterministic hash of the source
    signal to make retries safe.
    """
    creds = get_api_credentials(session_id)
    inst_id = _pruviq_to_okx_inst_id(req.symbol)
    side = "sell" if req.direction == "short" else "buy"
    td_mode = req.td_mode if req.td_mode in ("isolated", "cross") else "isolated"

    async with OKXClient(**creds) as client:
        # Auto-fetch mark price if not supplied (or zero)
        if not current_price or current_price <= 0:
            logger.warning(
                "current_price not supplied for %s — fetching mark price", inst_id
            )
            current_price = await client.get_mark_price(inst_id)

        # Correct OKX SWAP contract size (integer, uses ctVal). Fetch tickSz
        # in the same call (cached) so SL/TP can snap to grid below.
        info = await client.get_instrument_info(inst_id)
        tick_sz = info.get("tickSz", 0.01)
        sz = await _calc_contract_sz(client, inst_id, req.position_size_usdt, req.leverage, current_price)

        logger.warning(
            "→ Execute %s %s sz=%s lever=%d td_mode=%s strategy=%s price=%.4f",
            side, inst_id, sz, req.leverage, td_mode, req.strategy, current_price,
        )

        # Set leverage before placing order
        await client.set_leverage(
            inst_id=inst_id,
            lever=req.leverage,
            mgn_mode=td_mode,
        )

        # Market order
        order = await client.place_order(
            inst_id=inst_id,
            side=side,
            sz=sz,
            td_mode=td_mode,
            cl_ord_id=cl_ord_id,
        )
        ord_id = order.get("ordId", "")
        logger.warning("← Market order placed ordId=%s", ord_id)

        # Algo legs — if any fail, immediately close the naked position.
        # Branching on tp_source:
        #   - "trailing" → conditional SL only + separate move_order_stop trailing TP
        #   - else       → conditional SL+TP single algo (existing path)
        sl_price, tp_price = _calc_sl_tp_prices(
            current_price, req.direction, req.sl_pct, req.tp_pct, tick_sz=tick_sz,
        )
        close_side = "buy" if req.direction == "short" else "sell"

        use_trailing = req.tp_source == "trailing" and req.trail_pct
        callback_ratio: Optional[str] = None
        trail_algo_id: Optional[str] = None

        try:
            if use_trailing:
                # SL leg only — no TP on the conditional algo.
                algo_result = await client.place_algo_order(
                    inst_id=inst_id,
                    side=close_side,
                    sz=sz,
                    sl_trigger_px=sl_price,
                    td_mode=td_mode,
                )
                logger.warning("← SL set (trailing strategy): SL=%s ordId=%s", sl_price, ord_id)
                # Trailing TP via OKX move_order_stop. Sim parity:
                # engine_fast.py:1372 uses decimal-form trailing_pct (0.02);
                # we convert PRUVIQ's percent-form trail_pct in one seam.
                callback_ratio = _trail_pct_to_callback_ratio(req.trail_pct)
                trail_cl_ord_id = (
                    f"{cl_ord_id}t" if cl_ord_id else None
                )  # OKX algoClOrdId limit ~32 chars; suffix narrows to keep len.
                trail_result = await client.place_trailing_stop(
                    inst_id=inst_id,
                    side=close_side,
                    sz=sz,
                    callback_ratio=callback_ratio,
                    td_mode=td_mode,
                    cl_ord_id=trail_cl_ord_id,
                )
                trail_algo_data = trail_result.get("data", [{}])
                trail_algo_id = (
                    trail_algo_data[0].get("algoId") if trail_algo_data else None
                )
                logger.warning(
                    "← Trailing TP armed: callbackRatio=%s algoId=%s",
                    callback_ratio, trail_algo_id,
                )
            else:
                algo_result = await client.place_algo_order(
                    inst_id=inst_id,
                    side=close_side,
                    sz=sz,
                    sl_trigger_px=sl_price,
                    tp_trigger_px=tp_price,
                    td_mode=td_mode,
                )
                logger.warning("← SL/TP set: SL=%s TP=%s ordId=%s", sl_price, tp_price, ord_id)
        except Exception as algo_err:
            logger.error(
                "CRITICAL: algo placement failed after order %s (%s) — closing naked position: %s",
                ord_id, inst_id, algo_err,
            )
            try:
                await client.close_position(inst_id, mgn_mode=td_mode)
                logger.warning("Emergency close executed for %s", inst_id)
            except Exception as close_err:
                logger.error("EMERGENCY CLOSE FAILED for %s: %s", inst_id, close_err)
            raise ValueError(
                f"Algo placement failed for {inst_id} (ordId={ord_id}), "
                f"position closed as safety measure. Error: {algo_err}"
            )

    # Persist the trailing algoId for close-detection sibling-cancel and
    # restart-recovery. Outside the OKXClient ctx so the DB write doesn't
    # contend with the OKX HTTP client's connection pool teardown.
    # Failure here is non-fatal — same invariant the merkle audit honours.
    if use_trailing and trail_algo_id:
        try:
            storage.insert_trailing_algo(
                algo_id=trail_algo_id,
                session_id=session_id,
                inst_id=inst_id,
                callback_ratio=callback_ratio or "",
                ts_iso=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                signal_id=cl_ord_id,
                parent_ord_id=ord_id,
            )
        except Exception as persist_err:
            logger.warning(
                "trailing algo persist failed (non-fatal): %s", persist_err
            )

    # Moat-2: Merkle audit leaf for the manual /execute/order path.
    # auto_executor records its own leaf (see auto_executor.py:677). Until
    # this PR, manual orders went unrecorded — a gap users could point to
    # to argue "the audit log is selective". Leaf pre-image here mirrors
    # the auto-executor path exactly: session_id | ts_iso | inst_id |
    # direction-in-OKX-terms | sz | entry_price | broker_code. Users can
    # reproduce the hash off-line using the response dict below
    # (`details.entry_price`, `details.inst_id`, etc.).
    #
    # NOTE: we use `current_price` (the mark price at order time) as the
    # leaf's `fill_price`, NOT the actual OKX avgPx. That's a deliberate
    # trade-off: avgPx requires a second OKX round-trip + a wait loop
    # (auto_executor does it because it needs the number for SL/TP
    # pricing; here we already set SL/TP from mark). Keeping it to
    # mark-price keeps the manual path low-latency and the leaf pre-image
    # is still derivable by the user from the response.
    try:
        from .merkle import record_order as _merkle_record
        # API broker code (this path is API order audit) — separate from OAuth
        # broker code per OKX BD 2026-04-28.
        from .config import OKX_BROKER_CODE_API as _BROKER
        _merkle_record(
            session_id=session_id,
            ts_iso=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            inst_id=inst_id,
            side=side,
            sz=sz,
            fill_price=current_price,
            broker_code=_BROKER or "",
        )
    except Exception as audit_err:
        # Audit failure must not block the trading path — same invariant
        # auto_executor honours. We log and move on.
        logger.warning("merkle audit record failed (non-fatal): %s", audit_err)

    return {
        "order": order,
        "algo": algo_result,
        "trailing_algo_id": trail_algo_id,
        "details": {
            "inst_id": inst_id,
            "side": side,
            "size": sz,
            "entry_price": current_price,
            "sl_price": sl_price,
            "tp_price": tp_price if not use_trailing else None,
            "callback_ratio": callback_ratio,
            "leverage": req.leverage,
            "td_mode": td_mode,
            "strategy": req.strategy,
            "tp_source": req.tp_source,
        },
    }


async def build_dry_run_payload(
    session_id: str,
    req: SimToExecRequest,
    current_price: Optional[float] = None,
) -> dict:
    """Phase 2.2 dry-run entrypoint. Computes the OKX request bodies that
    `execute_from_simulation` *would* send for this signal — without firing
    any POST. OKX read endpoints (mark price + instrument info) are still
    called because tickSz/ctVal cannot be derived without them, and they're
    cheap GETs.

    Returns the three request bodies (`order_request`, `sl_algo_request`,
    `trailing_algo_request`) and a `details` block mirroring the live path.
    The Phase 2.2 monitor diffs these against the simulator ledger to flag
    parity drift over a 7-day window.
    """
    creds = get_api_credentials(session_id)
    inst_id = _pruviq_to_okx_inst_id(req.symbol)
    side = "sell" if req.direction == "short" else "buy"
    close_side = "buy" if req.direction == "short" else "sell"
    td_mode = req.td_mode if req.td_mode in ("isolated", "cross") else "isolated"

    async with OKXClient(**creds) as client:
        if not current_price or current_price <= 0:
            current_price = await client.get_mark_price(inst_id)
        info = await client.get_instrument_info(inst_id)
        tick_sz = info.get("tickSz", 0.01)
        sz = await _calc_contract_sz(
            client, inst_id, req.position_size_usdt, req.leverage, current_price,
        )

    sl_price, tp_price = _calc_sl_tp_prices(
        current_price, req.direction, req.sl_pct, req.tp_pct, tick_sz=tick_sz,
    )
    use_trailing = req.tp_source == "trailing" and req.trail_pct
    callback_ratio = (
        _trail_pct_to_callback_ratio(req.trail_pct) if use_trailing else None
    )

    order_request = {
        "instId": inst_id,
        "tdMode": td_mode,
        "side": side,
        "ordType": "market",
        "sz": sz,
    }
    if use_trailing:
        sl_algo_request = {
            "instId": inst_id,
            "tdMode": td_mode,
            "side": close_side,
            "ordType": "conditional",
            "sz": sz,
            "slTriggerPx": sl_price,
            "slOrdPx": "-1",
        }
        trailing_algo_request = {
            "instId": inst_id,
            "tdMode": td_mode,
            "side": close_side,
            "ordType": "move_order_stop",
            "sz": sz,
            "callbackRatio": callback_ratio,
        }
    else:
        sl_algo_request = {
            "instId": inst_id,
            "tdMode": td_mode,
            "side": close_side,
            "ordType": "conditional",
            "sz": sz,
            "slTriggerPx": sl_price,
            "slOrdPx": "-1",
            "tpTriggerPx": tp_price,
            "tpOrdPx": "-1",
        }
        trailing_algo_request = None

    return {
        "order_request": order_request,
        "sl_algo_request": sl_algo_request,
        "trailing_algo_request": trailing_algo_request,
        "details": {
            "inst_id": inst_id,
            "side": side,
            "size": sz,
            "entry_price": current_price,
            "sl_price": sl_price,
            "tp_price": tp_price if not use_trailing else None,
            "callback_ratio": callback_ratio,
            "leverage": req.leverage,
            "td_mode": td_mode,
            "strategy": req.strategy,
            "tp_source": req.tp_source,
        },
    }


async def cancel_trailing_for_position(
    session_id: str, parent_ord_id: str
) -> dict:
    """Phase 2.1.4: when a position closes (SL hit, manual close, OKX-managed
    exit), cancel the sibling trailing algo so it doesn't leak as an orphan.

    Looked-up via the entry order's ordId (parent_ord_id). If no trailing
    was armed for this position (fixed SL+TP path), this is a no-op.

    Failure to cancel is non-fatal here — reconciler.py sweeps orphan
    positions on its next tick (Phase 2.2 monitor will surface algo orphans
    similarly).
    """
    row = storage.find_trailing_by_parent(parent_ord_id)
    if not row:
        return {"cancelled": False, "reason": "no_trailing_for_position"}

    creds = get_api_credentials(session_id)
    async with OKXClient(**creds) as client:
        try:
            await client.cancel_algo_orders(
                algo_ids=[row["algo_id"]], inst_id=row["inst_id"],
            )
            storage.update_trailing_state(row["algo_id"], "cancelled")
            return {"cancelled": True, "algo_id": row["algo_id"]}
        except Exception as cancel_err:
            logger.warning(
                "trailing cancel failed for algoId=%s (parent=%s): %s",
                row["algo_id"], parent_ord_id, cancel_err,
            )
            return {
                "cancelled": False,
                "reason": "okx_cancel_error",
                "error": str(cancel_err),
            }
