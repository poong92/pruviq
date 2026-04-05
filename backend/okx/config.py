"""
OKX Broker configuration.
All values from environment variables — no hardcoded secrets.
"""
from __future__ import annotations

import os

# OAuth (받으면 환경변수로 설정)
OKX_CLIENT_ID = os.environ.get("OKX_CLIENT_ID", "")
OKX_CLIENT_SECRET = os.environ.get("OKX_CLIENT_SECRET", "")
OKX_REDIRECT_URI = os.environ.get("OKX_REDIRECT_URI", "https://pruviq.com/auth/okx/callback")
OKX_BROKER_CODE = os.environ.get("OKX_BROKER_CODE", "PRUVIQ")

# API URLs
OKX_BASE_URL = "https://www.okx.com"
OKX_OAUTH_AUTHORIZE = f"{OKX_BASE_URL}/v3/oauth/authorize"
OKX_OAUTH_TOKEN = f"{OKX_BASE_URL}/v3/oauth/token"

# Demo mode (True = 테스트넷)
OKX_DEMO_MODE = os.environ.get("OKX_DEMO_MODE", "true").lower() == "true"

# Token storage path (암호화 저장 — Phase 2에서 구현)
OKX_TOKEN_DIR = os.environ.get("OKX_TOKEN_DIR", "/tmp/pruviq-okx-tokens")
