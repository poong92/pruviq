// Load Cloudflare Insights beacon after page is idle or loaded to avoid blocking critical path
(function () {
  try {
    const token = (window?.PRUVIQ?.cfToken) || (new URLSearchParams(window.location.search).get('cf_token')) || null;
    // If token is provided via data attribute on body (SSR), prefer that
    const tokenFromDom = document?.querySelector('meta[name="cf-beacon-token"]')?.getAttribute('content');
    const cfToken = tokenFromDom || token || (window && window.__CF_BEACON_TOKEN__);

    function insertBeacon() {
      if (!cfToken) return;
      const s = document.createElement('script');
      s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
      s.defer = true;
      s.setAttribute('data-cf-beacon', JSON.stringify({ token: cfToken }));
      document.head.appendChild(s);
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(function () {
        insertBeacon();
      }, { timeout: 3000 });
    } else {
      window.addEventListener('load', insertBeacon, { once: true, passive: true });
      // Fallback: after 3s
      setTimeout(insertBeacon, 3000);
    }
  } catch (e) {
    // silently fail — analytics non-critical
    console.error && console.debug && console.debug('cf-beacon-loader error', e);
  }
})();
