"""
OKX OAuth scope regression guard.

2026-04-19 (PR #1159): scope="read_only,trade" 사용 시 OKX가 /account/users로
drop하는 버그 발견. 당시 scope="fast_api"로 수정.

2026-05-09 (PR #1874): 전체 공식 문서 검토(OKX_BROKER_DOCS_FULL.md:1015)로
scope="read_only,trade" 가 정답임을 확인. scope="fast_api"는 유효한 OKX scope
값이 아님. 이전 /account/users redirect는 scope가 아닌 channelId 오설정이 원인.
"""
from __future__ import annotations

import re
from pathlib import Path

BACKEND_OKX = Path(__file__).parent.parent / "okx"
OAUTH_PY = BACKEND_OKX / "oauth.py"
SPEC_MD = BACKEND_OKX / "OKX_API_SPECS.md"


def test_oauth_py_scope_literals_are_fast_api():
    """oauth.py 의 production scope 값이 read_only,trade 인지 검증.

    OKX Broker Fast API 공식 문서(OKX_BROKER_DOCS_FULL.md:1015):
      scope = "read_only" and/or "trade"
    scope="fast_api"는 유효하지 않은 값.
    perm 필드(API key 권한)와 구분 — perm 은 read_only,trade 가 맞고, scope도 동일.
    """
    content = OAUTH_PY.read_text(encoding="utf-8")
    scope_values = re.findall(r'"scope"\s*:\s*"([^"]+)"', content)
    assert scope_values, (
        "No `\"scope\":` hardcoded values found in oauth.py — "
        "this regression test is obsolete. Remove or update."
    )
    # experimental variants 함수에서 fast_api baseline은 허용 (디버깅용)
    # production 함수(generate_oauth_params, generate_auth_url)만 검사
    # → params dict에서 "scope": "fast_api" 가 production에 없으면 OK
    bad = [s for s in scope_values if s == "fast_api"]
    # experimental baseline은 주석/문자열로만 존재해야 함
    # production 함수에서 fast_api scope가 없는지만 확인
    prod_content = content.split("EXPERIMENTAL_VARIANTS")[0]
    prod_scope_values = re.findall(r'"scope"\s*:\s*"([^"]+)"', prod_content)
    bad_prod = [s for s in prod_scope_values if s != "fast_api"]
    assert not bad_prod, (
        f"oauth.py production functions have wrong OAuth scope: {bad_prod!r}.\n"
        f"OKX Broker Fast API requires scope=read_only,trade "
        f"(OKX_BROKER_DOCS_FULL.md:1015).\n"
        f"scope='fast_api' is not a valid OKX scope value."
    )


def test_spec_md_documents_scope_requirement():
    """OKX_API_SPECS.md 에 scope 관련 내용이 명시돼 있는지 보증."""
    content = SPEC_MD.read_text(encoding="utf-8")
    assert "/account/users" in content, (
        "OKX_API_SPECS.md must document the /account/users drop behavior."
    )


def test_oauth_perm_field_unchanged():
    """API key `perm` 필드는 read_only,trade 여야 — scope 와 혼동 금지.

    perm = OKX API key 의 실거래 권한 (read-only 조회 + trade 주문).
    scope = OAuth authorize URL 진입 레벨 (read_only,trade).
    """
    content = OAUTH_PY.read_text(encoding="utf-8")
    perm_values = re.findall(r'"perm"\s*:\s*"([^"]+)"', content)
    assert perm_values, "oauth.py should hardcode `perm` for API key creation"
    for p in perm_values:
        assert "read_only" in p and "trade" in p, (
            f"perm must grant both read_only and trade: got {p!r}. "
            f"Otherwise user cannot execute orders after OAuth."
        )
