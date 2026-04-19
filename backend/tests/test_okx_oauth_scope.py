"""
OKX OAuth scope regression guard.

뿌리 (2026-04-19, PR #1159): `oauth.py` 가 `scope="read_only,trade"` 를 하드코딩
하여 OKX Broker 가 사용자를 조용히 `/account/users` 로 drop 시킴
(OKX_API_SPECS.md §1). 7일간 OAuth 연결 0건의 원인이었음.

이 테스트는 source level 에서 `scope` 리터럴을 검증하여 동일 실수 재유입 방지.
DB 부작용 없음 — 파일 parsing 만 수행.
"""
from __future__ import annotations

import re
from pathlib import Path

BACKEND_OKX = Path(__file__).parent.parent / "okx"
OAUTH_PY = BACKEND_OKX / "oauth.py"
SPEC_MD = BACKEND_OKX / "OKX_API_SPECS.md"


def test_oauth_py_scope_literals_are_fast_api():
    """oauth.py 의 모든 `"scope": "..."` 값이 fast_api 인지 검증.

    OKX Broker OAuth 는 `fast_api` 만 허용. `read_only,trade` 는 /users drop.
    `perm` 필드(API key 권한)와 구분 — perm 은 read_only,trade 가 맞음.
    """
    content = OAUTH_PY.read_text(encoding="utf-8")
    # `"scope": "..."` 리터럴만 (API key `"perm":` 와 구분)
    scope_values = re.findall(r'"scope"\s*:\s*"([^"]+)"', content)
    assert scope_values, (
        "No `\"scope\":` hardcoded values found in oauth.py — "
        "this regression test is obsolete. Remove or update."
    )
    bad = [s for s in scope_values if s != "fast_api"]
    assert not bad, (
        f"oauth.py has wrong OAuth scope: {bad!r}.\n"
        f"OKX Broker requires scope=fast_api (OKX_API_SPECS.md §1).\n"
        f"scope=\"read_only,trade\" silently routes users to /account/users.\n"
        f"Note: API key `perm` field is separate — that one should be "
        f"\"read_only,trade\"."
    )


def test_spec_md_documents_scope_requirement():
    """OKX_API_SPECS.md 에 scope 요구사항이 명시돼 있는지 보증.

    문서가 SSoT. 문서에서 fast_api 규칙이 사라지면 테스트가 fail →
    문서 의도적 변경 시에만 이 테스트 갱신하도록 강제.
    """
    content = SPEC_MD.read_text(encoding="utf-8")
    assert "fast_api" in content, (
        "OKX_API_SPECS.md must reference `fast_api` scope — critical OAuth rule."
    )
    assert "/account/users" in content, (
        "OKX_API_SPECS.md must document the /account/users drop behavior — "
        "otherwise future dev may reintroduce read_only,trade."
    )


def test_oauth_perm_field_unchanged():
    """API key `perm` 필드는 read_only,trade 여야 — scope 와 혼동 금지.

    perm = OKX API key 의 실거래 권한 (read-only 조회 + trade 주문).
    scope = OAuth authorize URL 진입 레벨 (fast_api).
    둘은 서로 다른 계층의 값이며 동일시하면 실거래 권한 상실.
    """
    content = OAUTH_PY.read_text(encoding="utf-8")
    perm_values = re.findall(r'"perm"\s*:\s*"([^"]+)"', content)
    assert perm_values, "oauth.py should hardcode `perm` for API key creation"
    for p in perm_values:
        assert "read_only" in p and "trade" in p, (
            f"perm must grant both read_only and trade: got {p!r}. "
            f"Otherwise user cannot execute orders after OAuth."
        )
