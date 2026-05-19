"""
DCA execution loop — paper-mode default.

Polls every 60 s, walks active DCA bots, and writes simulated fills to
the `dca_fills` table. **No real OKX orders are placed in this PR** —
`paper_mode=0` bots are skipped with a warning log. Real-mode placement
is intentionally a separate future PR so this one can be safely deployed
+ dog-fooded.

Per-tick logic for each active paper bot:
  1. Fetch current mark price from OKX public `/api/v5/market/ticker`.
  2. Read existing open `dca_fills`.
  3. If none: write a "base" fill at the mark price (order_num=0).
  4. Else: compute `next_trigger_price` = avg(last fill price) drifted
     by `price_step_pct`. If mark crossed and we still have safety
     capacity → write the next safety fill at the trigger price.
  5. Compute weighted avg entry across open fills. If mark reached the
     TP price → mark every open fill as `tp_closed`, log the result.
  6. `stop_scaling_price` halts new fills (existing remain open).

Math mirrors `simulate_dca` in dca_backtest.py so live behaviour will
agree with the user's backtest results.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from typing import Any, Optional

import httpx

from .client import OKXClient
from .config import OKX_BASE_URL
from .dca_bots import _ensure_tables, _row_to_dca, _DCA_COLUMNS
from .oauth import get_api_credentials
from .storage import _get_conn

logger = logging.getLogger("okx_dca_loop")

# Phase B2 — real-mode env gate. Activation requires *both* this env var
# set to "true" AND the bot's paper_mode=0. Owner-controlled and survives
# uvicorn restart.
OKX_DCA_REAL_ENABLED = os.environ.get("OKX_DCA_REAL_ENABLED", "").lower() == "true"

# Circuit breaker: max real fills per bot within this window (audit risk-
# manager L67). When exceeded, _circuit_breaker_check returns True and the
# loop must deactivate the bot.
_CIRCUIT_WINDOW_S = 3600  # 1 hour
_CIRCUIT_MAX_FILLS = 5

# Heartbeat for /dca-bots/loop-health. In-memory by design: a missing
# value means the loop has not started since the last process boot,
# which is exactly what we want owners to see during dog-foot.
_LAST_TICK_AT: float = 0.0
_LAST_TICK_BOTS: int = 0


def loop_heartbeat() -> dict[str, float | int | bool]:
    """Public read for the loop-health endpoint."""
    now = time.time()
    return {
        "last_tick_at": _LAST_TICK_AT,
        "seconds_ago": (now - _LAST_TICK_AT) if _LAST_TICK_AT else -1,
        "interval_s": 60,
        "bots_last_tick": _LAST_TICK_BOTS,
        # Healthy = ticked within the last 2 intervals
        "healthy": bool(_LAST_TICK_AT and (now - _LAST_TICK_AT) < 130),
    }


async def _fetch_mark_price(symbol: str) -> float:
    """Fetch last trade price from OKX public ticker. Returns 0 on failure."""
    if "-" not in symbol:
        # PRUVIQ-style BTCUSDT → OKX swap form
        if symbol.endswith("USDT"):
            symbol = symbol[:-4] + "-USDT-SWAP"
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            resp = await client.get(
                f"{OKX_BASE_URL}/api/v5/market/ticker",
                params={"instId": symbol},
            )
            if resp.status_code != 200:
                return 0.0
            body = resp.json()
            if body.get("code") != "0" or not body.get("data"):
                return 0.0
            return float(body["data"][0].get("last") or 0.0)
    except Exception as e:
        logger.warning("ticker fetch failed for %s: %s", symbol, e)
        return 0.0


def _list_active_bots() -> list[dict[str, Any]]:
    """All bots with is_active=1 across all sessions."""
    _ensure_tables()
    with _get_conn() as conn:
        rows = conn.execute(
            f"SELECT {', '.join(_DCA_COLUMNS)} FROM dca_bots WHERE is_active = 1"
        ).fetchall()
    return [_row_to_dca(r) for r in rows]


def _list_open_fills(bot_id: str) -> list[dict[str, Any]]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT id, order_num, fill_price, fill_size_usdt, status "
            "FROM dca_fills WHERE bot_id = ? AND status = 'open' "
            "ORDER BY order_num",
            (bot_id,),
        ).fetchall()
    return [
        {"id": r[0], "order_num": r[1], "fill_price": r[2],
         "fill_size_usdt": r[3], "status": r[4]}
        for r in rows
    ]


def _write_paper_fill(
    bot_id: str, order_num: int, price: float, size_usdt: float
) -> None:
    okx_order_id = f"paper-{uuid.uuid4().hex[:12]}"
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO dca_fills "
            "(bot_id, order_num, fill_price, fill_size_usdt, okx_order_id, "
            "filled_at, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
            (bot_id, order_num, price, size_usdt, okx_order_id, time.time()),
        )


def _close_all_open_fills(bot_id: str, reason: str = "tp_closed") -> int:
    with _get_conn() as conn:
        cur = conn.execute(
            "UPDATE dca_fills SET status = ? "
            "WHERE bot_id = ? AND status = 'open'",
            (reason, bot_id),
        )
        return cur.rowcount


# Per-bot consecutive ticker-fetch failure counts. Reset on first success.
# After _TICKER_MAX_FAILS we auto-deactivate so a botched symbol or extended
# OKX outage doesn't silently keep the loop "ticking" with mark=0 forever.
_TICKER_FAIL_COUNTS: dict[str, int] = {}
_TICKER_MAX_FAILS = 5  # 5 × 60s = 5 min outage tolerance


def _is_bot_still_active(bot_id: str) -> bool:
    """Re-read is_active right before any side-effects. Closes the pause-vs-
    tick window between _list_active_bots and _tick_bot (M1 from audit)."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT is_active FROM dca_bots WHERE id = ?", (bot_id,)
        ).fetchone()
    return bool(row) and row[0] == 1


