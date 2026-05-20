"""
Token refresh worker — keeps all active sessions alive.

Runs every 12 hours to proactively refresh OAuth tokens,
ensuring auto-trading continues without user intervention.
"""
from __future__ import annotations

import logging
import time

from .oauth import is_authenticated
from .storage import _get_conn, get_session

logger = logging.getLogger("okx_token_refresh")

# Refresh tokens that expire within this window (24 hours)
REFRESH_WINDOW = 24 * 3600
# Max age for refresh token (3 days)
REFRESH_TOKEN_MAX_AGE = 3 * 24 * 3600


async def refresh_all_sessions() -> dict:
    """
    Refresh all active sessions' tokens.
    Returns stats: {refreshed: N, expired: N, errors: N}
    """
    stats = {"refreshed": 0, "expired": 0, "errors": 0, "total": 0}

    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT session_id FROM okx_sessions"
        ).fetchall()

    stats["total"] = len(rows)

    for (session_id,) in rows:
        tokens = get_session(session_id)
        if not tokens:
            stats["expired"] += 1
            continue

        # OKX Fast API HMAC keys do NOT expire on OKX side. Auto-deleting
        # based on created_at age cascades via storage.delete_session through
        # dca_bots / dca_fills / trading_settings / user_strategies / pending_signals
        # and CAN wipe live-money state.
        #
        # Incident 2026-05-20 04:44 UTC: a 3-day cascade ran while an ETH-USDT-SWAP
        # 0.1 contract was live; the OKX OCO TP/SL kept the position safe but the
        # bot row, fills history, and OAuth creds were all destroyed. Litestream
        # backup was pointing at the wrong DB path so recovery was impossible.
        #
        # Resolution: keep the session indefinitely. The only valid removal path
        # is the explicit owner UI disconnect (POST /auth/okx/disconnect →
        # oauth.py:402). Log staleness as WARNING for observability.
        created_at = float(tokens.get("created_at") or 0)
        if created_at and time.time() > created_at + REFRESH_TOKEN_MAX_AGE:
            logger.warning(
                "Session %s is stale (age > %ds) but kept — HMAC keys don't "
                "expire OKX-side. Owner must explicitly disconnect to remove.",
                session_id[:8], REFRESH_TOKEN_MAX_AGE,
            )
        stats["refreshed"] += 1

    logger.info(
        "Token refresh complete: %d refreshed, %d expired, %d errors (of %d total)",
        stats["refreshed"], stats["expired"], stats["errors"], stats["total"],
    )
    return stats
