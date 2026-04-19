"""
OKX public market data fetcher — PRUVIQ signal scanner data source.

Unauthenticated calls to /api/v5/market/candles. Async, with a shared
token-bucket so concurrent scanners collectively respect OKX's 20 req/2s
rate budget on this endpoint.

Designed to replace the Binance-via-Mac fetch path (Phase B'). Not yet
wired into signal_scanner — that's Phase C. Tested in isolation first.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Iterable

import httpx
import pandas as pd

OKX_PUBLIC_BASE = "https://www.okx.com"
CANDLES_PATH = "/api/v5/market/candles"
HISTORY_CANDLES_PATH = "/api/v5/market/history-candles"

# OKX publishes 20 req/2s on both /market/candles AND /market/history-candles,
# but empirically (2026-04-17 burn-in) the IP-level budget behaves as though
# it is shared across these endpoints — running near 20/2s on one still
# triggers 429 on the other. Cap at 12/2s so combined traffic stays inside.
_DEFAULT_RATE_LIMIT = 12
_DEFAULT_WINDOW_SEC = 2.0

# When a 429 does slip through, back off exponentially. OKX rarely sends a
# Retry-After header on these endpoints, so seed at one rate-window.
_RETRY_BACKOFF_BASE_SEC = 2.0
_RETRY_MAX_ATTEMPTS = 4

logger = logging.getLogger("pruviq")


@dataclass(frozen=True)
class OkxCandle:
    ts_ms: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    volume_ccy: float  # quote-currency volume (USDT for USDT-SWAP)
    is_confirmed: bool  # OKX `confirm` == "1" → closed candle. False = still forming.

    @classmethod
    def from_row(cls, row: list) -> "OkxCandle":
        # OKX row: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
        # vol     = base currency volume (BTC for BTC-USDT-SWAP)
        # volCcy  = contract count
        # volCcyQuote = quote currency volume (USDT)
        # confirm = "1" when the candle has closed (confirmed, immutable),
        #           "0" when still forming. /market/candles returns the
        #           forming candle as the first row in its newest-first
        #           response — callers doing signal detection on the
        #           final row would otherwise eat an unfinished bar.
        confirm_str = str(row[8]) if len(row) > 8 else "1"
        return cls(
            ts_ms=int(row[0]),
            open=float(row[1]),
            high=float(row[2]),
            low=float(row[3]),
            close=float(row[4]),
            volume=float(row[5]),
            volume_ccy=float(row[7]) if len(row) > 7 else float(row[6]),
            is_confirmed=(confirm_str == "1"),
        )


class OkxMarketFetcher:
    """Public OKX candle fetcher with shared rate-limit.

    A single instance is meant to be shared across all concurrent callers so
    the rate-limit accounting is correct. Safe to use from asyncio.gather.
    """

    def __init__(
        self,
        rate_limit: int = _DEFAULT_RATE_LIMIT,
        window_sec: float = _DEFAULT_WINDOW_SEC,
        timeout: float = 15.0,
    ):
        self._rate_limit = rate_limit
        self._window_sec = window_sec
        self._window_start = 0.0
        self._window_count = 0
        self._lock = asyncio.Lock()
        self._client = httpx.AsyncClient(
            base_url=OKX_PUBLIC_BASE,
            timeout=timeout,
            headers={"User-Agent": "pruviq-market/1"},
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "OkxMarketFetcher":
        return self

    async def __aexit__(self, *args) -> None:
        await self.close()

    async def _throttle(self) -> None:
        """Fixed-window rate limiter. Blocks until this call fits within budget."""
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._window_start
            if elapsed > self._window_sec:
                self._window_start = now
                self._window_count = 0
            if self._window_count >= self._rate_limit:
                sleep_for = self._window_sec - (now - self._window_start)
                if sleep_for > 0:
                    await asyncio.sleep(sleep_for)
                self._window_start = time.monotonic()
                self._window_count = 0
            self._window_count += 1

    # ── symbol / interval mapping ─────────────────────────────────────
    @staticmethod
    def to_okx_inst_id(binance_symbol: str) -> str:
        """Binance-style BTCUSDT → OKX BTC-USDT-SWAP.

        Raises ValueError for symbols not settled in USDT.
        """
        sym = binance_symbol.upper().strip()
        if not sym.endswith("USDT"):
            raise ValueError(f"unsupported symbol (not USDT-quoted): {binance_symbol}")
        base = sym[:-4]
        if not base:
            raise ValueError(f"empty base for symbol: {binance_symbol}")
        return f"{base}-USDT-SWAP"

    @staticmethod
    def to_okx_bar(interval: str) -> str:
        """Binance interval → OKX bar.

        OKX uses uppercase suffix for >= 1h intervals: 1H, 4H, 1D.
        """
        m = {
            "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
            "1h": "1H", "2h": "2H", "4h": "4H", "6h": "6H", "12h": "12H",
            "1d": "1D", "1w": "1W",
        }
        iv = interval.lower().strip()
        if iv not in m:
            raise ValueError(f"unsupported interval: {interval}")
        return m[iv]

    async def _get_with_backoff(self, path: str, params: dict) -> dict:
        """GET with 429 exponential backoff. Raises the last exception on exhaustion."""
        last_exc: Exception | None = None
        for attempt in range(_RETRY_MAX_ATTEMPTS):
            await self._throttle()
            try:
                resp = await self._client.get(path, params=params)
            except httpx.RequestError as e:
                last_exc = e
                await asyncio.sleep(_RETRY_BACKOFF_BASE_SEC * (2 ** attempt))
                continue
            if resp.status_code == 429:
                last_exc = httpx.HTTPStatusError("429 Too Many Requests", request=resp.request, response=resp)
                wait = _RETRY_BACKOFF_BASE_SEC * (2 ** attempt)
                logger.warning("OKX 429 on %s — backing off %.1fs (attempt %d/%d)",
                               path, wait, attempt + 1, _RETRY_MAX_ATTEMPTS)
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        assert last_exc is not None
        raise last_exc

    # ── fetch ─────────────────────────────────────────────────────────
    async def fetch_candles(
        self,
        symbol: str,
        interval: str = "1h",
        limit: int = 300,
        include_unconfirmed: bool = True,
    ) -> list[OkxCandle]:
        """Fetch recent candles. Returned old→new (sorted).

        OKX /market/candles gives newest-first; we reverse before returning so
        strategy code can iterate chronologically.

        `include_unconfirmed=True` (default) keeps the still-forming last
        bar. Signal-detection code must either skip it (e.g. `idx = len(df)
        - 2`) or pass `include_unconfirmed=False` so only closed candles
        come back. Default stays True because we don't want to silently
        drop the most-recent data for callers that handle it correctly.
        """
        inst_id = self.to_okx_inst_id(symbol)
        bar = self.to_okx_bar(interval)
        data = await self._get_with_backoff(
            CANDLES_PATH,
            {"instId": inst_id, "bar": bar, "limit": str(limit)},
        )
        if data.get("code") != "0":
            raise RuntimeError(
                f"OKX market error {data.get('code')}: {data.get('msg')} (instId={inst_id})"
            )
        rows = data.get("data") or []
        candles = [OkxCandle.from_row(r) for r in rows]
        if not include_unconfirmed:
            candles = [c for c in candles if c.is_confirmed]
        candles.reverse()
        return candles

    async def fetch_df(
        self,
        symbol: str,
        interval: str = "1h",
        limit: int = 300,
        include_unconfirmed: bool = True,
    ) -> pd.DataFrame:
        """Return a DataFrame matching the Binance CSV schema used by
        DataManager/signal_scanner:
          columns: timestamp (UTC tz-aware), open, high, low, close, volume

        See `fetch_candles` for the `include_unconfirmed` semantics.
        """
        candles = await self.fetch_candles(
            symbol, interval, limit, include_unconfirmed=include_unconfirmed
        )
        if not candles:
            return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])
        return pd.DataFrame(
            {
                "timestamp": pd.to_datetime([c.ts_ms for c in candles], unit="ms", utc=True),
                "open": [c.open for c in candles],
                "high": [c.high for c in candles],
                "low": [c.low for c in candles],
                "close": [c.close for c in candles],
                "volume": [c.volume for c in candles],
            }
        )

    async def fetch_history_page(
        self,
        symbol: str,
        interval: str = "1h",
        after_ms: str | None = None,
        limit: int = 100,
    ) -> list[OkxCandle]:
        """Fetch one page from /history-candles (older data, paged by `after` cursor).

        Returns the page old→new. An empty list means no more history.
        """
        inst_id = self.to_okx_inst_id(symbol)
        bar = self.to_okx_bar(interval)
        params: dict[str, str] = {"instId": inst_id, "bar": bar, "limit": str(limit)}
        if after_ms:
            params["after"] = after_ms
        data = await self._get_with_backoff(HISTORY_CANDLES_PATH, params)
        if data.get("code") != "0":
            raise RuntimeError(
                f"OKX history error {data.get('code')}: {data.get('msg')} (instId={inst_id})"
            )
        rows = data.get("data") or []
        candles = [OkxCandle.from_row(r) for r in rows]
        candles.reverse()
        return candles

    async def fetch_many(
        self,
        symbols: Iterable[str],
        interval: str = "1h",
        limit: int = 300,
    ) -> dict[str, pd.DataFrame]:
        """Concurrent fetch across symbols. Failed symbols are logged and
        dropped from the result (caller sees only successes)."""
        async def _one(s: str) -> tuple[str, pd.DataFrame | None]:
            try:
                return s, await self.fetch_df(s, interval, limit)
            except Exception as e:
                logger.warning("OKX fetch failed for %s: %s: %s", s, type(e).__name__, e)
                return s, None

        tasks = [_one(s) for s in symbols]
        results = await asyncio.gather(*tasks)
        return {s: df for s, df in results if df is not None}
