"""
OKX OAuth experimental-variant endpoint regression guard.

Owner uses this endpoint to A/B test parameter combinations against the
silent /account/users redirect. Each variant flips ONE parameter from
baseline so we isolate which mutation lifts the drop. Tests assert each
variant produces the expected URL shape so a future refactor can't
silently break a debugging path.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

OAUTH_PY = BACKEND / "okx" / "oauth.py"


def test_experimental_variants_constant_lists_all_eight():
    """The variant set is the contract between backend and the owner's
    browser test plan. Adding/removing without updating the plan = drift."""
    src = OAUTH_PY.read_text(encoding="utf-8")
    expected = {
        "baseline",
        "read_only_trade",
        "no_channel",
        "no_access_type",
        "add_domain",
        "add_platform",
        "read_only_trade_no_channel",
        "no_pkce",
    }
    for v in expected:
        assert f'"{v}"' in src, f"variant {v!r} missing from EXPERIMENTAL_VARIANTS"


def test_experimental_endpoint_gated_by_env(monkeypatch):
    """Endpoint must 404 when OKX_OAUTH_EXPERIMENTAL_ENABLED=false (default).
    Returning the URL by accident in prod = experiment leak / OAuth
    re-route. Source-level guard since we can't reliably hit FastAPI here."""
    router_py = (BACKEND / "okx" / "router.py").read_text(encoding="utf-8")
    # The experimental handler must reference the env flag and raise 404.
    handler_block = re.search(
        r"async def oauth_start_experimental.*?(?=\n@router\.|\Z)",
        router_py,
        re.S,
    )
    assert handler_block, "oauth_start_experimental handler not found"
    body = handler_block.group(0)
    assert "OKX_OAUTH_EXPERIMENTAL_ENABLED" in body, (
        "experimental handler must check OKX_OAUTH_EXPERIMENTAL_ENABLED"
    )
    assert "HTTPException(404" in body, (
        "disabled experimental endpoint must return 404 (matches normal "
        "fastapi behavior of unknown route — no leak via 503/error message)"
    )


def test_read_only_trade_variant_produces_expected_scope(monkeypatch):
    """read_only_trade variant must set scope=read_only,trade and KEEP
    PKCE + channelId so we can isolate the scope flip alone."""
    monkeypatch.setenv("OKX_CLIENT_ID", "test-client")
    monkeypatch.setenv("OKX_REDIRECT_URI", "https://api.example/callback")
    monkeypatch.setenv("OKX_BROKER_CODE", "BROKER123")
    monkeypatch.setenv("OKX_OAUTH_PKCE_ENABLED", "true")

    import importlib
    import okx.config as config_mod
    import okx.oauth as oauth_mod
    importlib.reload(config_mod)
    importlib.reload(oauth_mod)

    monkeypatch.setattr(oauth_mod, "save_csrf_state", lambda *a, **k: None)

    url = oauth_mod.generate_auth_url_experimental(
        "read_only_trade", redirect_after="", lang="en"
    )
    qs = parse_qs(urlparse(url).query)

    assert qs["scope"] == ["read_only,trade"]
    assert qs["channelId"] == ["BROKER123"]
    assert "code_challenge" in qs
    assert qs["code_challenge_method"] == ["S256"]


def test_no_channel_variant_drops_channel_id(monkeypatch):
    """no_channel variant removes channelId — isolates whether broker code
    presence is the silent-drop trigger when scope=fast_api."""
    monkeypatch.setenv("OKX_CLIENT_ID", "test-client")
    monkeypatch.setenv("OKX_REDIRECT_URI", "https://api.example/callback")
    monkeypatch.setenv("OKX_BROKER_CODE", "BROKER123")
    monkeypatch.setenv("OKX_OAUTH_PKCE_ENABLED", "true")

    import importlib
    import okx.config as config_mod
    import okx.oauth as oauth_mod
    importlib.reload(config_mod)
    importlib.reload(oauth_mod)

    monkeypatch.setattr(oauth_mod, "save_csrf_state", lambda *a, **k: None)

    url = oauth_mod.generate_auth_url_experimental("no_channel")
    qs = parse_qs(urlparse(url).query)
    assert "channelId" not in qs
    assert qs["scope"] == ["fast_api"]


def test_unknown_variant_raises_value_error(monkeypatch):
    """Unknown variant must raise ValueError so the endpoint returns 400
    instead of silently producing a malformed URL."""
    monkeypatch.setenv("OKX_CLIENT_ID", "test-client")
    monkeypatch.setenv("OKX_REDIRECT_URI", "https://api.example/callback")

    import importlib
    import okx.config as config_mod
    import okx.oauth as oauth_mod
    importlib.reload(config_mod)
    importlib.reload(oauth_mod)

    import pytest
    with pytest.raises(ValueError) as exc_info:
        oauth_mod.generate_auth_url_experimental("nonexistent_variant")
    assert "nonexistent_variant" in str(exc_info.value)
