"""Unit tests for OKX public market data fetcher.

Network tests are marked and skipped by default; run with
`pytest -m okx_live backend/tests/test_okx_market_fetcher.py`
to hit OKX directly (useful locally + in DO burn-in).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import time

import pandas as pd
import pytest

from okx.market_fetcher import OkxCandle, OkxMarketFetcher


class TestSymbolMapping:
    def test_btc(self):
        assert OkxMarketFetcher.to_okx_inst_id("BTCUSDT") == "BTC-USDT-SWAP"

    def test_lowercase(self):
        assert OkxMarketFetcher.to_okx_inst_id("ethusdt") == "ETH-USDT-SWAP"

    def test_whitespace(self):
        assert OkxMarketFetcher.to_okx_inst_id("  BTCUSDT  ") == "BTC-USDT-SWAP"

    def test_rejects_non_usdt(self):
        with pytest.raises(ValueError, match="USDT-quoted"):
            OkxMarketFetcher.to_okx_inst_id("BTCBUSD")

    def test_rejects_empty_base(self):
        with pytest.raises(ValueError):
            OkxMarketFetcher.to_okx_inst_id("USDT")


class TestIntervalMapping:
    def test_1h(self):
        assert OkxMarketFetcher.to_okx_bar("1h") == "1H"

    def test_4h(self):
        assert OkxMarketFetcher.to_okx_bar("4H") == "4H"

    def test_1d(self):
        assert OkxMarketFetcher.to_okx_bar("1d") == "1D"

    def test_1m(self):
        assert OkxMarketFetcher.to_okx_bar("1m") == "1m"

    def test_rejects_2h_upper(self):
        # Confirm our table is authoritative: 2h exists, 2h-upper exists — both map
        assert OkxMarketFetcher.to_okx_bar("2h") == "2H"

    def test_rejects_unknown(self):
        with pytest.raises(ValueError):
            OkxMarketFetcher.to_okx_bar("10m")


class TestOkxCandleParse:
    def test_9col_row(self):
        # Newer OKX rows are 9 columns — confirm volume_ccy reads col-7 (volCcyQuote)
        row = ["1700000000000", "100.0", "105.0", "95.0", "102.0",
               "10.5", "11.0", "1071.0", "1"]
        c = OkxCandle.from_row(row)
        assert c.ts_ms == 1700000000000
        assert c.open == 100.0
        assert c.close == 102.0
        assert c.volume == 10.5
        assert c.volume_ccy == 1071.0  # from col-7 (volCcyQuote)
        assert c.is_confirmed is True

    def test_7col_fallback(self):
        # Legacy 7-column response — fall back to col-6, and default
        # is_confirmed=True since no confirm column is present.
        row = ["1700000000000", "100.0", "105.0", "95.0", "102.0",
               "10.5", "11.0"]
        c = OkxCandle.from_row(row)
        assert c.volume_ccy == 11.0
        assert c.is_confirmed is True, "missing confirm col should default to True"

    def test_unconfirmed_candle_flagged(self):
        # OKX /market/candles returns the still-forming candle as the
        # first row in its newest-first response, with confirm="0".
        # Callers doing signal detection on the last row would otherwise
        # eat an unfinished bar — is_confirmed must be False so they can
        # skip it.
        row = ["1700000000000", "100.0", "105.0", "95.0", "102.0",
               "10.5", "11.0", "1071.0", "0"]
        c = OkxCandle.from_row(row)
        assert c.is_confirmed is False

    def test_confirm_accepts_string_or_int(self):
        # OKX sometimes serializes `confirm` as the string "1"/"0",
        # sometimes as the raw int. Our parser coerces via str() so both
        # forms collapse to the same boolean.
        row_str = ["1700000000000", "1", "1", "1", "1", "1", "1", "1", "1"]
        row_int = ["1700000000000", "1", "1", "1", "1", "1", "1", "1", 1]
        assert OkxCandle.from_row(row_str).is_confirmed is True
        assert OkxCandle.from_row(row_int).is_confirmed is True


class TestFetchCandlesUnconfirmedFilter:
    def test_include_unconfirmed_false_drops_forming_bar(self, monkeypatch):
        """fetch_candles(include_unconfirmed=False) must strip the forming
        bar so callers that use `df[-1]` don't read an in-progress candle."""
        async def _run():
            fetcher = OkxMarketFetcher()
            try:
                async def fake_get(path, params):
                    return {
                        "code": "0",
                        "data": [
                            # OKX returns newest-first; [0] is the still-forming
                            # candle. Following rows are closed.
                            ["1700000000000", "100", "105", "95", "102",
                             "10", "11", "1020", "0"],
                            ["1699999964000", "99", "101", "97", "100",
                             "9",  "10", "900",  "1"],
                            ["1699999928000", "98", "100", "96", "99",
                             "8",  "9",  "800",  "1"],
                        ],
                    }

                monkeypatch.setattr(fetcher, "_get_with_backoff", fake_get)

                all_candles = await fetcher.fetch_candles(
                    "BTCUSDT", "1h", 3, include_unconfirmed=True
                )
                confirmed_only = await fetcher.fetch_candles(
                    "BTCUSDT", "1h", 3, include_unconfirmed=False
                )
                return all_candles, confirmed_only
            finally:
                await fetcher.close()

        all_candles, confirmed_only = asyncio.run(_run())

        assert len(all_candles) == 3
        assert len(confirmed_only) == 2, (
            "forming bar must be dropped when include_unconfirmed=False"
        )
        # Ordering guarantee preserved (old→new) in both cases.
        assert all_candles[-1].is_confirmed is False
        assert all(c.is_confirmed for c in confirmed_only)


class TestThrottle:
    def test_blocks_when_budget_exhausted(self):
        # 3 req/1.0s window → 4th call must sleep ~1s
        async def _run():
            async with OkxMarketFetcher(rate_limit=3, window_sec=1.0) as f:
                start = time.monotonic()
                await f._throttle()
                await f._throttle()
                await f._throttle()
                mid = time.monotonic()
                await f._throttle()  # this one sleeps
                end = time.monotonic()
            return start, mid, end

        start, mid, end = asyncio.run(_run())
        assert (mid - start) < 0.1, "first 3 should be immediate"
        assert (end - mid) >= 0.7, f"4th should have slept; actual={end - mid:.3f}s"


@pytest.mark.okx_live
class TestLiveOkx:
    """Hit OKX for real. Run with `pytest -m okx_live`."""

    def test_fetch_btc_shape(self):
        async def _run():
            async with OkxMarketFetcher() as f:
                return await f.fetch_df("BTCUSDT", interval="1h", limit=100)

        df = asyncio.run(_run())
        assert isinstance(df, pd.DataFrame)
        assert len(df) > 0
        for col in ["timestamp", "open", "high", "low", "close", "volume"]:
            assert col in df.columns, f"missing column {col}"
        # sorted old→new
        assert df["timestamp"].is_monotonic_increasing
        # sane BTC price range
        assert df["close"].min() > 10_000
        assert df["close"].max() < 1_000_000

    def test_fetch_many_three(self):
        async def _run():
            async with OkxMarketFetcher() as f:
                return await f.fetch_many(["BTCUSDT", "ETHUSDT", "SOLUSDT"], limit=50)

        out = asyncio.run(_run())
        assert set(out.keys()) == {"BTCUSDT", "ETHUSDT", "SOLUSDT"}
        for sym, df in out.items():
            assert len(df) > 0, f"empty df for {sym}"
