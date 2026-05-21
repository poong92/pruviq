"""
P0/P1 safety tests for DCA real-mode critical paths.

Covers three areas identified by code-review 2026-05-20:
  1. _calc_size_contracts — pure function, no mocks needed.
     Real incident 2026-05-19: sz=1 contract ($213) when intent was $22.
  2. token_refresh.refresh_all_sessions — session preserved (no cascade delete).
     Real incident 2026-05-20: 3d auto-expiry wiped live bot + fills.
  3. _circuit_breaker_check — halts bot after >5 fills/hour.
"""
import time
import types
import unittest.mock as mock

import pytest

# ---------------------------------------------------------------------------
# 1. _calc_size_contracts
# ---------------------------------------------------------------------------
from backend.okx.dca_loop import _calc_size_contracts


class TestCalcSizeContracts:
    def test_normal_eth_swap(self):
        # ETH-USDT-SWAP: ctVal=0.01 ETH, price=2100, want $22 → 1.047… → floor to 1.04
        result = _calc_size_contracts(22.0, 2100.0, 0.01)
        assert result == "1.04"

    def test_exact_min_sz(self):
        # size_usdt exactly covers min_sz=0.01 contracts
        # 0.01 contracts × 0.01 ctVal × 2100 = 0.21 USDT
        result = _calc_size_contracts(0.21, 2100.0, 0.01, min_sz=0.01)
        assert result == "0.01"

    def test_below_min_sz_raises(self):
        # $0.10 → 0.0047 contracts < min_sz=0.01 → should raise
        with pytest.raises(ValueError, match="size too small"):
            _calc_size_contracts(0.10, 2100.0, 0.01, min_sz=0.01)

    def test_zero_price_raises(self):
        with pytest.raises(ValueError):
            _calc_size_contracts(22.0, 0.0, 0.01)

    def test_zero_ctval_raises(self):
        with pytest.raises(ValueError):
            _calc_size_contracts(22.0, 2100.0, 0.0)

    def test_zero_size_usdt_raises(self):
        with pytest.raises(ValueError):
            _calc_size_contracts(0.0, 2100.0, 0.01)

    def test_floor_not_round_up(self):
        # 50 USDT / (0.01 × 2100) = 2.38095… → floor to 2.38, NOT 2.39
        result = _calc_size_contracts(50.0, 2100.0, 0.01)
        assert float(result) <= 50.0 / (0.01 * 2100.0)

    def test_after_lot_quantize_still_below_min_raises(self):
        # contracts=0.4762 passes min_sz=0.01 but lot_sz=0.5 floors to 0.0
        # → quantized=0.0 < min_sz=0.01 → second ValueError
        with pytest.raises(ValueError, match="lot-quantize too small"):
            _calc_size_contracts(10.0, 2100.0, 0.01, min_sz=0.01, lot_sz=0.5)


# ---------------------------------------------------------------------------
# 2. token_refresh — no cascade delete on stale session
# ---------------------------------------------------------------------------
from backend.okx.token_refresh import refresh_all_sessions, REFRESH_TOKEN_MAX_AGE


class TestTokenRefreshNoCascade:
    """Verify the 2026-05-20 cascade-delete fix: stale sessions are kept."""

    def _make_storage_mock(self, sessions: list[dict]):
        """Return patched storage so refresh_all_sessions uses our sessions."""
        conn_mock = mock.MagicMock()
        conn_mock.execute.return_value.fetchall.return_value = [
            (s["session_id"],) for s in sessions
        ]
        ctx_mock = mock.MagicMock()
        ctx_mock.__enter__ = mock.Mock(return_value=conn_mock)
        ctx_mock.__exit__ = mock.Mock(return_value=False)

        def get_session_side(sid):
            for s in sessions:
                if s["session_id"] == sid:
                    return s
            return None

        return ctx_mock, get_session_side

    @pytest.mark.anyio
    async def test_stale_session_not_deleted(self):
        old_ts = time.time() - REFRESH_TOKEN_MAX_AGE - 1
        sessions = [{"session_id": "abc123", "created_at": str(old_ts)}]
        ctx, gs = self._make_storage_mock(sessions)

        with (
            mock.patch("backend.okx.token_refresh._get_conn", return_value=ctx),
            mock.patch("backend.okx.token_refresh.get_session", side_effect=gs),
            mock.patch("backend.okx.token_refresh.logger") as log_mock,
        ):
            # If delete_session were called here the test would fail
            # (we don't patch it, so it would raise ImportError or hit real DB).
            # The fix is that it's NOT called at all.
            stats = await refresh_all_sessions()

        assert stats["expired"] == 0, "stale session must not be marked expired"
        assert stats["refreshed"] == 1
        # Should log a WARNING about staleness (observability)
        assert log_mock.warning.called

    @pytest.mark.anyio
    async def test_missing_session_counted_expired(self):
        sessions = [{"session_id": "dead0000", "created_at": None}]
        ctx, _ = self._make_storage_mock(sessions)

        with (
            mock.patch("backend.okx.token_refresh._get_conn", return_value=ctx),
            mock.patch("backend.okx.token_refresh.get_session", return_value=None),
        ):
            stats = await refresh_all_sessions()

        assert stats["expired"] == 1
        assert stats["refreshed"] == 0


# ---------------------------------------------------------------------------
# 3. _circuit_breaker_check
# ---------------------------------------------------------------------------
from backend.okx.dca_loop import _circuit_breaker_check, _CIRCUIT_MAX_FILLS


class TestCircuitBreakerCheck:
    def _patch_conn(self, fill_count: int):
        conn_mock = mock.MagicMock()
        conn_mock.execute.return_value.fetchone.return_value = (fill_count,)
        ctx_mock = mock.MagicMock()
        ctx_mock.__enter__ = mock.Mock(return_value=conn_mock)
        ctx_mock.__exit__ = mock.Mock(return_value=False)
        return mock.patch("backend.okx.dca_loop._get_conn", return_value=ctx_mock)

    def test_under_limit_not_tripped(self):
        with self._patch_conn(_CIRCUIT_MAX_FILLS):
            tripped, count = _circuit_breaker_check("bot-1")
        assert not tripped
        assert count == _CIRCUIT_MAX_FILLS

    def test_over_limit_tripped(self):
        with self._patch_conn(_CIRCUIT_MAX_FILLS + 1):
            tripped, count = _circuit_breaker_check("bot-1")
        assert tripped
        assert count == _CIRCUIT_MAX_FILLS + 1

    def test_zero_fills_not_tripped(self):
        with self._patch_conn(0):
            tripped, count = _circuit_breaker_check("bot-1")
        assert not tripped
        assert count == 0

    def test_db_returns_none_not_tripped(self):
        conn_mock = mock.MagicMock()
        conn_mock.execute.return_value.fetchone.return_value = None
        ctx_mock = mock.MagicMock()
        ctx_mock.__enter__ = mock.Mock(return_value=conn_mock)
        ctx_mock.__exit__ = mock.Mock(return_value=False)
        with mock.patch("backend.okx.dca_loop._get_conn", return_value=ctx_mock):
            tripped, count = _circuit_breaker_check("bot-1")
        assert not tripped
        assert count == 0
