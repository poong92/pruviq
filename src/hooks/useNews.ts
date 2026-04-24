import { useState, useEffect } from "preact/hooks";
import { STATIC_DATA, fetchWithFallback } from "../config/api";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  category?: string;
  published: string;
  summary: string;
};

type NewsData = {
  items: NewsItem[];
  generated: string;
};

const POLL_MS = 300_000; // 5 minutes

export function useNews() {
  const [news, setNews] = useState<NewsData | null>(null);
  const [error, setError] = useState(false);

  // 2026-04-24: switched from fetchWithFallback (API first) to static-first.
  // The backend /news endpoint only returns crypto sources (Decrypt,
  // CoinTelegraph, CoinDesk, BTC Magazine — 50 items) with no `category`
  // field. The static /data/news.json is regenerated hourly by the data
  // cron and contains 60 items INCLUDING 26 macro items (Bloomberg,
  // MarketWatch, CNBC Economy) with explicit `category: "macro"`. With
  // API-first, users clicking the Macro news tab always got "no results"
  // because API items had no macro category/source. Static is fresh
  // enough for a 5-minute poll cadence; API is now only the rescue path.
  const fetchNews = () => {
    fetch(STATIC_DATA.news)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: NewsData) => {
        setNews(d);
        setError(false);
      })
      .catch(() => {
        // Static miss → fall back to the API (crypto-only, but still
        // better than showing an error).
        fetchWithFallback<NewsData>("/news", STATIC_DATA.news)
          .then((d) => {
            setNews(d);
            setError(false);
          })
          .catch(() => setError(true));
      });
  };

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return { news, error, retry: fetchNews };
}
