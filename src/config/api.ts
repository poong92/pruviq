// Static-first data configuration
// Static JSON files are refreshed every hour by cron (Binance+CoinGecko → JSON → CDN)
// API server is fallback only (for when CDN is unavailable)
export const API_BASE_URL: string =
  import.meta.env.PUBLIC_PRUVIQ_API_URL || 'https://api.pruviq.com';

// Static data paths (refreshed every hour by cron)
export const STATIC_DATA = {
  coinsStats: '/data/coins-stats.json',
  market: '/data/market.json',
  news: '/data/news.json',
  macro: '/data/macro.json',
  strategies: '/data/strategies.json',
  performance: '/data/performance.json',
  builderIndicators: '/data/builder-indicators.json',
  builderPresets: '/data/builder-presets.json',
  demoResults: '/data/demo-results.json',
  comparisonResults: '/data/comparison-results.json',
};

// Static-first fetch: try CDN/static first (fast, no API limits),
// fall back to API server only if static is unavailable
export async function fetchWithFallback(apiPath: string, staticPath: string): Promise<any> {
  // 1. Try static data first (CDN, always available, updated every 15 min)
  try {
    const res = await fetch(staticPath);
    if (!res.ok) throw new Error(`Static ${res.status}`);
    return await res.json();
  } catch {
    // 2. Fallback to API (if CDN/static fails)
    try {
      const res = await fetch(`${API_BASE_URL}${apiPath}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      return await res.json();
    } catch {
      throw new Error(`Data unavailable: ${staticPath}`);
    }
  }
}
