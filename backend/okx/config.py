"""
OKX Broker configuration.
All secrets from environment variables — no hardcoded credentials.
"""
from __future__ import annotations

import os

# ── OAuth credentials ──
OKX_CLIENT_ID = os.environ.get("OKX_CLIENT_ID", "")
OKX_CLIENT_SECRET = os.environ.get("OKX_CLIENT_SECRET", "")
OKX_REDIRECT_URI = os.environ.get(
    "OKX_REDIRECT_URI", "https://api.pruviq.com/auth/okx/callback"
)
OKX_BROKER_CODE = os.environ.get("OKX_BROKER_CODE", "c12571e26a02OCDE")

# ── Encryption ──
OKX_ENCRYPTION_KEY = os.environ.get("OKX_ENCRYPTION_KEY", "")

# ── OKX API v5 URLs ──
OKX_BASE_URL = "https://www.okx.com"
OKX_OAUTH_AUTHORIZE = f"{OKX_BASE_URL}/account/oauth/authorize"
OKX_OAUTH_TOKEN = f"{OKX_BASE_URL}/api/v5/oauth/token"

# ── Demo mode (testnet headers) ──
OKX_DEMO_MODE = os.environ.get("OKX_DEMO_MODE", "false").lower() == "true"

# ── Database path (SQLite) ──
OKX_DB_PATH = os.environ.get("OKX_DB_PATH", "")

# ── Frontend URL for post-OAuth redirects ──
FRONTEND_URL = os.environ.get("PRUVIQ_FRONTEND_URL", "https://pruviq.com")

# ── Cookie domain (shared across subdomains) ──
COOKIE_DOMAIN = os.environ.get("PRUVIQ_COOKIE_DOMAIN", ".pruviq.com")
