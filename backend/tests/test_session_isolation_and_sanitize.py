"""
Expert-sweep follow-ups (PR 2026-04-19, medium tier).

1. `auto_executor.process_signals` — one bad session crashes the entire
   loop and drops signals for all other sessions. Wrap pre-signal setup
   (is_authenticated + get_settings + get_active_strategy) in try/except
   so a malformed settings row only affects that session.

2. `telegram_halt.execute_halt` — DB error was f-string'd into the
   Telegram response, leaking SQL fragments/paths/column names + breaking
   HTML parse_mode on `<`/`&`. Replace with a generic message; full error
   stays in server logs.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
AUTO_EXECUTOR = REPO / "okx" / "auto_executor.py"
TELEGRAM_HALT = REPO / "okx" / "telegram_halt.py"


def test_process_signals_wraps_session_setup_in_try():
    """Regression: the pre-signal setup lines (is_authenticated, get_settings,
    get_active_strategy) must sit inside a try/except so one malformed
    session does not break every subsequent session on that tick."""
    src = AUTO_EXECUTOR.read_text()
    # Locate the `process_signals` body and assert the outer loop has a
    # try wrapping the session setup calls.
    body_match = re.search(
        r"async def process_signals\(.*?(?=^(?:async )?def |\Z)",
        src,
        re.DOTALL | re.MULTILINE,
    )
    assert body_match, "process_signals not found"
    body = body_match.group(0)
    # Find the outer for-loop and check that its body starts with `try:`
    # before calling is_authenticated.
    outer_loop = re.search(
        r"for session_id in auto_sessions:\s*\n(.+?)(?=\n\s*for |\Z)",
        body,
        re.DOTALL,
    )
    assert outer_loop, "outer session loop not found"
    loop_body = outer_loop.group(1)
    # try: must precede the is_authenticated call.
    try_pos = loop_body.find("try:")
    is_auth_pos = loop_body.find("is_authenticated(")
    assert try_pos != -1 and 0 < try_pos < is_auth_pos, (
        "process_signals outer loop must have `try:` wrapping is_authenticated "
        "+ get_settings + get_active_strategy. Without it, one malformed "
        "session row kills the whole tick — every other subscriber's signals "
        "are silently dropped."
    )


def test_process_signals_logs_and_continues_on_session_setup_error():
    src = AUTO_EXECUTOR.read_text()
    # Somewhere near the session-setup try/except, there should be a
    # logger.error + continue.
    assert re.search(
        r"session.*?setup\s+failed.*?continue",
        src,
        re.IGNORECASE | re.DOTALL,
    ), (
        "Session-setup exception handler must log clearly and `continue` "
        "to the next session — not swallow silently."
    )


def test_halt_db_error_does_not_leak_to_telegram():
    """Regression: `f\"...{db_err}\"` would put raw exception text (SQL,
    paths, column names) + unescaped < > & into the Telegram HTML body."""
    src = TELEGRAM_HALT.read_text()
    # Narrow to the halt-FAILED message construction that used to interpolate
    # db_err. After the fix, db_err must NOT appear inside the return string.
    bad_pattern = re.compile(
        r'"[^"]*HALT FAILED[^"]*"\s*\n\s*f"[^"]*\{db_err\}',
        re.DOTALL,
    )
    assert not bad_pattern.search(src), (
        "telegram_halt.py HALT FAILED still interpolates db_err into the "
        "Telegram response. Log full error server-side; send generic "
        "\"check server logs\" to Telegram."
    )
    # And positive: the generic phrase must appear.
    assert re.search(
        r"check server logs|journalctl",
        src,
    ), (
        "telegram_halt.py HALT FAILED response should point the operator "
        "to server logs instead of dumping the exception."
    )


def test_halt_db_error_still_logged_server_side():
    """Regression guard: we sanitize the Telegram output but must keep
    the full error in server logs for actual debugging."""
    src = TELEGRAM_HALT.read_text()
    # Expect `logger.error("HALT: DB enumeration failed: %s", db_err)`
    # somewhere in the file.
    assert re.search(
        r'logger\.error\([^)]*HALT.*?db_err',
        src,
        re.DOTALL,
    ), (
        "telegram_halt.py must still log the full db_err server-side. "
        "Sanitizing the Telegram output without server-side logging would "
        "destroy debuggability."
    )
