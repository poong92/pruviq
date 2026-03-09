import { useState, useEffect, useRef } from "preact/hooks";
import {
  STATIC_DATA,
  fetchWithFallback,
  fetchLiveFirst,
  dataAgeMs,
  isVeryStale,
} from "../config/api";

type MarketData = {
  btc_price: number;
  btc_change_24h: number;
  eth_price: number;
  eth_change_24h: number;
  fear_greed_index: number;
  fear_greed_label: string;
  total_market_cap_b: number;
  btc_dominance: number;
  total_volume_24h_b: number;
  top_gainers?: any[];
  top_losers?: any[];
  generated: string;
};

const POLL_MS = 300_000; // 5 minutes
const STALE_POLL_MS = 60_000; // 1 minute when data is stale

export function useMarketOverview() {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [error, setError] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const fetchMarket = () => {
    // When current data is very stale (>1h), use API-first to recover faster
    const fetcher =
      market && isVeryStale(market)
        ? fetchLiveFirst("/market", STATIC_DATA.market)
        : fetchWithFallback("/market", STATIC_DATA.market);
    fetcher
      .then((d: MarketData) => {
        setMarket(d);
        setError(false);
        // Poll faster when data is stale (>30 min old)
        const age = dataAgeMs(d);
        const nextInterval = age > 30 * 60 * 1000 ? STALE_POLL_MS : POLL_MS;
        if (intervalRef.current !== null) clearInterval(intervalRef.current);
        intervalRef.current = window.setInterval(fetchMarket, nextInterval);
      })
      .catch(() => {
        setError(true);
        // Also poll faster on error
        if (intervalRef.current !== null) clearInterval(intervalRef.current);
        intervalRef.current = window.setInterval(fetchMarket, STALE_POLL_MS);
      });
  };

  useEffect(() => {
    fetchMarket();
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  return { market, error, retry: fetchMarket };
}