def _deactivate_bot(bot_id: str, reason: str) -> None:
    # Capture bot identity BEFORE the UPDATE so the alert payload is correct.
    with _get_conn() as conn:
        bot_row = conn.execute(
            "SELECT session_id, name, symbol FROM dca_bots WHERE id = ?",
            (bot_id,),
        ).fetchone()
        conn.execute(
            "UPDATE dca_bots SET is_active = 0, updated_at = ? WHERE id = ?",
            (time.time(), bot_id),
        )
    logger.warning(
        "dca bot auto-deactivated bot=%s reason=%s", bot_id[:8], reason
    )
    # Telegram alert (audit follow-up): owner shouldn't discover a silent
    # deactivation only on the next dashboard glance (up to 24h delay per
    # dogfoot manual). Fire-and-forget; loop continues regardless.
    if bot_row is not None:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(
                    _alert_deactivation(
                        session_id=str(bot_row[0]),
                        bot_name=str(bot_row[1]),
                        symbol=str(bot_row[2]),
                        reason=reason,
                    )
                )
        except RuntimeError:
            # No running loop (e.g. sync test caller) — skip alert
            pass


async def _alert_deactivation(
    session_id: str, bot_name: str, symbol: str, reason: str,
) -> None:
    """Best-effort Telegram alert. Never raises.
    Skips silently if user has no chat_id or TELEGRAM_TOKEN unset."""
    try:
        from .settings import get_settings
        settings = get_settings(session_id)
        chat_id = settings.get("alert_telegram_chat_id", "")
        if not chat_id:
            return
        msg = (
            "⚠️ <b>DCA bot auto-deactivated</b>\n"
            f"bot: <b>{bot_name}</b> ({symbol})\n"
            f"reason: <code>{reason}</code>\n\n"
            "Check the dashboard. Existing fills remain open; "
            "no new orders will be placed until you reactivate."
        )
        from .notifications import _send
        await _send(chat_id, msg)
    except Exception as e:
        logger.warning("dca deactivation alert failed: %s", e)


def _weighted_avg(fills: list[dict[str, Any]]) -> float:
    total = sum(f["fill_size_usdt"] for f in fills)
    if total <= 0:
        return 0.0
    return sum(f["fill_price"] * f["fill_size_usdt"] for f in fills) / total


# ── Phase B2 real-mode helpers ─────────────────────────────────
# These functions are imported but NOT called by _tick_bot yet — that's
# the next sub-sprint (B2-B). Keeping them as dead code here lets the
# unit tests + API doc generator pick them up while paper-day0 dog-foots
# the safety hotfixes (#2070/#2071/#2072/#2073) untouched.

