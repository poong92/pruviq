import { useState, useEffect } from 'preact/hooks';

const API_URL = import.meta.env.PUBLIC_PRUVIQ_API_URL || '';

const labels = {
  en: {
    tag: 'MARKET OVERVIEW',
    title: 'Market Dashboard',
    fearGreed: 'Fear & Greed',
    totalMcap: 'Total Market Cap',
    btcDom: 'BTC Dominance',
    volume24h: '24h Volume',
    topGainers: 'Top Gainers',
    topLosers: 'Top Losers',
    fundingRates: 'Extreme Funding Rates',
    annual: 'Annual',
    latestNews: 'Latest News',
    loading: 'Loading market data...',
    error: 'Failed to load market data.',
    newsLoading: 'Loading news...',
    newsError: 'Failed to load news.',
    updated: 'Updated',
    disclaimer: 'Market data is for informational purposes only. Not financial advice. Refreshed every 5 min.',
    symbol: 'Symbol',
    price: 'Price',
    change: '24h %',
    volume: 'Volume',
    rate: 'Rate',
    readMore: 'Read more',
  },
  ko: {
    tag: '시장 현황',
    title: '시장 대시보드',
    fearGreed: '공포/탐욕 지수',
    totalMcap: '총 시가총액',
    btcDom: 'BTC 도미넌스',
    volume24h: '24시간 거래량',
    topGainers: '상승 TOP 10',
    topLosers: '하락 TOP 10',
    fundingRates: '극단 펀딩 비율',
    annual: '연환산',
    latestNews: '최신 뉴스',
    loading: '시장 데이터 로딩 중...',
    error: '시장 데이터 로딩 실패.',
    newsLoading: '뉴스 로딩 중...',
    newsError: '뉴스 로딩 실패.',
    updated: '업데이트',
    disclaimer: '시장 데이터는 정보 제공 목적으로만 제공됩니다. 투자 조언이 아닙니다. 5분마다 갱신.',
    symbol: '심볼',
    price: '가격',
    change: '24h %',
    volume: '거래량',
    rate: '비율',
    readMore: '자세히',
  },
};

type MarketMover = { symbol: string; price: number; change_24h: number; volume_24h: number };
type FundingRate = { symbol: string; rate: number; annual_pct: number };
type NewsItem = { title: string; link: string; source: string; published: string; summary: string };

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
  top_gainers: MarketMover[];
  top_losers: MarketMover[];
  extreme_funding: FundingRate[];
  generated: string;
};

type NewsData = {
  items: NewsItem[];
  generated: string;
};

function formatPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 3 });
  return p.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fgColor(idx: number): string {
  if (idx <= 25) return '#ea3943';
  if (idx <= 45) return '#ea8c00';
  if (idx <= 55) return '#c8c8c8';
  if (idx <= 75) return '#93d900';
  return '#16c784';
}

