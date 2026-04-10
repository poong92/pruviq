"""
Token refresh worker — keeps all active sessions alive.

Runs every 12 hours to proactively refresh OAuth tokens,
ensuring auto-trading continues without user intervention.
"""
from __future__ import annotations

import logging
import time

from .oauth import is_authenticated, refresh_access_token
from .storage import _get_conn, delete_session, get_session

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

        # Check if refresh token is too old
        if time.time() > tokens["expires_at"] + REFRESH_TOKEN_MAX_AGE:
            delete_session(session_id)
            stats["expired"] += 1
            logger.info("Session %s expired (refresh token too old)", session_id[:8])
            continue

        # Proactively refresh if access token expires within window
        if time.time() > tokens["expires_at"] - REFRESH_WINDOW:
            try:
                await refresh_access_token(session_id)
                stats["refreshed"] += 1
            except Exception as e:
                logger.error("Failed to refresh session %s: %s", session_id[:8], e)
                stats["errors"] += 1

    logger.info(
        "Token refresh complete: %d refreshed, %d expired, %d errors (of %d total)",
        stats["refreshed"], stats["expired"], stats["errors"], stats["total"],
    )
    return stats