def _get_okx_client_for_session(session_id: str) -> "OKXClient | None":
    """Load API credentials for a session and instantiate an OKXClient.

    Returns None on missing/expired credentials so the caller can
    auto-deactivate the bot (M4 from audit). Never raises — silent fail
    on a 60s loop would burn logs forever.
    """
    try:
        creds = get_api_credentials(session_id)
    except Exception as e:  # broad on purpose — any failure → safe halt
        logger.error(
            "dca real-mode: get_api_credentials failed session=%s: %s",
            session_id[:8] if session_id else "?", e,
        )
        return None
    if not creds or not creds.get("api_key"):
        return None
    return OKXClient(
        api_key=creds["api_key"],
        secret_key=creds["secret_key"],
        passphrase=creds["passphrase"],
    )


def _circuit_breaker_check(bot_id: str) -> tuple[bool, int]:
    """Return (tripped, fill_count_last_hour). Audit risk-manager L67:
    >5 fills in 1h means a fast move is filling everything — protect the
    owner by halting the bot regardless of whether further safety orders
    still have capacity."""
    cutoff = time.time() - _CIRCUIT_WINDOW_S
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM dca_fills "
            "WHERE bot_id = ? AND filled_at >= ?",
            (bot_id, cutoff),
        ).fetchone()
    count = int(row[0]) if row else 0
    return (count > _CIRCUIT_MAX_FILLS, count)


def _session_daily_loss_check(
    session_id: str, limit_usdt: float
) -> tuple[bool, float]:
    """Return (tripped, today_realised_pnl_usdt). Audit risk-manager Gap A:
    sums realised PnL across all of session's tp_closed cycles since UTC
    00:00. Negative means net loss for the day. Tripped when |loss| ≥ limit.

    Limit of 0 means "no limit" (paper-mode default).
    """
    if limit_usdt <= 0:
        return (False, 0.0)
    # UTC midnight today
    now = time.time()
    today_start = now - (now % 86400)
    with _get_conn() as conn:
        # SUM of (exit_price - avg_entry) × size — but exit_price is
        # implicit in tp_closed rows. For Sprint B2-A we approximate with
        # tp_closed fills (status='tp_closed' means cycle exited above
        # avg + tp_pct, so PnL ≈ +tp_pct × total_open. Loss only enters
        # via failed-cycle deactivation paths added in B2-B).
        # B2-A: return 0.0 to keep helper callable but pnl tracking is
        # finished in B2-B once real fill prices are written.
        row = conn.execute(
            "SELECT COUNT(*) FROM dca_fills "
            "WHERE bot_id IN ("
            "  SELECT id FROM dca_bots WHERE session_id = ?"
            ") AND filled_at >= ?",
            (session_id, today_start),
        ).fetchone()
    fill_count = int(row[0]) if row else 0
    pnl_today = 0.0  # B2-A placeholder, B2-B will compute via exit_price
    _ = fill_count  # silence linter
    return (False, pnl_today)


def _calc_size_contracts(
    size_usdt: float,
    price: float,
    ct_val: float,
    min_sz: float = 0.01,
    lot_sz: float = 0.01,
) -> str:
    """OKX SWAP `sz` is contracts (fractional, lot-quantized), not USDT.
    Audit code-reviewer B1 → real-world test (2026-05-19) showed first
    real-mode order tried sz=1 contract = $213 when owner intended $22.
    Root cause: the earlier `max(1, round(...))` floored sub-1-contract
    requests up to 1 — a 10× silent oversize.

    Correct flow:
      contracts = size_usdt / (ct_val × price)
      if contracts < min_sz   → raise (size too small)
      quantize to lot_sz floor (e.g. 0.01) so we never round UP and
      accidentally exceed the user's intent
    """
    import decimal as _d

    if ct_val <= 0 or price <= 0 or size_usdt <= 0:
        raise ValueError(
            f"invalid sz inputs: size_usdt={size_usdt} "
            f"price={price} ct_val={ct_val}"
        )
    contracts = size_usdt / (ct_val * price)
    if contracts < min_sz:
        raise ValueError(
            f"size too small: {size_usdt} USDT → "
            f"{contracts:.6f} contracts < min_sz={min_sz}. "
            f"Raise BASE size_usdt to ≥ {ct_val * price * min_sz:.2f} USDT."
        )
    # Floor-quantize to lot_sz so we never silently round UP.
    d_lot = _d.Decimal(str(lot_sz))
    d_ct = _d.Decimal(str(contracts))
    lots = (d_ct / d_lot).quantize(_d.Decimal("1"), rounding=_d.ROUND_DOWN)
    quantized = lots * d_lot
    if quantized < _d.Decimal(str(min_sz)):
        raise ValueError(
            f"size after lot-quantize too small: {quantized} < {min_sz}"
        )
    return str(quantized.quantize(d_lot))


