// Static-first data configuration
// Static JSON files are refreshed every hour by cron (Binance+CoinGecko → JSON → CDN)
// API server is fallback only (for when CDN is unavailable)
export const API_BASE_URL: string =
  import.meta.env.PUBLIC_PRUVIQ_API_URL || "https://api.pruviq.com";

// Static data paths (refreshed every hour by cron)
export const STATIC_DATA = {
  coinsStats: "/data/coins-stats.json",
  market: "/data/market.json",
  news: "/data/news.json",
  macro: "/data/macro.json",
  strategies: "/data/strategies.json",
  performance: "/data/performance.json",
  builderIndicators: "/data/builder-indicators.json",
  builderPresets: "/data/builder-presets.json",
  demoResults: "/data/demo-results.json",
  comparisonResults: "/data/comparison-results.json",
};

// Max age (ms) before static data is considered stale and API is preferred
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
// Very stale: try API first with longer timeout
const VERY_STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export function isStale(data: any): boolean {
  if (!data?.generated) return false;
  const age = Date.now() - new Date(data.generated).getTime();
  return age > STALE_THRESHOLD_MS;
}

export function dataAgeMs(data: any): number {
  if (!data?.generated) return 0;
  return Math.max(0, Date.now() - new Date(data.generated).getTime());
}

// Static-first fetch: try CDN/static first (fast, no API limits),
// fall back to API if static is unavailable or stale
export async function fetchWithFallback(
  apiPath: string,
  staticPath: string,
): Promise<any> {
  // 1. Try static data first (CDN, always available, updated every 15 min)
  let staticData: any = null;
  try {
    const res = await fetch(staticPath);
    if (res.ok) staticData = await res.json();
  } catch {
    /* ignore */
  }

  // 2. If static is very stale (>1h), try API first with longer timeout
  if (staticData && dataAgeMs(staticData) > VERY_STALE_THRESHOLD_MS) {
    try {
      const res = await fetch(`${API_BASE_URL}${apiPath}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      return await res.json();
    } catch {
      return staticData; // still better than nothing
    }
  }

  // 3. If static is fresh, use it
  if (staticData && !isStale(staticData)) return staticData;

  // 4. Static is missing or mildly stale — try API
  try {
    const res = await fetch(`${API_BASE_URL}${apiPath}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch {
    // 5. API failed — return stale static data if we have it (better than nothing)
    if (staticData) return staticData;
    throw new Error(`Data unavailable: ${staticPath}`);
  }
}

// API-first fetch: try live API first (real-time), fall back to static
export async function fetchLiveFirst(
  apiPath: string,
  staticPath: string,
): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}${apiPath}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch {
    try {
      const res = await fetch(staticPath);
      if (!res.ok) throw new Error(`Static ${res.status}`);
      return await res.json();
    } catch {
      throw new Error(`Data unavailable: ${apiPath} (static: ${staticPath})`);
    }
  }
}
