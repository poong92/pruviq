/**
 * Cloudflare Pages Advanced Mode Worker
 * - Handles case-insensitive coin URL redirects (e.g. /coins/BTCUSDT/ → /coins/btcusdt/)
 * - Proxies /api/* requests (only when there is a path after /api) to https://api.pruviq.com
 * - Passes all other requests through to static assets
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /sitemap.xml → /sitemap-index.xml (Astro generates sitemap-index.xml)
    if (url.pathname === '/sitemap.xml') {
      url.pathname = '/sitemap-index.xml';
      return Response.redirect(url.toString(), 301);
    }

    // Proxy /api/* (but do not proxy the docs page at /api or /api/)
    if (/^\/api\/.+/.test(url.pathname)) {
      // Strip the leading /api prefix so https://api.pruviq.com/coins/stats is targeted
      const pathAfterApi = url.pathname.replace(/^\/api/, '');
      const targetUrl = new URL(pathAfterApi + url.search, 'https://api.pruviq.com');

      const headers = new Headers(request.headers);
      // Remove host header so fetch sets the correct host for the API origin
      headers.delete('host');

      const apiReqInit = {
        method: request.method,
        headers,
        body: request.body,
        // Do not follow redirects server-side — return redirects to the client
        redirect: 'manual'
      };

      try {
        const resp = await fetch(targetUrl.toString(), apiReqInit);
        return resp;
      } catch (err) {
        return new Response(JSON.stringify({ error: 'API unavailable' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
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
