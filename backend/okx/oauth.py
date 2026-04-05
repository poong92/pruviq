"""
OKX OAuth 2.0 flow for FD Broker.

Flow:
  1. generate_auth_url() → 유저를 OKX 로그인으로 redirect
  2. exchange_code(code) → authorization code → access + refresh token
  3. refresh_token(refresh) → 만료된 access token 갱신
  4. get_valid_token(user_id) → 유효한 토큰 반환 (자동 갱신)
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import time
from urllib.parse import urlencode

import httpx

from .config import (
    OKX_CLIENT_ID,
    OKX_CLIENT_SECRET,
    OKX_OAUTH_AUTHORIZE,
    OKX_OAUTH_TOKEN,
    OKX_REDIRECT_URI,
)
from .models import OAuthState, OAuthTokenResponse

logger = logging.getLogger("okx_oauth")

# 유저별 토큰 저장 (메모리 — Phase 2에서 암호화 DB로 전환)
_token_store: dict[str, OAuthState] = {}


def generate_auth_url(user_id: str) -> str:
    """
    OKX OAuth 인증 URL 생성.
    유저를 이 URL로 redirect하면 OKX 로그인 페이지가 나옴.
    """
    state = f"{user_id}:{secrets.token_urlsafe(16)}"
    params = {
        "client_id": OKX_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": OKX_REDIRECT_URI,
        "scope": "trade_read,trade_write",
        "state": state,
    }
    url = f"{OKX_OAUTH_AUTHORIZE}?{urlencode(params)}"
    logger.info("OAuth URL generated for user %s", user_id)
    return url


async def exchange_code(code: str, user_id: str) -> OAuthState:
    """
    Authorization code → access_token + refresh_token 교환.
    OKX 로그인 후 callback에서 받은 code를 사용.
    """
    data = {
        "client_id": OKX_CLIENT_ID,
        "client_secret": OKX_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": OKX_REDIRECT_URI,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(OKX_OAUTH_TOKEN, json=data, timeout=10)
        resp.raise_for_status()
        token_data = OAuthTokenResponse(**resp.json())

    state = OAuthState(
        user_id=user_id,
        access_token=token_data.access_token,
        refresh_token=token_data.refresh_token,
        expires_at=time.time() + token_data.expires_in,
        scope=token_data.scope,
    )

    _token_store[user_id] = state
    logger.info("Token obtained for user %s (expires in %ds)", user_id, token_data.expires_in)
    return state


async def refresh_access_token(user_id: str) -> OAuthState:
    """
    만료된 access_token을 refresh_token으로 갱신.
    새 토큰 쌍 발급 — 이전 토큰은 즉시 무효.
    """
    current = _token_store.get(user_id)
    if not current:
        raise ValueError(f"No token found for user {user_id}")

    data = {
        "client_id": OKX_CLIENT_ID,
        "client_secret": OKX_CLIENT_SECRET,
        "refresh_token": current.refresh_token,
        "grant_type": "refresh_token",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(OKX_OAUTH_TOKEN, json=data, timeout=10)
        resp.raise_for_status()
        token_data = OAuthTokenResponse(**resp.json())

    state = OAuthState(
        user_id=user_id,
        access_token=token_data.access_token,
        refresh_token=token_data.refresh_token,
        expires_at=time.time() + token_data.expires_in,
        scope=token_data.scope,
    )

    _token_store[user_id] = state
    logger.info("Token refreshed for user %s", user_id)
    return state


async def get_valid_token(user_id: str) -> str:
    """
    유효한 access_token 반환.
    만료 5분 전이면 자동 갱신.
    """
    state = _token_store.get(user_id)
    if not state:
        raise ValueError(f"User {user_id} not authenticated. Redirect to OAuth first.")

    # 만료 5분 전이면 갱신
    if time.time() > state.expires_at - 300:
        state = await refresh_access_token(user_id)

    return state.access_token


def is_authenticated(user_id: str) -> bool:
    """유저가 OKX OAuth 인증을 완료했는지 확인."""
    state = _token_store.get(user_id)
    if not state:
        return False
    # refresh token 만료 (3일) 확인
    if time.time() > state.expires_at + 259200:  # 3 days in seconds
        del _token_store[user_id]
        return False
    return True
