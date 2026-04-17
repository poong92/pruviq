# PRUVIQ binance-proxy (Cloudflare Worker)

Forwards a tight allowlist of Binance public endpoints from CF edge, so our KR residential Mac and our SG DigitalOcean droplet can both fetch without hitting Binance's geo 451.

## Why a Worker, not an in-process proxy

- `/opt/binance-proxy.py` on DO has the same public IP as DO itself → Binance still 451s. It defeats KR-local IP caps, not the upstream geo block.
- A CF Worker originates from CF's anycast edge, which Binance does not block as of this writing.
- Zero moving parts (no VM, no containers, no key rotation beyond a single secret).

## Scoped allowlist (not a general pass-through)

```js
ALLOWED_PATHS = {
  '/api/v3/ticker/24hr':   api.binance.com,    // Spot tickers
  '/api/v3/ticker/price':  api.binance.com,    // Spot price
  '/fapi/v1/ticker/24hr':  fapi.binance.com,   // Futures tickers
  '/fapi/v1/premiumIndex': fapi.binance.com,   // Funding + mark
  '/fapi/v1/fundingRate':  fapi.binance.com,   // Funding history
}
```

Other paths → 404.  Method other than GET → 405.

## Deploy (one-time)

```bash
cd workers/binance-proxy

# 1. Install wrangler locally (or use npx — repo's root node_modules already has it)
# 2. Set the proxy-key secret. Use something long and rotate annually.
wrangler secret put PROXY_KEY
# (paste a long random string — same one goes into /opt/pruviq/shared/.env
#  on DO as BINANCE_PROXY_KEY, and into Mac ~/.secrets.env)

# 3. Deploy. Default URL → https://pruviq-binance-proxy.<your-subdomain>.workers.dev
wrangler deploy
```

Optionally bind to `binance-proxy.pruviq.com` (uncomment `routes` in `wrangler.toml` and redeploy).

## Client usage

```bash
curl -H "X-Proxy-Key: <PROXY_KEY>" \
  "https://pruviq-binance-proxy.<subdomain>.workers.dev/fapi/v1/ticker/24hr"
```

## Rollout plan (pairs with BINANCE_PROXY_URL env on DO + Mac)

1. Deploy the Worker (above).
2. Put its URL + the same PROXY_KEY in `/opt/pruviq/shared/.env` on DO and `~/.secrets.env` on Mac.
3. Flip `backend/scripts/refresh_static.py` and `backend/scripts/update_ohlcv.py` to prefer the proxy URL (separate PR — we ship the Worker first to avoid a flag-day where code expects a proxy that isn't deployed).
4. Once everything points at the Worker, retire `/opt/binance-proxy.py` on DO.

## Operational notes

- Free plan covers ~100k requests/day. Current refresh cadence (`*/20 *` = 72/day/host × 2 hosts = 144/day) leaves headroom for a long time.
- Edge cache TTL is 10s — guards against burst self-DoS if multiple callers fire concurrently.
- `x-pruviq-proxy: binance` header is passed through so downstream can log proxy-path vs direct-path.
