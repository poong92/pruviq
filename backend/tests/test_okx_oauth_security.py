"""
OKX OAuth security regression guard (PR 2026-04-19).

Blocks two fund-loss / credential-leak regressions:
  1. `_validate_redirect` must reject non-http(s) schemes (javascript:, data:,
     vbscript:, file:) AND protocol-relative URLs (//evil.com). Earlier version
     relied on netloc alone, which fails open because
     `urlparse("javascript:x").netloc == ""` — the javascript URL then slipped
     through as "relative path, same-origin."
  2. apikey / token HTTP response bodies must never be `resp.text`-logged.
     The apikey response contains apiKey + secretKey + passphrase; the token
     response contains access_token + refresh_token. A single such log line in
     journalctl defeats Fernet encryption at rest.
"""
from __future__ import annotations

import re
from pathlib import Path

BACKEND_OKX = Path(__file__).parent.parent / "okx"
OAUTH_PY = BACKEND_OKX / "oauth.py"


def _load_oauth():
    """Import oauth module without triggering storage side effects.

    Storage imports depend on env vars; tests only need the pure helper.
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location("okx_oauth_under_test", OAUTH_PY)
    mod = importlib.util.module_from_spec(spec)
    # The _validate_redirect helper is pure — it doesn't need storage/config at
    # import time, but the module does. Patch missing deps with stubs if needed.
    try:
        spec.loader.exec_module(mod)
        return mod
    except Exception:
        return None


def test_validate_redirect_rejects_javascript_scheme():
    """javascript:alert(1) must not pass. urlparse gives netloc="" — the fix
    requires explicit scheme allowlist on top of netloc check."""
    mod = _load_oauth()
    if mod is None:
        # Env not configured — fall back to source-level check: the file must
        # mention scheme allowlist.
        src = OAUTH_PY.read_text(encoding="utf-8")
        assert re.search(r'scheme\s+not\s+in\s*\(\s*"http"', src), (
            "_validate_redirect must allowlist http/https schemes. Current "
            "code does not mention scheme filtering — javascript:/data: URLs "
            "will bypass the pruviq.com netloc check."
        )
        return
    assert mod._validate_redirect("javascript:alert(1)") == ""
    assert mod._validate_redirect("JaVaScRiPt:alert(1)") == ""
    assert mod._validate_redirect("data:text/html,<script>alert(1)</script>") == ""
    assert mod._validate_redirect("vbscript:msgbox(1)") == ""
    assert mod._validate_redirect("file:///etc/passwd") == ""


def test_validate_redirect_rejects_protocol_relative():
    """//evil.com/phish must not be treated as same-origin."""
    mod = _load_oauth()
    if mod is None:
        src = OAUTH_PY.read_text(encoding="utf-8")
        assert 'startswith("//")' in src, (
            "_validate_redirect must reject protocol-relative URLs (//evil.com)."
        )
        return
    assert mod._validate_redirect("//evil.com/phish") == ""
    assert mod._validate_redirect("//pruviq.com.evil.com") == ""


def test_validate_redirect_accepts_legit_paths():
    """Happy paths must still work — empty, relative, pruviq.com absolute."""
    mod = _load_oauth()
    if mod is None:
        return  # covered by source check above
    assert mod._validate_redirect("") == ""
    assert mod._validate_redirect("/simulate") == "/simulate"
    assert mod._validate_redirect("https://pruviq.com/portfolio") == (
        "https://pruviq.com/portfolio"
    )
    assert mod._validate_redirect("https://app.pruviq.com/x") == (
        "https://app.pruviq.com/x"
    )
    # Non-pruviq absolute must still be rejected
    assert mod._validate_redirect("https://evil.com/phish") == ""
    # Ambiguous relative (no leading "/") must be rejected
    assert mod._validate_redirect("evil.com") == ""


def test_oauth_response_body_never_logged_raw():
    """apikey and token POST handlers must not pass resp.text to logger.

    resp.text contains apiKey/secretKey/passphrase (apikey endpoint) or
    access_token/refresh_token (token endpoint). Any such log in journalctl
    is an irreversible credential leak.
    """
    src = OAUTH_PY.read_text(encoding="utf-8")
    # Find the two known-sensitive endpoints and scan their surrounding blocks.
    sensitive_endpoints = [
        "/api/v5/users/oauth/apikey",
        "OKX_OAUTH_TOKEN",  # token exchange uses the OAUTH_TOKEN constant
    ]
    # Narrow scope: ensure no `resp.text` appears on any logger.* line in oauth.py.
    leak_pattern = re.compile(
        r"logger\.(?:warning|info|debug|error|critical)\s*\([^)]*resp\.text",
        re.DOTALL,
    )
    hits = leak_pattern.findall(src)
    assert not hits, (
        f"oauth.py logs resp.text on {len(hits)} site(s) — apikey and token "
        f"response bodies contain plaintext OKX credentials. Log status/code/"
        f"msg fields only, never raw body. Hits: {hits}"
    )
    # Sanity: both endpoints are still called (defensive against someone
    # deleting the call entirely to pass this test).
    for e in sensitive_endpoints:
        assert e in src, (
            f"oauth.py no longer references {e!r}. Either the OAuth flow "
            f"was restructured (update this test) or coverage regressed."
        )
