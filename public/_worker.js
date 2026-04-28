/**
 * Cloudflare Pages Advanced Mode Worker
 *
 * Cloudflare Pages가 Advanced Mode worker를 감지하면 functions/ 디렉토리 전체를
 * bypass함. 즉 functions/events.ts + functions/simulate/[[path]].ts는 dead code.
 * 모든 라우팅은 이 worker가 처리해야 함.
 *
 * Routes:
 * - GET /sitemap.xml → 301 → /sitemap-index.xml
 * - POST /events → telemetry 수집 (Cloudflare Log Push, 2026-04-28 P1 fix)
 * - OPTIONS /events → CORS preflight
 * - * /api/* → https://api.pruviq.com 프록시 (단, /api 또는 /api/ 정확 일치는 docs 페이지)
 * - GET /coins/UPPERCASE/* → 301 → lowercase
 * - * → static assets (env.ASSETS.fetch)
 */

// /events telemetry — closed event set, max 4KB body, log to console (CF Log Push)
const EVENTS_ALLOWED = new Set([
  // /simulate Quick Start funnel
  "sim.view",
  "sim.preset_click",
  "sim.run_succeeded",
  "sim.run_failed",
  "sim.skill_switch",
  "sim.csv_download",
  // CTA funnel
  "cta.connect_clicked",
  "cta.learn_more_clicked",
  "cta.sticky_clicked",
  // A/B variant enrollment
  "ab.enroll",
  "ab.convert",
]);
const EVENTS_MAX_BODY = 4 * 1024;

async function handleEventsPost(request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > EVENTS_MAX_BODY) {
    return new Response(null, { status: 413 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  if (!body || typeof body !== "object" || typeof body.type !== "string") {
    return new Response("invalid envelope", { status: 400 });
  }
  if (!EVENTS_ALLOWED.has(body.type)) {
    return new Response("unknown event", { status: 400 });
  }
  const cf = request.cf || {};
  const payload =
    body.payload && typeof body.payload === "object"
      ? JSON.stringify(body.payload).slice(0, 1024)
      : null;
  console.log(
    JSON.stringify({
      kind: "pruviq_event",
      type: body.type,
      ts: body.ts || Date.now(),
      country: cf.country || null,
      colo: cf.colo || null,
      ray: request.headers.get("cf-ray") || null,
      referer: request.headers.get("referer") || null,
      payload,
    }),
  );
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

function handleEventsOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "https://pruviq.com",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "600",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /sitemap.xml → /sitemap-index.xml (Astro generates sitemap-index.xml)
    if (url.pathname === "/sitemap.xml") {
      url.pathname = "/sitemap-index.xml";
      return Response.redirect(url.toString(), 301);
    }

    // /events telemetry (2026-04-28 P1 fix — was 405 because functions/ bypassed in Advanced Mode)
    if (url.pathname === "/events") {
      if (request.method === "POST") return handleEventsPost(request);
      if (request.method === "OPTIONS") return handleEventsOptions();
      return new Response("method not allowed", { status: 405 });
    }

    // Proxy /api/* (but do not proxy the docs page at /api or /api/)
    if (/^\/api\/.+/.test(url.pathname)) {
      // Strip the leading /api prefix so https://api.pruviq.com/coins/stats is targeted
      const pathAfterApi = url.pathname.replace(/^\/api/, "");
      const targetUrl = new URL(
        pathAfterApi + url.search,
        "https://api.pruviq.com",
      );

      const headers = new Headers(request.headers);
      // Remove host header so fetch sets the correct host for the API origin
      headers.delete("host");

      const apiReqInit = {
        method: request.method,
        headers,
        body: request.body,
        // Do not follow redirects server-side — return redirects to the client
        redirect: "manual",
      };

      try {
        const resp = await fetch(targetUrl.toString(), apiReqInit);
        return resp;
      } catch (err) {
        return new Response(JSON.stringify({ error: "API unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Redirect /coins/UPPERCASE paths to lowercase (301)
    if (/^\/(?:ko\/)?coins\/[^/]*[A-Z]/.test(url.pathname)) {
      url.pathname = url.pathname.toLowerCase();
      return Response.redirect(url.toString(), 301);
    }

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
};
