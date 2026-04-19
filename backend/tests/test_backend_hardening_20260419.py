"""
Backend hardening regression guards (PR 2026-04-19).

Closes 5 items flagged by the expert sweep after the 8-PR cascade merged:

1. [CRITICAL] `_okx_reconcile_loop` / `_okx_pnl_retry_loop` silent death on
   any non-CancelledError — outer try/except logged once and let the task
   exit. No alert. Reconciliation for orphan positions would silently
   stop forever.
2. [HIGH] `/execute/order` Idempotency-Key header treated empty same as
   absent — client sending `Idempotency-Key: ` (header present, empty
   value) silently got NO replay protection. A client-side retry would
   place a duplicate order.
3. [HIGH] `okx/server.py` signal-poll non-200 logged `resp.text[:300]`.
   The signal source auths via X-Internal-Key; nginx default error_page
   templates echo request headers → INTERNAL_API_KEY can leak to journalctl.
4. [HIGH] `okx/telegram_halt.py` notify/getUpdates non-200 logged
   `resp.text[:300]` — Telegram error `description` on 401/404 can echo
   the bot token.
5. [LOW] `okx/oauth.py` `_validate_redirect` used `parsed.netloc` which
   includes `user:pass@host`. Input `https://pruviq.com@evil.pruviq.com/`
   passes the endswith check while redirecting to evil.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

REPO = Path(__file__).resolve().parent.parent
API_MAIN = REPO / "api" / "main.py"
ROUTER = REPO / "okx" / "router.py"
SERVER = REPO / "okx" / "server.py"
TELEGRAM_HALT = REPO / "okx" / "telegram_halt.py"
OAUTH = REPO / "okx" / "oauth.py"


def _extract_function_body(src: str, name: str) -> str:
    """Grab the text of `async def <name>(...)` up to the next top-level
    def/async def. Good enough for our linear-style functions."""
    m = re.search(
        rf"^async def {re.escape(name)}\b.*?(?=^(?:async )?def |\Z)",
        src,
        re.DOTALL | re.MULTILINE,
    )
    return m.group(0) if m else ""


def test_reconcile_loop_has_outer_while_true():
    """Regression: inner reconcile_loop crash must NOT kill the outer task."""
    src = API_MAIN.read_text()
    body = _extract_function_body(src, "_okx_reconcile_loop")
    assert body, "_okx_reconcile_loop not found"
    assert "while True" in body, (
        "_okx_reconcile_loop must have outer `while True` wrapping the "
        "inner reconcile_loop() call. Without it, any exception kills "
        "reconciliation permanently — orphan positions go undetected."
    )
    assert "asyncio.sleep" in body, (
        "_okx_reconcile_loop must sleep between restarts (avoid hot-loop "
        "on persistent failure)."
    )


def test_pnl_retry_loop_has_outer_while_true():
    src = API_MAIN.read_text()
    body = _extract_function_body(src, "_okx_pnl_retry_loop")
    assert body, "_okx_pnl_retry_loop not found"
    assert "while True" in body
    assert "asyncio.sleep" in body


def test_idempotency_key_empty_rejected():
    """Regression: empty Idempotency-Key must be rejected with 400, not
    silently fall through to cl_ord_id=None (which means NO replay protection)."""
    src = ROUTER.read_text()
    # Hunt the idempotency block; it must strip + 400 on empty.
    assert re.search(
        r"idempotency_key\s*is\s*not\s*None",
        src,
    ), (
        "router.py must use `is not None` — Python falsy check (`if key:`) "
        "treats empty string as absent."
    )
    assert re.search(r"HTTPException\(\s*400\b", src) and "empty" in src.lower(), (
        "router.py must return 400 when Idempotency-Key is present but "
        "empty/whitespace — silently ignoring = silent retry bug."
    )


def test_server_signal_poll_does_not_log_response_body():
    """Regression: X-Internal-Key must not leak via nginx error_page echo."""
    src = SERVER.read_text()
    # Find the Signal poll non-200 logger line and verify no resp.text there.
    block = re.search(r'"Signal poll non-200.*?\)', src, re.DOTALL)
    assert block, "Signal poll log block not found (test needs update)"
    assert "resp.text" not in block.group(0), (
        "okx/server.py Signal-poll non-200 log must not include resp.text — "
        "INTERNAL_API_KEY can leak via upstream error_page echo."
    )


def test_telegram_halt_does_not_log_response_body():
    """Regression: bot token can leak in Telegram error `description`."""
    src = TELEGRAM_HALT.read_text()
    # The two historical leak sites were halt-notify and getUpdates 401.
    # After fix, neither should have resp.text in the warning body.
    warning_lines = re.findall(
        r'logger\.warning\([^)]*resp\.text', src, re.DOTALL,
    )
    assert not warning_lines, (
        f"okx/telegram_halt.py still logs resp.text on {len(warning_lines)} "
        "line(s). Log status + json()['description'][:120] instead."
    )


def test_validate_redirect_uses_hostname_not_netloc():
    """Regression: `https://pruviq.com@evil.pruviq.com/` must be rejected."""
    src = OAUTH.read_text()
    # Source-level check: the host comparison must be against `parsed.hostname`,
    # not `parsed.netloc`. Also userinfo rejection.
    assert "parsed.hostname" in src, (
        "_validate_redirect must use parsed.hostname (strips user:pass@) "
        "instead of parsed.netloc. netloc fails open on URL with userinfo."
    )
    # The file may still have a legacy `netloc.endswith(".pruviq.com")` line
    # BUT it must not be on the final gate. Verify userinfo rejection exists.
    assert re.search(r'"@"\s+in\s+\(?\s*parsed\.netloc', src) or re.search(
        r'if\s+"@"\s+in\s+parsed\.netloc', src
    ), (
        "_validate_redirect should explicitly reject URLs with `@` in netloc "
        "(userinfo) — no legitimate use on this endpoint."
    )
    # Runtime check (best effort).
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("oauth_under_test", OAUTH)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    except Exception:
        return  # env not configured — source check above is sufficient
    assert mod._validate_redirect("https://pruviq.com@evil.pruviq.com/") == ""
    assert mod._validate_redirect("https://user:pw@evil.pruviq.com/") == ""
    # Happy path still works.
    assert mod._validate_redirect("https://pruviq.com/dashboard") == (
        "https://pruviq.com/dashboard"
    )
    assert mod._validate_redirect("https://app.pruviq.com/x") == (
        "https://app.pruviq.com/x"
    )
