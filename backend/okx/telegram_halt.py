"""
Emergency halt via Telegram.

/halt command → disable every OKX trading session that has `enabled=True`
(covers both auto and alert execution modes). Designed to work even when the
main FastAPI process is under load: the poller lives in its own background
task, so the operator can stop auto-trading with a single Telegram message.

Kill-switch semantics:
  - `enabled=False` is written to every session's trading_settings row.
  - No new auto-orders will be placed (auto_executor checks `enabled`).
  - Open positions are NOT closed here — SL/TP algo orders already set on
    OKX remain active. Closing live positions is a separate operator action.

Security:
  - Only messages from TELEGRAM_CHAT_ID are accepted. Other chats are
    silently ignored.
  - getUpdates uses long-polling with an allowed_updates filter.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger("okx_telegram_halt")

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
HALT_POLL_INTERVAL = 10  # seconds between getUpdates calls
HALT_LONG_POLL_TIMEOUT = 8  # Telegram long-poll timeout (seconds)

_last_update_id = 0


async def _send_telegram(text: str) -> None:
    """Fire-and-forget Telegram message to the authorized chat."""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            logger.warning("\u2192 Telegram halt notify chat_id=%s", TELEGRAM_CHAT_ID)
            resp = await client.post(
                url,
                json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True,
                },
            )
            logger.warning(
                "\u2190 Telegram halt notify status=%s body=%s",
                resp.status_code, resp.text[:300],
            )
    except Exception as e:
        logger.error("Telegram halt notify failed: %s", e)


async def _get_updates(offset: int) -> list[dict[str, Any]]:
    if not TELEGRAM_TOKEN:
        return []
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates"
    try:
        async with httpx.AsyncClient(timeout=HALT_LONG_POLL_TIMEOUT + 5) as client:
            resp = await client.get(
                url,
                params={
                    "offset": offset,
                    "timeout": HALT_LONG_POLL_TIMEOUT,
                    "allowed_updates": '["message"]',
                },
            )
            if resp.status_code == 200:
                return resp.json().get("result", []) or []
            logger.warning(
                "Telegram getUpdates non-200 status=%s body=%s",
                resp.status_code, resp.text[:300],
            )
    except Exception as e:
        logger.warning("Telegram getUpdates failed: %s", e)
    return []


async def execute_halt() -> str:
    """
    Disable every enabled OKX trading session.

    Returns a human-readable summary suitable for Telegram delivery.
    Safe to call concurrently; each session is updated independently and
    save_settings uses INSERT OR REPLACE.
    """
    # Late import to avoid circular imports during app startup.
    from .settings import _ensure_table, get_settings, save_settings
    from .storage import _get_conn

    _ensure_table()

    # Enumerate ALL sessions with enabled=True (auto + alert).
    # Using raw DB access because get_auto_sessions() filters to auto-only.
    enabled_session_ids: list[str] = []
    try:
        with _get_conn() as conn:
            rows = conn.execute(
                "SELECT session_id, settings FROM trading_settings"
            ).fetchall()
        import json as _json
        for session_id, settings_json in rows:
            try:
                parsed = _json.loads(settings_json)
                if parsed.get("enabled"):
                    enabled_session_ids.append(session_id)
            except Exception as parse_err:
                logger.error(
                    "HALT: failed to parse settings for session %s: %s",
                    str(session_id)[:8], parse_err,
                )
    except Exception as db_err:
        logger.error("HALT: DB enumeration failed: %s", db_err)
        return (
            "\u26a0\ufe0f <b>HALT FAILED</b>\n"
            f"Could not enumerate sessions: <code>{db_err}</code>"
        )

    halted: list[str] = []
    failed: list[tuple[str, str]] = []

    for session_id in enabled_session_ids:
        try:
            settings = get_settings(session_id)
            if not settings.get("enabled"):
                continue
            settings["enabled"] = False
            save_settings(session_id, settings)
            halted.append(session_id[:8])
            logger.critical(
                "HALT: disabled session %s (was mode=%s)",
                session_id[:8], settings.get("execution_mode", "?"),
            )
        except Exception as e:
            logger.error(
                "HALT: error disabling session %s: %s",
                session_id[:8], e,
            )
            failed.append((session_id[:8], str(e)))

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    if halted and not failed:
        return (
            f"\U0001f6d1 <b>HALT executed</b> at <code>{ts}</code>\n"
            f"Disabled <b>{len(halted)}</b> session(s): "
            f"<code>{', '.join(halted)}</code>\n"
            "All new auto-orders blocked. Open positions remain "
            "(OKX SL/TP stays active)."
        )
    if halted and failed:
        return (
            f"\u26a0\ufe0f <b>HALT partial</b> at <code>{ts}</code>\n"
            f"Disabled <b>{len(halted)}</b>, failed <b>{len(failed)}</b>.\n"
            f"Failed sessions: <code>{', '.join(s for s, _ in failed)}</code>"
        )
    if failed:
        return (
            f"\u26a0\ufe0f <b>HALT FAILED</b> at <code>{ts}</code>\n"
            f"All {len(failed)} disable attempts failed. Check server logs."
        )
    return (
        f"\u2139\ufe0f <b>HALT</b> at <code>{ts}</code>\n"
        "No enabled sessions found — nothing to do."
    )


async def _handle_command(text: str) -> None:
    """Dispatch /halt and /status commands to their handlers."""
    cmd = text.strip().lower().split()[0] if text.strip() else ""
    # Strip bot username suffix: /halt@pruviqbot -> /halt
    if "@" in cmd:
        cmd = cmd.split("@", 1)[0]

    if cmd == "/halt":
        logger.critical(
            "HALT command received from Telegram chat %s", TELEGRAM_CHAT_ID
        )
        result = await execute_halt()
        await _send_telegram(result)
    elif cmd == "/status":
        # Lazy import — avoids cycle during startup
        from .settings import _ensure_table
        from .storage import _get_conn
        import json as _json

        _ensure_table()
        total = 0
        active = 0
        try:
            with _get_conn() as conn:
                rows = conn.execute(
                    "SELECT settings FROM trading_settings"
                ).fetchall()
            total = len(rows)
            for (settings_json,) in rows:
                try:
                    if _json.loads(settings_json).get("enabled"):
                        active += 1
                except Exception:
                    continue
        except Exception as e:
            await _send_telegram(
                "\u26a0\ufe0f <b>STATUS FAILED</b>\n"
                f"DB error: <code>{e}</code>"
            )
            return

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        await _send_telegram(
            "\U0001f4ca <b>AutoTrader Status</b>\n"
            f"Active sessions: <b>{active}</b> / {total}\n"
            f"Server time: <code>{ts}</code>\n"
            "Commands: <code>/halt</code> to disable all, "
            "<code>/status</code> to re-check."
        )


async def telegram_halt_loop() -> None:
    """
    Background polling loop.

    Listens for /halt and /status commands from the authorized
    TELEGRAM_CHAT_ID only. Messages from other chats are silently
    ignored. Runs forever until the task is cancelled.
    """
    global _last_update_id

    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning(
            "telegram_halt_loop disabled: TELEGRAM_TOKEN or TELEGRAM_CHAT_ID missing"
        )
        return

    logger.warning(
        "Telegram halt listener started (poll=%ds, long_poll=%ds)",
        HALT_POLL_INTERVAL, HALT_LONG_POLL_TIMEOUT,
    )

    while True:
        try:
            await asyncio.sleep(HALT_POLL_INTERVAL)
            updates = await _get_updates(_last_update_id + 1)

            for update in updates:
                try:
                    update_id = int(update.get("update_id", 0))
                    if update_id > _last_update_id:
                        _last_update_id = update_id

                    msg = update.get("message") or {}
                    text = (msg.get("text") or "").strip()
                    chat_id = str((msg.get("chat") or {}).get("id", ""))

                    # Security: ignore everything except the authorized chat.
                    if chat_id != str(TELEGRAM_CHAT_ID):
                        continue
                    if not text.startswith("/"):
                        continue

                    await _handle_command(text)
                except Exception as inner_err:
                    logger.error(
                        "telegram_halt_loop: update dispatch failed: %s",
                        inner_err,
                    )

        except asyncio.CancelledError:
            logger.warning("telegram_halt_loop cancelled — shutting down")
            raise
        except Exception as e:
            logger.error("telegram_halt_loop error: %s", e)
            # Back off before retrying so a broken Telegram API doesn't
            # hammer the server.
            await asyncio.sleep(30)
