/**
 * Cloudflare Pages Advanced Mode Worker
 * - Handles case-insensitive coin URL redirects (e.g. /coins/BTCUSDT/ → /coins/btcusdt/)
 * - Proxies /api/* requests (except exact /api) to https://api.pruviq.com
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

    // Proxy /api/* (but do not proxy the docs page at /api)
    if (url.pathname.startsWith('/api/')) {
      // Construct target URL on the API host
      const targetUrl = new URL(url.pathname + url.search, 'https://api.pruviq.com');

      // Forward the incoming request to the API host
      const apiReqInit = {
        method: request.method,
        headers: new Headers(request.headers),
        body: request.body,
        redirect: 'follow'
      };
      // Remove host header so fetch sets the correct host
      apiReqInit.headers.delete('host');

      const resp = await fetch(targetUrl.toString(), apiReqInit);
      return resp;
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