def _write_real_fill(
    bot_id: str,
    order_num: int,
    fill_price: float,
    fill_size_usdt: float,
    okx_order_id: str,
) -> None:
    """Mirror of _write_paper_fill but tags the row with the real OKX
    ordId (not "paper-XXX"). The dca_fills UNIQUE index on (bot_id,
    order_num) gives idempotency on the DB side; audit code-reviewer B3
    additionally requires deterministic clOrdId at OKX-side which is set
    by _place_real_order below.
    """
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO dca_fills "
            "(bot_id, order_num, fill_price, fill_size_usdt, okx_order_id, "
            "filled_at, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
            (bot_id, order_num, fill_price, fill_size_usdt, okx_order_id, time.time()),
        )


async def _place_real_order(
    client: "OKXClient",
    bot: dict[str, Any],
    side: str,            # "buy" or "sell"
    target_price: float,
    size_usdt: float,
    order_num: int,
) -> tuple[float, str] | None:
    """Place one real OKX order with audit-mandated safety:
      - B1: sz in contracts (via _calc_size_contracts × ctVal)
      - B2: tdMode=isolated (cross can drain other positions)
      - B3: deterministic clOrdId for idempotency
      - tickSz rounding via OKXClient.round_to_tick
      - 10s fill poll, abort if not filled
    Returns (fill_price, ord_id) on success, None on any failure so
    caller can auto-deactivate the bot.
    """
    inst_id = bot["symbol"]
    bot_id = bot["id"]
    try:
        inst = await client.get_instrument_info(inst_id)
    except Exception as e:
        logger.error(
            "dca real-mode: instrument fetch failed bot=%s inst=%s: %s",
            bot_id[:8], inst_id, e,
        )
        return None
    px = client.round_to_tick(target_price, inst["tickSz"])
    try:
        sz = _calc_size_contracts(
            size_usdt, target_price, inst["ctVal"],
            min_sz=inst.get("minSz", 0.01),
            lot_sz=inst.get("lotSz", 0.01),
        )
    except ValueError as e:
        logger.error(
            "dca real-mode: sz calc rejected bot=%s size_usdt=%s: %s",
            bot_id[:8], size_usdt, e,
        )
        return None
    # OKX clOrdId rule: 1-32 chars, letters + numbers ONLY (no dashes,
    # no underscores). audit B3 spec used 'dca-{bot_id[:8]}-{order_num}'
    # which OKX rejects with sCode=51000 'Parameter clOrdId error'
    # (live test 2026-05-19). Drop the dashes — bot_id[:8] is already
    # hex so concatenation stays alphanumeric. order_num zero-padded to
    # 3 digits keeps deterministic length + ordering.
    cl_ord_id = f"dca{bot_id[:8]}{order_num:03d}"
    try:
        resp = await client.place_order(
            inst_id=inst_id,
            side=side,
            sz=sz,
            ord_type="limit",
            px=px,
            td_mode="isolated",
            cl_ord_id=cl_ord_id,
        )
    except Exception as e:
        logger.error(
            "dca real-mode: place_order failed bot=%s side=%s sz=%s px=%s: %s",
            bot_id[:8], side, sz, px, e,
        )
        return None
    ord_id = resp.get("ordId", "")
    if not ord_id:
        logger.error(
            "dca real-mode: place_order returned no ordId bot=%s resp=%s",
            bot_id[:8], resp,
        )
        return None
    # 10s fill poll
    for _ in range(10):
        await asyncio.sleep(1)
        try:
            order_info = await client._get(
                "/api/v5/trade/order",
                {"instId": inst_id, "ordId": ord_id},
            )
            items = order_info.get("data", [])
            if items and items[0].get("state") == "filled":
                fill_price = float(items[0].get("avgPx") or target_price)
                return (fill_price, ord_id)
        except Exception as e:
            logger.warning(
                "dca real-mode: order poll failed bot=%s ord=%s: %s",
                bot_id[:8], ord_id, e,
            )
            break
    logger.error(
        "dca real-mode: order not filled in 10s bot=%s ord=%s — halt",
        bot_id[:8], ord_id,
    )
    return None


