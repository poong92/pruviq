/**
 * PRUVIQ binance-proxy — a Cloudflare Worker that forwards to Binance's
 * public ticker / funding endpoints from CF IP space.
 *
 * Why: Binance returns 451 on any request that originates from our KR
 * residential IP (Mac dev) and apparently from our SG DigitalOcean
 * droplet as well. CF's anycast edge is not blocked, so a tiny proxy
 * parked there lets both clients keep fetching with zero ops complexity.
 *
 * Scope pinned to two hosts (Binance spot + futures) and read-only
 * endpoints we actually use. Anything else → 404 so this never becomes a
 * general Binance pass-through.
 *
 * Auth: X-Proxy-Key must match env.PROXY_KEY. Set with:
 *   wrangler secret put PROXY_KEY
 */

const ALLOWED_PATHS = {
  "/api/v3/ticker/24hr": "https://api.binance.com",
  "/api/v3/ticker/price": "https://api.binance.com",
  "/fapi/v1/ticker/24hr": "https://fapi.binance.com",
  "/fapi/v1/premiumIndex": "https://fapi.binance.com",
  "/fapi/v1/fundingRate": "https://fapi.binance.com",
};

export default {
  async fetch(request, env) {
    // Auth gate. We're on a CF public IP — anything reachable here is on
    // the public internet until proven otherwise.
    const providedKey = request.headers.get("X-Proxy-Key") || "";
    if (!env.PROXY_KEY || providedKey !== env.PROXY_KEY) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Method allowlist — GET only. Binance spot ticker endpoints don't
    // accept POST anyway, but the hardening is cheap.
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(request.url);
    const upstream = ALLOWED_PATHS[url.pathname];
    if (!upstream) {
      return new Response(
        JSON.stringify({ error: "path not allowed", path: url.pathname }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const target = upstream + url.pathname + (url.search || "");
    let resp;
    try {
      resp = await fetch(target, {
        method: "GET",
        headers: {
          "User-Agent": "PRUVIQ-binance-proxy/1.0",
          Accept: "application/json",
        },
        // Short edge cache — spot/futures tickers update fast, but 10s of
        // cache shaves a huge chunk of Binance request cost if multiple
        // workers/hosts hit this proxy concurrently.
        cf: { cacheEverything: true, cacheTtl: 10 },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "upstream fetch failed", detail: String(err) }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    // Stream body through; keep content-type, strip everything else so we
    // don't accidentally leak any CF or Binance debug headers.
    const respHeaders = new Headers();
    const ct = resp.headers.get("content-type");
    if (ct) respHeaders.set("content-type", ct);
    respHeaders.set("x-pruviq-proxy", "binance");
    return new Response(resp.body, {
      status: resp.status,
      headers: respHeaders,
    });
  },
};