function changeColor(v: number): string {
  return v >= 0 ? '#16c784' : '#ea3943';
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 60000);
    if (diff < 1) return 'now';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  } catch {
    return '';
  }
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#e8e8e8', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MoverTable({ title, movers, l }: { title: string; movers: MarketMover[]; l: typeof labels.en }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <th style={{ textAlign: 'left', padding: '8px 16px', color: '#666', fontWeight: 500, fontSize: 11 }}>{l.symbol}</th>
            <th style={{ textAlign: 'right', padding: '8px 16px', color: '#666', fontWeight: 500, fontSize: 11 }}>{l.price}</th>
            <th style={{ textAlign: 'right', padding: '8px 16px', color: '#666', fontWeight: 500, fontSize: 11 }}>{l.change}</th>
            <th style={{ textAlign: 'right', padding: '8px 16px', color: '#666', fontWeight: 500, fontSize: 11, display: 'none' }} class="md-show">{l.volume}</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((m, i) => (
            <tr key={m.symbol} style={{ borderBottom: i < movers.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              <td style={{ padding: '8px 16px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: '#e8e8e8' }}>
                <a href={`/coins/${m.symbol.toLowerCase().replace('usdt', '')}usdt`} style={{ color: '#e8e8e8', textDecoration: 'none' }}>
                  {m.symbol.replace('USDT', '')}
                </a>
              </td>
              <td style={{ textAlign: 'right', padding: '8px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#ccc' }}>
                ${formatPrice(m.price)}
              </td>
              <td style={{ textAlign: 'right', padding: '8px 16px', fontFamily: 'JetBrains Mono, monospace', color: changeColor(m.change_24h), fontWeight: 600 }}>
                {m.change_24h > 0 ? '+' : ''}{m.change_24h.toFixed(2)}%
              </td>
              <td style={{ textAlign: 'right', padding: '8px 16px', fontFamily: 'JetBrains Mono, monospace', color: '#888', fontSize: 12, display: 'none' }} class="md-show">
                {formatVolume(m.volume_24h)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarketDashboard({ lang = 'en' }: { lang?: 'en' | 'ko' }) {
  const l = labels[lang] || labels.en;
  const [market, setMarket] = useState<MarketData | null>(null);
  const [news, setNews] = useState<NewsData | null>(null);
  const [marketErr, setMarketErr] = useState(false);
  const [newsErr, setNewsErr] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/market`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setMarket)
      .catch(() => setMarketErr(true));

    fetch(`${API_URL}/news`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setNews)
      .catch(() => setNewsErr(true));
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Market Overview Cards */}
      {!market && !marketErr && (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>{l.loading}</div>
      )}
      {marketErr && (
        <div style={{ textAlign: 'center', padding: 40, color: '#ea3943' }}>{l.error}</div>
      )}
      {market && (
        <>
          {/* BTC + ETH Price Bar */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 20px', flex: '1 1 200px' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#f7931a' }}>BTC</span>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#e8e8e8' }}>
                ${market.btc_price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: changeColor(market.btc_change_24h) }}>
                {market.btc_change_24h > 0 ? '+' : ''}{market.btc_change_24h.toFixed(2)}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 20px', flex: '1 1 200px' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#627eea' }}>ETH</span>
              <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#e8e8e8' }}>
                ${market.eth_price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: changeColor(market.eth_change_24h) }}>
                {market.eth_change_24h > 0 ? '+' : ''}{market.eth_change_24h.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard
              label={l.fearGreed}
              value={`${market.fear_greed_index}`}
              sub={market.fear_greed_label}
              color={fgColor(market.fear_greed_index)}
            />
            <StatCard
              label={l.totalMcap}
              value={`$${market.total_market_cap_b.toFixed(0)}B`}
            />
            <StatCard
              label={l.btcDom}
              value={`${market.btc_dominance}%`}
            />
            <StatCard
              label={l.volume24h}
              value={`$${market.total_volume_24h_b.toFixed(0)}B`}
            />
          </div>

          {/* Top Gainers / Losers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
            <MoverTable title={l.topGainers} movers={market.top_gainers} l={l} />
            <MoverTable title={l.topLosers} movers={market.top_losers} l={l} />
          </div>

          {/* Funding Rates */}
          {market.extreme_funding.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {l.fundingRates}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0 }}>
                {market.extreme_funding.map(f => (
                  <div key={f.symbol} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 500, color: '#ccc' }}>
                      {f.symbol.replace('USDT', '')}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: f.rate >= 0 ? '#16c784' : '#ea3943' }}>
                        {f.rate > 0 ? '+' : ''}{f.rate.toFixed(4)}%
                      </span>
                      <div style={{ fontSize: 10, color: '#666' }}>
                        {l.annual}: {f.annual_pct > 0 ? '+' : ''}{f.annual_pct.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* News Feed */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {l.latestNews}
        </div>
        {!news && !newsErr && (
          <div style={{ textAlign: 'center', padding: 30, color: '#888', fontSize: 13 }}>{l.newsLoading}</div>
        )}
        {newsErr && (
          <div style={{ textAlign: 'center', padding: 30, color: '#ea3943', fontSize: 13 }}>{l.newsError}</div>
        )}
        {news && news.items.length > 0 && (
          <div>
            {news.items.map((item, i) => (
              <a
                key={`${item.source}-${i}`}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  borderBottom: i < news.items.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#e8e8e8', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    {item.summary && (
                      <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.summary}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#00d4aa', fontWeight: 600, letterSpacing: '0.03em' }}>{item.source}</div>
                    <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{timeAgo(item.published)}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p style={{ fontSize: 11, color: '#555', textAlign: 'center', marginTop: 16 }}>{l.disclaimer}</p>

      <style>{`
        @media (min-width: 768px) {
          .md-show { display: table-cell !important; }
        }
      `}</style>
    </div>
  );
}
