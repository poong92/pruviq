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
# OAuth broker code (OKX 2026-04-28 confirmation from BD Jun Kim — OAuth and
# API have *different* broker codes; channelId is a *separate* affiliate
# referral code). Used in OAuth authorize URL `channelId` param for now —
# kept as legacy behavior until OKX clarifies the correct slot for OAuth
# broker code (likely server-side associated with client_id, in which case
# channelId should hold the affiliate referral code instead).
OKX_BROKER_CODE_OAUTH = os.environ.get(
    "OKX_BROKER_CODE_OAUTH",
    os.environ.get("OKX_BROKER_CODE", ""),  # backward-compat fallback
)

# API broker code (separate value per OKX BD). Sent as `tag` field on every
# order POST body (orders.py / client.py) — required for commission tracking
# on real trades.
OKX_BROKER_CODE_API = os.environ.get(
    "OKX_BROKER_CODE_API",
    os.environ.get("OKX_BROKER_CODE", ""),  # backward-compat fallback
)

# Affiliate referral code (channelId). Per OKX BD: distinct from broker codes.
# Empty by default — set when affiliate registration completes. Until then,
# OAuth `channelId` param falls back to OKX_BROKER_CODE_OAUTH (legacy behavior).
OKX_AFFILIATE_CHANNEL_ID = os.environ.get("OKX_AFFILIATE_CHANNEL_ID", "")

# Legacy alias — still read by callers that haven't switched. Resolves to
# OAuth broker code (closest to legacy semantics: original OKX_BROKER_CODE
# was used in oauth.py as channelId, which we now know is OAuth-broker shaped).
OKX_BROKER_CODE = OKX_BROKER_CODE_OAUTH

if not OKX_BROKER_CODE_OAUTH and not OKX_BROKER_CODE_API:
    import logging as _logging
    _logging.getLogger("pruviq").warning(
        "OKX broker codes not set (OKX_BROKER_CODE_OAUTH / OKX_BROKER_CODE_API both empty) — commission tracking disabled"
    )

# ── Encryption ──
OKX_ENCRYPTION_KEY = os.environ.get("OKX_ENCRYPTION_KEY", "")
# Multi-key rotation support. Comma-separated Fernet keys, newest first.
# When non-empty, takes precedence over OKX_ENCRYPTION_KEY. During rotation,
# operator runs with `OKX_ENCRYPTION_KEYS=new_key,old_key` — MultiFernet
# encrypts new writes with new_key and still decrypts rows written with
# either. After `migrate_okx_encryption_keys.py` re-encrypts all rows under
# new_key, operator removes old_key from env and restarts. Graceful rotation
# with zero forced re-OAuth (architecture-audit HIGH #9).
OKX_ENCRYPTION_KEYS = os.environ.get("OKX_ENCRYPTION_KEYS", "")

# ── OKX API v5 URLs ──
OKX_BASE_URL = "https://www.okx.com"
# OAuth endpoint split (2026-04-17):
#  - authorize is a browser-visible login/consent page on okx.com: /account/oauth/authorize
#  - token is the server-to-server OAuth2 endpoint under /v5/users/oauth/ (NO /api/ segment).
# Both verified live by HTTP probe. Anything under /api/v5/oauth/* is 404.
# Token endpoint returns OAuth code 53010 ("client_id error") for invalid probes — that's
# what confirms it's the right endpoint; it's listed in project_jepo_system memory.
OKX_OAUTH_AUTHORIZE = f"{OKX_BASE_URL}/account/oauth/authorize"
OKX_OAUTH_TOKEN = f"{OKX_BASE_URL}/v5/users/oauth/token"

# ── Demo mode (testnet headers) ──
OKX_DEMO_MODE = os.environ.get("OKX_DEMO_MODE", "false").lower() == "true"

# ── Manual API key paste kill switch ──
# Backend-only revert path independent of frontend AUTOTRADE_MANUAL_ENABLED
# flag. Flip to "false" + restart pruviq-api to disable the manual-connect
# endpoint without redeploying frontend. Default true (live).
OKX_MANUAL_PASTE_ENABLED = (
    os.environ.get("OKX_MANUAL_PASTE_ENABLED", "true").lower() == "true"
)

# ── OKX OAuth-issued API key IP binding ──
# OKX docs (OKX_API_SPECS.md §1, L66-67): keys with trade perm + no IP
# binding expire after 14 days of inactivity. Without this our owner's
# OAuth-issued API key dies silently every 2 weeks if no trade fires.
# Comma-separated, max 20 IPs per OKX broker docs.
OKX_API_KEY_IP = os.environ.get("OKX_API_KEY_IP", "167.172.81.145")

# ── PKCE flow toggle ──
# OKX broker docs say OAuth 2.0 supports authorization code mode AND PKCE
# mode. Sending code_challenge + code_challenge_method=S256 on authorize
# and code_verifier on token-exchange. Hypothesis H for the consent-page
# silent-drop: newer OAuth apps may require PKCE. Toggle ON by default
# (extra params are typically ignored if PKCE not enforced — safe to ship).
OKX_OAUTH_PKCE_ENABLED = (
    os.environ.get("OKX_OAUTH_PKCE_ENABLED", "true").lower() == "true"
)

# ── Experimental OAuth debug endpoint toggle ──
# Activates GET /auth/okx/start-experimental?variant=X for testing parameter
# combinations against OKX silent-drop. Default false → 404 in prod. Owner
# enables temporarily via DO .env + systemctl restart pruviq-api when
# debugging, disables when done. Variants: baseline, read_only_trade,
# no_channel, no_access_type, add_domain, add_platform,
# read_only_trade_no_channel, no_pkce.
OKX_OAUTH_EXPERIMENTAL_ENABLED = (
    os.environ.get("OKX_OAUTH_EXPERIMENTAL_ENABLED", "false").lower() == "true"
)

# ── Database path (SQLite) ──
OKX_DB_PATH = os.environ.get("OKX_DB_PATH", "")

# ── Frontend URL for post-OAuth redirects ──
FRONTEND_URL = os.environ.get("PRUVIQ_FRONTEND_URL", "https://pruviq.com")

# ── Cookie domain (shared across subdomains) ──
COOKIE_DOMAIN = os.environ.get("PRUVIQ_COOKIE_DOMAIN", ".pruviq.com")
