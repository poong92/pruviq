"""
PRUVIQ OKX — Optional regime/time/funding filters for user strategies.

Ported research from autotrader (R6 FnG, R15 time, R4 funding) but the
application layer is different: autotrader ran one bot with one strategy, so
filters were hardcoded globals. PRUVIQ has per-user sessions each with their
own strategy — filters are *opt-in per strategy*, stored in `strategies.regime_filters`.

Every filter returns either `None` (signal allowed) or a short human string
naming the reason. The caller logs the reason; we don't alert the user for
every skipped signal (would be noisy on low-FnG weeks).

Cache policy:
- FnG: 1h TTL (alternative.me updates once daily)
- Funding: 5min TTL (OKX publishes every 8h but we want fast response to
  inversion)
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from .retry import retry_async

logger = logging.getLogger("okx_filters")

# ── FnG cache ───────────────────────────────────────────────

_FNG_CACHE: dict[str, Any] = {"ts": 0.0, "value": None}
_FNG_TTL = 3600.0  # 1 hour
_FNG_URL = "https://api.alternative.me/fng/?limit=1"


@retry_async(max_attempts=2, base_delay=0.5, retry_on=(httpx.HTTPError,), op_name="fng_fetch")
async def _fetch_fng_raw() -> Optional[int]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(_FNG_URL)
        resp.raise_for_status()
        data = resp.json()
    rows = data.get("data") or []
    if not rows:
        return None
    try:
        return int(rows[0]["value"])
    except (KeyError, ValueError, TypeError):
        return None


async def get_fng_value() -> Optional[int]:
    """Fetch current Fear & Greed index (0-100). None on persistent failure.
    Cached for 1h. Filter layer interprets None as 'filter disabled' — better
    than blocking all trades when alternative.me is down (lesson from autotrader:
    L7 treating the filter as advisory rather than gating)."""
    now = time.time()
    if _FNG_CACHE["value"] is not None and (now - _FNG_CACHE["ts"]) < _FNG_TTL:
        return _FNG_CACHE["value"]
    try:
        v = await _fetch_fng_raw()
    except Exception as e:
        logger.warning("FnG fetch gave up: %s — using cached=%s", e, _FNG_CACHE["value"])
        return _FNG_CACHE["value"]
    if v is not None:
        _FNG_CACHE["value"] = v
        _FNG_CACHE["ts"] = now
    return v


# ── Funding rate cache ──────────────────────────────────────

_FUNDING_CACHE: dict[str, tuple[float, Optional[float]]] = {}  # inst_id → (ts, rate)
_FUNDING_TTL = 300.0  # 5 min


@retry_async(max_attempts=2, base_delay=0.5, retry_on=(httpx.HTTPError,), op_name="funding_fetch")
async def _fetch_funding_raw(inst_id: str) -> Optional[float]:
    url = f"https://www.okx.com/api/v5/public/funding-rate?instId={inst_id}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    rows = data.get("data") or []
    if not rows:
        return None
    try:
        return float(rows[0]["fundingRate"])
    except (KeyError, ValueError, TypeError):
        return None


async def get_funding_rate(inst_id: str) -> Optional[float]:
    """Current funding rate for an OKX SWAP inst_id. None on failure."""
    now = time.time()
    cached = _FUNDING_CACHE.get(inst_id)
    if cached and (now - cached[0]) < _FUNDING_TTL and cached[1] is not None:
        return cached[1]
    try:
        v = await _fetch_funding_raw(inst_id)
    except Exception as e:
        logger.warning("funding fetch gave up for %s: %s", inst_id, e)
        return cached[1] if cached else None
    _FUNDING_CACHE[inst_id] = (now, v)
    return v


# ── Filter spec + evaluator ─────────────────────────────────

@dataclass
class RegimeFilters:
    """Per-strategy filter bundle. None/empty values = disabled.

    Stored as JSON in strategies.regime_filters column.
    """
    fng_min: Optional[int] = None            # reject signal if FnG < fng_min
    avoid_weekdays_utc: Optional[list[int]] = None   # 0=Mon..6=Sun UTC
    avoid_hours_utc: Optional[list[int]] = None      # 0..23 UTC
    require_positive_funding_for_short: bool = False  # SHORT only when FR > 0

    @classmethod
    def from_json(cls, raw: Any) -> "RegimeFilters":
        if not isinstance(raw, dict):
            return cls()
        return cls(
            fng_min=_coerce_int(raw.get("fng_min")),
            avoid_weekdays_utc=_coerce_int_list(raw.get("avoid_weekdays_utc"), lo=0, hi=6),
            avoid_hours_utc=_coerce_int_list(raw.get("avoid_hours_utc"), lo=0, hi=23),
            require_positive_funding_for_short=bool(raw.get("require_positive_funding_for_short", False)),
        )

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        if self.fng_min is not None:
            out["fng_min"] = self.fng_min
        if self.avoid_weekdays_utc:
            out["avoid_weekdays_utc"] = self.avoid_weekdays_utc
        if self.avoid_hours_utc:
            out["avoid_hours_utc"] = self.avoid_hours_utc
        if self.require_positive_funding_for_short:
            out["require_positive_funding_for_short"] = True
        return out

    def is_empty(self) -> bool:
        return (
            self.fng_min is None
            and not self.avoid_weekdays_utc
            and not self.avoid_hours_utc
            and not self.require_positive_funding_for_short
        )


def _coerce_int(v: Any) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _coerce_int_list(v: Any, *, lo: int, hi: int) -> Optional[list[int]]:
    if not v:
        return None
    if not isinstance(v, (list, tuple)):
        return None
    out: list[int] = []
    for x in v:
        try:
            i = int(x)
            if lo <= i <= hi:
                out.append(i)
        except (TypeError, ValueError):
            continue
    return sorted(set(out)) or None


async def evaluate_filters(
    rf: RegimeFilters,
    *,
    direction: str,
    inst_id: str,
    now_utc: Optional[datetime] = None,
) -> Optional[str]:
    """Return `None` if signal passes every enabled filter, else a short
    rejection reason (stable enough to log/aggregate).

    autotrader's design decision: advisory on fetch-failure. If FnG API is
    down we *don't* block trading — we trade without that filter and log.
    Otherwise a single outage paralyzes every PRUVIQ user.
    """
    if rf.is_empty():
        return None

    now = now_utc or datetime.now(timezone.utc)

    # Time filter (synchronous, no I/O)
    if rf.avoid_weekdays_utc and now.weekday() in rf.avoid_weekdays_utc:
        return f"avoid_weekday_utc={now.weekday()}"
    if rf.avoid_hours_utc and now.hour in rf.avoid_hours_utc:
        return f"avoid_hour_utc={now.hour}"

    # FnG filter (I/O, advisory)
    if rf.fng_min is not None:
        fng = await get_fng_value()
        if fng is not None and fng < rf.fng_min:
            return f"fng={fng}<{rf.fng_min}"

    # Funding rate filter — SHORT only
    if rf.require_positive_funding_for_short and direction == "short":
        fr = await get_funding_rate(inst_id)
        if fr is not None and fr <= 0:
            return f"funding={fr:.5f}<=0"

    return None
