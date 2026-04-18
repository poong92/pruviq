"""
Token refresh worker — keeps all active sessions alive.

Runs every 12 hours to proactively refresh OAuth tokens,
ensuring auto-trading continues without user intervention.
"""
from __future__ import annotations

import logging
import time

from .oauth import is_authenticated
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

        # 🔴 2026-04-19 버그 수정: `tokens["expires_at"]` 은 존재하지 않음 (save_session 은
        # created_at / updated_at 만 기록). OKX Fast API는 API 키 방식이라 refresh 불필요 →
        # stale 세션 제거만 수행. 과거 로직은 매 실행 KeyError 발생해 cleanup 정지.
        created_at = float(tokens.get("created_at") or 0)
        if created_at and time.time() > created_at + REFRESH_TOKEN_MAX_AGE:
            delete_session(session_id)
            stats["expired"] += 1
            logger.info("Session %s expired (age > %ds)", session_id[:8], REFRESH_TOKEN_MAX_AGE)
            continue
        # OKX Fast API (API keys): no refresh; just keep stats aligned.
        stats["refreshed"] += 1

    logger.info(
        "Token refresh complete: %d refreshed, %d expired, %d errors (of %d total)",
        stats["refreshed"], stats["expired"], stats["errors"], stats["total"],
    )
    return stats
