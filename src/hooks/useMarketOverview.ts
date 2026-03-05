import { useState, useEffect } from 'preact/hooks';
import { STATIC_DATA, fetchWithFallback } from '../config/api';

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

export function useMarketOverview() {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [error, setError] = useState(false);

  const fetchMarket = () => {
    fetchWithFallback('/market', STATIC_DATA.market)
      .then((d: MarketData) => { setMarket(d); setError(false); })
      .catch(() => setError(true));
  };

  useEffect(() => {
    fetchMarket();
    const id = setInterval(fetchMarket, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return { market, error, retry: fetchMarket };
}
