"""
signal_scanner._get_top_coins market-cap ordering regression (PR 2026-04-19).

Data-pipeline audit CRITICAL: `_get_top_coins` used `list(self.dm._data.keys())`,
which is file-size desc (data_manager.py:52 sorts CSVs by `st_size`). Also, the
`priority` list was lowercase while `_data` keys are uppercase, so priority
matching silently failed — BTCUSDT was not actually first.

Impact: `/signals/live` + auto-trading loop scanned the wrong 30 coins ever
since the Binance→OKX migration.

Fix: use `self.dm.coins` (market-cap sorted by `sort_by_market_cap`), priority
list uppercased.
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))


def _make_scanner(symbols_in_mkt_cap_order: list[str], top_n: int = 30):
    """Build a SignalScanner with a stubbed DataManager whose `coins`
    property returns symbols in market-cap desc order (as if
    `sort_by_market_cap` already ran)."""
    from api.signal_scanner import SignalScanner

    dm = MagicMock()
    # `coins` is the public property; list of dicts with "symbol" key.
    dm.coins = [{"symbol": s, "rows": 9999} for s in symbols_in_mkt_cap_order]
    # `_data` keys in FILE-SIZE order — different from market cap.
    # This is deliberately scrambled to catch the old bug.
    dm._data = {s: object() for s in reversed(symbols_in_mkt_cap_order)}
    return SignalScanner(dm, top_n=top_n)


def test_top_coins_order_follows_market_cap_not_file_size():
    """Market-cap rank wins: `coins` order is the source of truth."""
    # Market cap order: BTC, ETH, MATIC, DOGE
    # File-size order (old bug path): DOGE, MATIC, ETH, BTC
    mkt_cap = ["BTCUSDT", "ETHUSDT", "MATICUSDT", "DOGEUSDT"]
    scanner = _make_scanner(mkt_cap, top_n=4)
    result = scanner._get_top_coins()
    assert result[0] == "BTCUSDT", (
        f"BTC must be first (market-cap rank 1), got {result!r}. "
        "Regression: scanner reverted to _data.keys() file-size ordering."
    )
    assert result[1] == "ETHUSDT"
    assert result == mkt_cap[:4]


def test_priority_coins_surface_even_if_mkt_cap_rank_late():
    """The `priority` hardcode (BTC/ETH/BNB/…) pushes these to the front
    even if market-cap ranking places them lower temporarily. Upper-cased
    now so it actually matches `coins` keys."""
    # Suppose some novel coin tops market cap; BTC/ETH still need priority.
    mkt_cap = ["NEWUSDT", "OTHERUSDT", "BTCUSDT", "ETHUSDT", "ZZZUSDT"]
    scanner = _make_scanner(mkt_cap, top_n=5)
    result = scanner._get_top_coins()
    assert "BTCUSDT" in result[:2], (
        f"BTC must surface in top 2 via priority list, got {result!r}. "
        "Regression: priority list is lowercase again (mismatches uppercase coins)."
    )
    assert "ETHUSDT" in result[:2]


def test_top_n_limit_honored():
    """Result capped at top_n even if market cap list longer."""
    mkt_cap = [f"COIN{i:03d}USDT" for i in range(100)]
    scanner = _make_scanner(mkt_cap, top_n=10)
    result = scanner._get_top_coins()
    assert len(result) == 10


def test_top_n_limit_when_data_smaller_than_n():
    """Graceful: if only 5 coins loaded, top_n=30 returns 5."""
    mkt_cap = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"]
    scanner = _make_scanner(mkt_cap, top_n=30)
    result = scanner._get_top_coins()
    assert len(result) == 5


def test_priority_list_is_uppercase():
    """Regression guard: lowercase priority never matched uppercase _data
    keys, so priority was silently disabled for months."""
    import re
    src = (
        Path(__file__).resolve().parent.parent / "api" / "signal_scanner.py"
    ).read_text()
    # Find the priority list block
    m = re.search(
        r"priority\s*=\s*\[(.*?)\]",
        src,
        re.DOTALL,
    )
    assert m, "priority list not found in signal_scanner"
    block = m.group(1)
    # All elements must be uppercase (no 'btcusdt' lowercase)
    lowercase_matches = re.findall(r'"[a-z]+usdt"', block)
    assert not lowercase_matches, (
        f"priority list still has lowercase entries: {lowercase_matches!r} — "
        "these never match uppercase _data/coins keys."
    )


def test_does_not_use_data_keys_directly():
    """Source-level guard: `_get_top_coins` must NOT reference `_data.keys()`
    (file-size ordering). Must use `self.dm.coins` (market-cap sorted)."""
    import re
    src = (
        Path(__file__).resolve().parent.parent / "api" / "signal_scanner.py"
    ).read_text()
    # Locate method body + strip docstring (which deliberately references the
    # old `_data.keys()` bug for historical context).
    start = src.find("def _get_top_coins")
    assert start != -1, "_get_top_coins signature not found"
    tail = src[start:]
    end_rel = tail.find("\n    def ", 1)
    body = tail[:end_rel] if end_rel > 0 else tail
    # Strip triple-quoted docstring
    code_only = re.sub(r'"""[\s\S]*?"""', "", body)

    # In CODE (not docstring), `_data.keys()` must not appear
    assert "_data.keys()" not in code_only, (
        "_get_top_coins code still references _data.keys() — file-size "
        "ordering regression. Use self.dm.coins."
    )
    # And self.dm.coins MUST appear in code
    assert "self.dm.coins" in code_only, (
        "_get_top_coins must consult self.dm.coins (market-cap sorted)."
    )