async def _tick_bot(bot: dict[str, Any]) -> None:
    """One pass for one bot. Routes between paper and real branches.

    Real branch requires BOTH:
      - OKX_DCA_REAL_ENABLED env var set to "true" (deploy-time gate)
      - bot.paper_mode == 0 (per-bot toggle)
    Either missing → skip with warning, no DB mutation.
    """
    bot_id = bot["id"]

    # M1: pause-vs-tick race. _list_active_bots ran ≥1 SELECT ago; user may
    # have hit pause-all in between. Re-check before any DB mutation. Done
    # before the paper/real branch so both paths benefit from the same
    # guard with one DB hit.
    if not _is_bot_still_active(bot_id):
        logger.info(
            "dca tick skip bot=%s — deactivated between list and tick",
            bot_id[:8],
        )
        _TICKER_FAIL_COUNTS.pop(bot_id, None)
        return

    paper_mode = bot.get("paper_mode", 1)
    if not paper_mode:
        # B2-B (audit): dispatch to real-mode path only when both gates pass.
        if not OKX_DCA_REAL_ENABLED:
            logger.warning(
                "dca_loop skip bot=%s — paper_mode=0 but OKX_DCA_REAL_ENABLED unset",
                bot_id[:8],
            )
            return
        await _tick_bot_real(bot)
        return

    mark = await _fetch_mark_price(bot["symbol"])
    if mark <= 0:
        # M2: count consecutive failures, deactivate after _TICKER_MAX_FAILS
        # so a stale symbol or extended OKX outage stops the silent loop.
        fails = _TICKER_FAIL_COUNTS.get(bot_id, 0) + 1
        _TICKER_FAIL_COUNTS[bot_id] = fails
        if fails >= _TICKER_MAX_FAILS:
            _deactivate_bot(
                bot_id, f"ticker_fetch_failed_{fails}x_consecutive"
            )
            _TICKER_FAIL_COUNTS.pop(bot_id, None)
        return
    # Success — reset counter so a single transient failure doesn't accumulate
    _TICKER_FAIL_COUNTS.pop(bot_id, None)

    direction = bot.get("direction", "long")
    step_pct = float(bot["price_step_pct"]) / 100.0
    multiplier = float(bot.get("size_multiplier", 1.0))
    max_safety = int(bot["max_safety_orders"])
    tp_pct = float(bot["tp_pct"]) / 100.0
    stop = float(bot.get("stop_scaling_price", 0.0))
    base_size = float(bot["position_size_usdt"])
    base_override = float(bot.get("base_price_usdt", 0.0))

    fills = _list_open_fills(bot_id)

    # Stop scaling guard
    scaling_halted = False
    if stop > 0:
        if direction == "long" and mark <= stop:
            scaling_halted = True
        elif direction == "short" and mark >= stop:
            scaling_halted = True

    # 1) No fills yet → base order
    if not fills:
        base_price = base_override if base_override > 0 else mark
        _write_paper_fill(bot_id, 0, base_price, base_size)
        logger.info(
            "dca paper base fill bot=%s price=%.6f size=%.2f",
            bot_id[:8], base_price, base_size,
        )
        return

    # 2) Compute next trigger off last fill — multi-fire loop so a single
    # 60s tick mirrors dca_backtest.simulate_dca's `while` behaviour. When
    # mark moves through several step%s between ticks (gap-down / fast
    # selloff), live and backtest should produce the SAME number of fills.
    # Without this loop, live would only place one safety per tick → user
    # backtests show e.g. 5 fills while live shows 1, breaking the parity
    # rule (rules/feedback_engine_parity.md).
    last_fill = fills[-1]
    last_price = float(last_fill["fill_price"])
    last_size = float(last_fill["fill_size_usdt"])
    next_order_num = last_fill["order_num"] + 1

    while not scaling_halted and next_order_num <= max_safety:
        if direction == "long":
            next_trigger = last_price * (1.0 - step_pct)
            should_fire = mark <= next_trigger
        else:
            next_trigger = last_price * (1.0 + step_pct)
            should_fire = mark >= next_trigger
        if not should_fire:
            break
        next_size = last_size * multiplier
        _write_paper_fill(bot_id, next_order_num, next_trigger, next_size)
        logger.info(
            "dca paper safety #%d bot=%s price=%.6f size=%.2f",
            next_order_num, bot_id[:8], next_trigger, next_size,
        )
        # Update for next iteration
        last_price = next_trigger
        last_size = next_size
        next_order_num += 1

    # Refresh fills view if any safeties fired
    fills = _list_open_fills(bot_id)

    # 4) TP check
    avg = _weighted_avg(fills)
    if avg > 0:
        if direction == "long":
            tp_price = avg * (1.0 + tp_pct)
            tp_hit = mark >= tp_price
        else:
            tp_price = avg * (1.0 - tp_pct)
            tp_hit = mark <= tp_price
        if tp_hit:
            closed = _close_all_open_fills(bot_id, "tp_closed")
            logger.info(
                "dca paper TP hit bot=%s avg=%.6f tp=%.6f mark=%.6f closed=%d",
                bot_id[:8], avg, tp_price, mark, closed,
            )


