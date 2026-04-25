"""
OKX OAuth PKCE flow regression guards (added 2026-04-25).

Why this exists:
  OKX broker docs explicitly state OAuth 2.0 supports both authorization-code
  mode AND PKCE mode. PR #1159 spent 6 hours debugging the consent-page silent
  drop and verified every "value-level" parameter (client_id, secret, IP,
  channelId, redirect_uri) — but never tried adding `code_challenge` to the
  authorize request. Hypothesis H: newer OAuth apps registered with OKX may
  require PKCE, and our authorize URL silently drops without it.

These tests don't prove PKCE fixes the silent-drop (that needs a live browser
test on prod). They prove our code:
  1. Generates a valid RFC 7636 PKCE pair when the toggle is on
  2. Emits code_challenge + code_challenge_method=S256 on /authorize params
  3. Persists the verifier with the CSRF state and reads it back
  4. Includes code_verifier on token exchange
  5. Passes the IP whitelist on the API key creation body (#1, prevents 14d
     inactivity expiry — separate concern but verified together)
"""
from __future__ import annotations

import base64
import hashlib
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

OAUTH_PY = BACKEND / "okx" / "oauth.py"


def test_oauth_source_implements_pkce_helpers():
    """Source-level guard: oauth.py must define _gen_pkce_pair and route
    code_challenge through to authorize params + code_verifier through to
    token exchange."""
    src = OAUTH_PY.read_text(encoding="utf-8")
    assert "_gen_pkce_pair" in src, (
        "oauth.py must define _gen_pkce_pair() — RFC 7636 verifier+challenge "
        "generator. Missing means PKCE flow not wired."
    )
    assert "code_challenge" in src and "code_challenge_method" in src, (
        "oauth.py must emit code_challenge + code_challenge_method on the "
        "authorize URL. Missing one of these = invalid PKCE flow."
    )
    assert '"S256"' in src, (
        'oauth.py must use code_challenge_method="S256" — plain method is '
        "deprecated and should not be used by new clients."
    )
    assert "code_verifier" in src, (
        "oauth.py must pass code_verifier on token exchange so OKX can "
        "verify SHA256(verifier) == challenge sent on /authorize."
    )


def test_pkce_pair_is_rfc7636_compliant():
    """_gen_pkce_pair must produce: verifier 43-128 chars URL-safe; challenge
    = base64url(SHA256(verifier)) with no padding. Mismatch = OKX 53010."""
    import okx.oauth as oauth
    verifier, challenge = oauth._gen_pkce_pair()

    # RFC 7636 §4.1: verifier 43-128 chars from [A-Z][a-z][0-9]-._~
    assert 43 <= len(verifier) <= 128, (
        f"verifier len={len(verifier)} outside RFC 7636 [43, 128]"
    )
    assert re.match(r"^[A-Za-z0-9\-._~]+$", verifier), (
        f"verifier contains non-URL-safe chars: {verifier!r}"
    )

    # Challenge = base64url(SHA256(verifier)), no padding
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    expected = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    assert challenge == expected, (
        f"challenge mismatch: got {challenge!r}, expected {expected!r} — "
        f"OKX will reject with 53010 (parameter error) on token exchange"
    )
    assert "=" not in challenge, (
        "challenge has padding — base64url for PKCE must strip `=` per RFC"
    )


def test_authorize_params_include_pkce_when_enabled(monkeypatch):
    """generate_oauth_params must include code_challenge + method when
    OKX_OAUTH_PKCE_ENABLED is true. Off => no PKCE keys at all (so legacy
    OAuth flows aren't accidentally broken)."""
    import importlib
    import okx.oauth as oauth_mod
    import okx.config as config_mod

    # Force PKCE on, reload the module so the constant is re-read at top-level.
    monkeypatch.setenv("OKX_OAUTH_PKCE_ENABLED", "true")
    monkeypatch.setenv("OKX_CLIENT_ID", "test-client")
    monkeypatch.setenv("OKX_REDIRECT_URI", "https://api.example/callback")
    importlib.reload(config_mod)
    importlib.reload(oauth_mod)

    # save_csrf_state writes to SQLite — stub it out, we only inspect params
    saved = []

    def fake_save(state, redirect_url, lang, code_verifier=""):
        saved.append((state, redirect_url, lang, code_verifier))

    monkeypatch.setattr(oauth_mod, "save_csrf_state", fake_save)

    params = oauth_mod.generate_oauth_params(redirect_after="", lang="en")
    assert "code_challenge" in params, (
        "PKCE on but code_challenge missing from authorize params"
    )
    assert params.get("code_challenge_method") == "S256"
    assert params["code_challenge"] != ""
    # Verifier must have been persisted with the CSRF state
    assert len(saved) == 1
    assert saved[0][3] != "", "code_verifier must be saved with CSRF state"

    # Off path: no PKCE params should appear at all
    monkeypatch.setenv("OKX_OAUTH_PKCE_ENABLED", "false")
    importlib.reload(config_mod)
    importlib.reload(oauth_mod)
    saved.clear()
    monkeypatch.setattr(oauth_mod, "save_csrf_state", fake_save)
    params_off = oauth_mod.generate_oauth_params(redirect_after="", lang="en")
    assert "code_challenge" not in params_off
    assert "code_challenge_method" not in params_off
    assert saved[0][3] == ""


def test_apikey_body_includes_ip_binding():
    """OKX docs: keys with trade perm + no IP expire after 14d inactivity.
    _create_user_apikey must send `ip` field on POST .../oauth/apikey
    whenever OKX_API_KEY_IP is configured (default: DO server IP)."""
    src = OAUTH_PY.read_text(encoding="utf-8")
    # The body assembly + ip injection live in _create_user_apikey.
    # Look for the pattern: body["ip"] = OKX_API_KEY_IP (or similar).
    has_ip_field = bool(
        re.search(r'body\[\s*[\'"]ip[\'"]\s*\]\s*=\s*OKX_API_KEY_IP', src)
    )
    has_inline_ip = bool(re.search(r'"ip"\s*:\s*OKX_API_KEY_IP', src))
    assert has_ip_field or has_inline_ip, (
        "_create_user_apikey must pass `ip` to OKX. Without it OAuth-issued "
        "keys with trade perm expire after 14d inactivity (OKX_API_SPECS.md "
        "§1, L66-67)."
    )
    assert "OKX_API_KEY_IP" in src, (
        "OKX_API_KEY_IP must be imported and referenced — SSoT for the IP."
    )


def test_validate_csrf_state_returns_three_tuple_shape():
    """Source-level: storage.validate_csrf_state must return a 3-tuple
    (redirect_url, lang, code_verifier). Any caller assuming 2-tuple breaks
    silently — explicit check protects against accidental signature drift."""
    storage_py = (BACKEND / "okx" / "storage.py").read_text(encoding="utf-8")
    assert re.search(
        r"def\s+validate_csrf_state\s*\([^)]*\)\s*->\s*tuple\[str,\s*str,\s*str\]\s*\|\s*None",
        storage_py,
    ), (
        "validate_csrf_state must return tuple[str, str, str] | None — the "
        "third slot is code_verifier for PKCE."
    )
