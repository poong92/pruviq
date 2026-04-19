#!/usr/bin/env python3
"""
Re-encrypt every row in the OKX sessions DB under the newest Fernet key.

Usage on DO:
    # 1. Operator generates a new key and updates `.env`:
    #    OKX_ENCRYPTION_KEYS=new_key,old_key    (newest first)
    # 2. Restart API (new writes now under new_key, reads tolerant of either)
    #    systemctl restart pruviq-api
    # 3. Run this script to re-encrypt existing rows:
    #    sudo -u pruviq /opt/pruviq/app/.venv/bin/python \
    #         /opt/pruviq/current/backend/scripts/migrate_okx_encryption_keys.py
    # 4. After success, operator drops old_key from `.env`:
    #    OKX_ENCRYPTION_KEYS=new_key
    # 5. Restart API to remove in-memory copy of old_key.

Safety:
    - Idempotent. MultiFernet.rotate() re-encrypts with the newest key;
      running twice is a no-op after the first success.
    - Per-row commit. If a single row is corrupt (key neither old nor new
      can decrypt), it is logged and skipped — other rows still migrate.
    - Dry-run by default. Pass `--apply` to actually write.
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

# Allow running directly: add backend/ to sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cryptography.fernet import InvalidToken  # noqa: E402

from okx.storage import _fernet, _get_conn  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger("migrate_keys")


def rotate_rows(apply_changes: bool) -> dict:
    """Iterate all `okx_sessions` rows; rotate user_data under newest key."""
    if _fernet is None:
        raise SystemExit(
            "OKX encryption not configured. Set OKX_ENCRYPTION_KEYS= in env."
        )

    # MultiFernet.rotate() is the canonical way; single Fernet has no rotate.
    if not hasattr(_fernet, "rotate"):
        logger.warning(
            "Encryption is a single Fernet (no rotation keys). "
            "Set OKX_ENCRYPTION_KEYS=new,old to enable rotation, then re-run."
        )
        return {"total": 0, "rotated": 0, "skipped": 0, "failed": 0}

    total = rotated = skipped = failed = 0
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT session_id, user_data FROM okx_sessions"
        ).fetchall()
    total = len(rows)
    logger.info("Found %d rows to examine", total)

    for session_id, token in rows:
        try:
            new_token = _fernet.rotate(token.encode()).decode()
        except InvalidToken:
            logger.error(
                "session %s: InvalidToken — skipping (neither key decrypts)",
                str(session_id)[:8],
            )
            failed += 1
            continue
        except Exception as e:
            logger.error(
                "session %s: rotate failed (%s) — skipping",
                str(session_id)[:8], e,
            )
            failed += 1
            continue
        if new_token == token:
            skipped += 1
            continue
        if apply_changes:
            try:
                with _get_conn() as conn:
                    conn.execute(
                        "UPDATE okx_sessions SET user_data = ?, updated_at = ? "
                        "WHERE session_id = ?",
                        (new_token, time.time(), session_id),
                    )
            except Exception as e:
                logger.error(
                    "session %s: DB write failed (%s)",
                    str(session_id)[:8], e,
                )
                failed += 1
                continue
        rotated += 1

    logger.info(
        "Summary: total=%d rotated=%d skipped=%d failed=%d apply=%s",
        total, rotated, skipped, failed, apply_changes,
    )
    return {
        "total": total,
        "rotated": rotated,
        "skipped": skipped,
        "failed": failed,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write rotated rows. Without this, script runs dry.",
    )
    args = parser.parse_args()
    stats = rotate_rows(apply_changes=args.apply)
    if stats["failed"] > 0:
        # Surface to caller so wrapping cron can alert.
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