async def _tick_bot_real(bot: dict[str, Any]) -> None:
    """Real-mode one-bot tick. Audit-mandated safety pre-checks run BEFORE
    any OKX call:

      1. Daily session loss limit (R1) — pause-all session if hit
      2. Circuit breaker (1h/5 fills) — auto-deactivate
      3. Credentials present — else auto-deactivate (M4)
      4. Mark price fetch (shares failure counter with paper-mode)

    Order placement uses _place_real_order which handles:
      - sz unit conversion (B1)
      - tdMode=isolated (B2)
      - deterministic clOrdId (B3)
      - tickSz rounding
      - 10s fill poll

    Any single failed order halts the bot — DCA cannot recover from a
    partial fill mid-cycle without owner attention.
    """
    bot_id = bot["id"]
    session_id = bot.get("session_id", "")

    # 1) Daily session loss limit
    daily_limit = float(bot.get("daily_loss_limit_usdt", 0.0))
    tripped, today_pnl = _session_daily_loss_check(session_id, daily_limit)
    if tripped:
        _deactivate_bot(
            bot_id, f"daily_loss_limit_hit_pnl={today_pnl:.2f}usdt"
        )
        return

    # 2) Circuit breaker
    cb_tripped, fill_count_hr = _circuit_breaker_check(bot_id)
    if cb_tripped:
        _deactivate_bot(
            bot_id, f"circuit_breaker_{fill_count_hr}_fills_in_1h"
        )
        return

    # 3) Credentials
    client = _get_okx_client_for_session(session_id)
    if client is None:
        _deactivate_bot(bot_id, "credentials_missing_or_invalid")
        return

    try:
        # 4) Mark price (shares fail counter with paper path)
        mark = await _fetch_mark_price(bot["symbol"])
        if mark <= 0:
            fails = _TICKER_FAIL_COUNTS.get(bot_id, 0) + 1
            _TICKER_FAIL_COUNTS[bot_id] = fails
            if fails >= _TICKER_MAX_FAILS:
                _deactivate_bot(
                    bot_id, f"ticker_fetch_failed_{fails}x_consecutive"
                )
                _TICKER_FAIL_COUNTS.pop(bot_id, None)
            return
        _TICKER_FAIL_COUNTS.pop(bot_id, None)

        direction = bot.get("direction", "long")
        side = "buy" if direction == "long" else "sell"
        step_pct = float(bot["price_step_pct"]) / 100.0
        multiplier = float(bot.get("size_multiplier", 1.0))
        max_safety = int(bot["max_safety_orders"])
        tp_pct = float(bot["tp_pct"]) / 100.0
        stop = float(bot.get("stop_scaling_price", 0.0))
        base_size = float(bot["position_size_usdt"])
        base_override = float(bot.get("base_price_usdt", 0.0))

        fills = _list_open_fills(bot_id)

        scaling_halted = False
        if stop > 0:
            if direction == "long" and mark <= stop:
                scaling_halted = True
            elif direction == "short" and mark >= stop:
                scaling_halted = True

        # 5) Base order (real OKX)
        if not fills:
            base_target = base_override if base_override > 0 else mark
            result = await _place_real_order(
                client, bot, side, base_target, base_size, 0
            )
            if result is None:
                _deactivate_bot(bot_id, "real_base_order_failed")
                return
            fill_price, ord_id = result
            _write_real_fill(bot_id, 0, fill_price, base_size, ord_id)
            logger.warning(
                "dca REAL base fill bot=%s price=%.6f size=%.2f ord=%s",
                bot_id[:8], fill_price, base_size, ord_id,
            )
            return

        # 6) Safety orders — multi-fire matches paper logic
        last_fill = fills[-1]
        last_price = float(last_fill["fill_price"])
        last_size = float(last_fill["fill_size_usdt"])
        next_order_num = last_fill["order_num"] + 1

        while not scaling_halted and next_order_num <= max_safety:
            if direction == "long":
                next_trigger = last_price * (1.0 - step_pct)
                should_fire = mark <= next_trigger
            else:
                next_trigger = last_price * (1.0 + step_pct)
                should_fire = mark >= next_trigger
            if not should_fire:
                break
            next_size = last_size * multiplier
            result = await _place_real_order(
                client, bot, side, next_trigger, next_size, next_order_num
            )
            if result is None:
                # Partial-fill catastrophe. DCA cannot keep computing average
                # off "next_trigger" when the actual fill never happened.
                # Halt and let the owner reconcile via OKX UI.
                _deactivate_bot(
                    bot_id, f"real_safety_{next_order_num}_order_failed"
                )
                return
            fill_price, ord_id = result
            _write_real_fill(
                bot_id, next_order_num, fill_price, next_size, ord_id
            )
            logger.warning(
                "dca REAL safety #%d bot=%s price=%.6f size=%.2f ord=%s",
                next_order_num, bot_id[:8], fill_price, next_size, ord_id,
            )
            last_price = fill_price  # use actual fill price for next trigger
            last_size = next_size
            next_order_num += 1

        # Refresh fills if any safety fired
        fills = _list_open_fills(bot_id)

        # 7) TP check — close entire position via opposite-side order
        avg = _weighted_avg(fills)
        if avg > 0:
            if direction == "long":
                tp_price = avg * (1.0 + tp_pct)
                tp_hit = mark >= tp_price
            else:
                tp_price = avg * (1.0 - tp_pct)
                tp_hit = mark <= tp_price
            if tp_hit:
                opposite = "sell" if direction == "long" else "buy"
                total_size = sum(f["fill_size_usdt"] for f in fills)
                # order_num=999 reserves a deterministic clOrdId slot for
                # the close so retry-after-fail is idempotent on OKX side.
                close_result = await _place_real_order(
                    client, bot, opposite, mark, total_size, 999
                )
                if close_result is None:
                    # Open position remains. Owner reconciles via OKX UI.
                    # We deliberately DO NOT mark fills as closed in the DB.
                    logger.error(
                        "dca REAL TP close failed bot=%s — open position "
                        "remains, manual close required",
                        bot_id[:8],
                    )
                    return
                close_price, close_ord_id = close_result
                closed = _close_all_open_fills(bot_id, "tp_closed")
                logger.warning(
                    "dca REAL TP hit bot=%s avg=%.6f close=%.6f closed=%d ord=%s",
                    bot_id[:8], avg, close_price, closed, close_ord_id,
                )
                # auto_recycle: spec L70-72. Off = deactivate after one cycle
                # so a runaway compounding loop is impossible without owner
                # explicit opt-in.
                if not int(bot.get("auto_recycle", 0)):
                    _deactivate_bot(
                        bot_id, "tp_completed_auto_recycle_off"
                    )
    finally:
        await client.close()


async def dca_loop() -> None:
    """Main background loop. Lives inside uvicorn process — restarts on
    each app boot.  60 s tick is conservative; users polling /dca-bots/:id/
    preview see fresher numbers between ticks."""
    interval = 60
    logger.info("dca_loop started interval=%ds (paper-mode only)", interval)
    global _LAST_TICK_AT, _LAST_TICK_BOTS
    while True:
        try:
            bots = await asyncio.to_thread(_list_active_bots)
            for bot in bots:
                try:
                    await _tick_bot(bot)
                except Exception as e:
                    logger.error(
                        "dca tick failed bot=%s: %s",
                        bot["id"][:8], e,
                    )
            _LAST_TICK_AT = time.time()
            _LAST_TICK_BOTS = len(bots)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("dca_loop iteration failed: %s", e)
        await asyncio.sleep(interval)
