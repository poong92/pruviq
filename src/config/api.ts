// Static data fallback configuration
// Components first try API, then fall back to static JSON in /data/
export const API_BASE_URL: string =
  import.meta.env.PUBLIC_PRUVIQ_API_URL || 'https://api.pruviq.com';

// Static data paths (always available, generated at build time)
export const STATIC_DATA = {
  coinsStats: '/data/coins-stats.json',
  market: '/data/market.json',
  news: '/data/news.json',
  strategies: '/data/strategies.json',
  performance: '/data/performance.json',
  builderIndicators: '/data/builder-indicators.json',
  builderPresets: '/data/builder-presets.json',
  demoResults: '/data/demo-results.json',
  comparisonResults: '/data/comparison-results.json',
};

// Fetch with static fallback: try API first, fall back to static JSON
export async function fetchWithFallback(apiPath: string, staticPath: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}${apiPath}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch {
    // Fall back to static data
    const res = await fetch(staticPath);
    if (!res.ok) throw new Error(`Static data unavailable: ${staticPath}`);
    return await res.json();
  }
}
