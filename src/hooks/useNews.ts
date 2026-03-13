import { useState, useEffect } from 'preact/hooks';
import { STATIC_DATA, fetchWithFallback } from '../config/api';

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

  const fetchNews = () => {
    fetchWithFallback<NewsData>('/news', STATIC_DATA.news)
      .then((d) => { setNews(d); setError(false); })
      .catch(() => setError(true));
  };

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return { news, error, retry: fetchNews };
}
