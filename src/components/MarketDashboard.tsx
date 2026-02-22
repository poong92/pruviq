import { useState, useEffect, useRef } from 'preact/hooks';
import { formatPrice, formatVolume, changeColor, fgColor, timeAgo } from '../utils/format';
import { STATIC_DATA, fetchWithFallback } from '../config/api';

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
    disclaimer: 'Market data is for informational purposes only. Not financial advice. Data refreshed every 15 min.',
    symbol: 'Symbol',
    price: 'Price',
    change: '24h %',
    volume: 'Volume',
    rate: 'Rate',
    readMore: 'Read more',
    searchNews: 'Search news...',
    allSources: 'All',
    lastUpdated: 'Last updated',
    ago: 'ago',
    macroTitle: 'Macro Economic',
    macroIndicators: 'Economic Indicators',
    previous: 'prev',
    current: 'current',
    macroError: 'Failed to load macro data.',
    economicCalendar: 'Economic Calendar',
    calendarNote: 'Powered by TradingView',
    ctaTitle: 'Test a Strategy',
    ctaDesc: 'Use our free strategy builder to backtest on 535+ coins.',
    ctaButton: 'Try Simulator',
    // new i18n keys
    showMore: 'Show all',
    showLess: 'Show less',
    showMoreNews: 'Show more news',
    showLessNews: 'Show less',
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
    disclaimer: '시장 데이터는 정보 제공 목적으로만 제공됩니다. 투자 조언이 아닙니다. 15분마다 자동 갱신.',
    symbol: '심볼',
    price: '가격',
    change: '24h %',
    volume: '거래량',
    rate: '비율',
    readMore: '자세히 보기',
    searchNews: '뉴스 검색...',
    allSources: '전체',
    lastUpdated: '마지막 업데이트',
    ago: '전',
    macroTitle: '거시경제',
    macroIndicators: '경제 지표',
    previous: '이전',
    current: '현재',
    macroError: '거시경제 데이터 로딩 실패.',
    economicCalendar: '경제 캘린더',
    calendarNote: 'TradingView 제공',
    ctaTitle: '전략 테스트',
    ctaDesc: '535개 이상의 코인에서 무료 전략 빌더로 백테스트하세요.',
    ctaButton: '시뮬레이터 시작',
    // new i18n keys
    showMore: '전체 보기',
    showLess: '접기',
    showMoreNews: '더 보기',
    showLessNews: '접기',
  },
};

type MarketMover = { symbol: string; price: number; change_24h: number; volume_24h: number };
type FundingRate = { symbol: string; rate: number; annual_pct: number };
type NewsItem = { title: string; link: string; source: string; published: string; summary: string };

type MacroIndicator = {
  id: string; name: string; value: number; previous?: number;
  unit: string; updated: string; source: string;
};
type MacroData = {
  indicators: MacroIndicator[];
  generated: string;
};

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

/* --- Skeleton Components --- */

function SkeletonCard() {
  return (
    <div className="border border-[--color-border] rounded-lg p-5 bg-[--color-bg-card]">
      <div className="skeleton h-3 w-20 mb-3" />
      <div className="skeleton h-7 w-28 mb-2" />
      <div className="skeleton h-3 w-14" />
    </div>
  );
}

function SkeletonPriceBar() {
  return (
    <div className="flex gap-4 flex-wrap mb-4">
      <div className="flex-1 min-w-[200px] border border-[--color-border] rounded-lg p-3 bg-[--color-bg-card] flex items-center gap-3">
        <div className="skeleton h-4 w-10" />
        <div className="skeleton h-6 w-24" />
        <div className="skeleton h-4 w-16" />
      </div>
      <div className="flex-1 min-w-[200px] border border-[--color-border] rounded-lg p-3 bg-[--color-bg-card] flex items-center gap-3">
        <div className="skeleton h-4 w-10" />
        <div className="skeleton h-6 w-24" />
        <div className="skeleton h-4 w-16" />
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden">
      <div className="px-4 py-3 border-b border-[--color-border]">
        <div className="skeleton h-3 w-24" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-[--color-border] last:border-0">
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

function SkeletonNews() {
  return (
    <div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-[--color-border] last:border-0">
          <div className="skeleton h-4 w-3/4 mb-2" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/* --- Data Components --- */

function StatCard({ label, value, sub, color, style }: { label: string; value: string; sub?: string; color?: string; style?: any }) {
  return (
    <div className="border border-[--color-border] rounded-lg p-4 bg-[--color-bg-card] card-hover" style={style}>
      <div className="text-[11px] text-[--color-text-muted] uppercase tracking-wider mb-1.5">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: color || 'var(--color-text)' }}>{value}</div>
      {sub && <div className="text-xs text-[--color-text-muted] mt-1">{sub}</div>}
    </div>
  );
}

function MoverTable({ title, movers, l }: { title: string; movers: MarketMover[]; l: typeof labels.en }) {
  return (
    <div className="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden overflow-x-auto">
      <div className="px-4 py-3 border-b border-[--color-border] text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">
        {title}
      </div>
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="border-b border-[--color-border]">
            <th className="text-left px-4 py-2 text-[--color-text-muted] font-medium text-[11px]">{l.symbol}</th>
            <th className="text-right px-4 py-2 text-[--color-text-muted] font-medium text-[11px]">{l.price}</th>
            <th className="text-right px-4 py-2 text-[--color-text-muted] font-medium text-[11px]">{l.change}</th>
            <th className="text-right px-4 py-2 text-[--color-text-muted] font-medium text-[11px] hidden md:table-cell">{l.volume}</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((m, i) => (
            <tr key={m.symbol} className="row-hover border-b border-[--color-border] last:border-0">
              <td className="px-4 py-2 font-mono font-medium text-[--color-text]">
                <a href={`/coins/${m.symbol.toLowerCase().replace('usdt', '')}usdt`} className="text-[--color-text] no-underline hover:text-[--color-accent] transition-colors">
                  {m.symbol.replace('USDT', '')}
                </a>
              </td>
              <td className="text-right px-4 py-2 font-mono text-[--color-text-muted]">
                ${formatPrice(m.price)}
              </td>
              <td className="text-right px-4 py-2 font-mono font-semibold" style={{ color: changeColor(m.change_24h) }}>
                {m.change_24h > 0 ? '+' : ''}{m.change_24h.toFixed(2)}%
              </td>
              <td className="text-right px-4 py-2 font-mono text-[--color-text-muted] text-xs hidden md:table-cell">
                {formatVolume(m.volume_24h)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NEWS_SOURCES = ['CoinDesk', 'CoinTelegraph', 'Decrypt', 'Bitcoin Magazine'];
const REFRESH_MS = 300_000; // 5 min (static data refreshed every 15 min)

export default function MarketDashboard({ lang = 'en' }: { lang?: 'en' | 'ko' }) {
  const l = labels[lang] || labels.en;
  const [market, setMarket] = useState<MarketData | null>(null);
  const [news, setNews] = useState<NewsData | null>(null);
  const [marketErr, setMarketErr] = useState(false);
  const [newsErr, setNewsErr] = useState(false);
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [macroErr, setMacroErr] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshAgo, setRefreshAgo] = useState('');

  // Expansion states
  const [gainersExpanded, setGainersExpanded] = useState(false);
  const [losersExpanded, setLosersExpanded] = useState(false);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [fundingExpanded, setFundingExpanded] = useState(false);

  // Price flash tracking
  const prevBtc = useRef<number>(0);
  const prevEth = useRef<number>(0);
  const [btcFlash, setBtcFlash] = useState('');
  const [ethFlash, setEthFlash] = useState('');

  const fetchMarket = () => {
    fetchWithFallback('/market', STATIC_DATA.market)
      .then((d: MarketData) => {
        // Price flash detection
        if (prevBtc.current && d.btc_price !== prevBtc.current) {
          setBtcFlash(d.btc_price > prevBtc.current ? 'flash-up' : 'flash-down');
          setTimeout(() => setBtcFlash(''), 600);
        }
        if (prevEth.current && d.eth_price !== prevEth.current) {
          setEthFlash(d.eth_price > prevEth.current ? 'flash-up' : 'flash-down');
          setTimeout(() => setEthFlash(''), 600);
        }
        prevBtc.current = d.btc_price;
        prevEth.current = d.eth_price;
        setMarket(d);
        setMarketErr(false);
        setLastRefresh(new Date());
      })
      .catch(() => setMarketErr(true));
  };

  const fetchNews = () => {
    fetchWithFallback('/news', STATIC_DATA.news)
      .then(d => { setNews(d); setNewsErr(false); })
      .catch(() => setNewsErr(true));
  };

  const fetchMacro = () => {
    // Macro endpoint removed - set empty data without error
    setMacro({ indicators: [], generated: "" });
  };

  useEffect(() => {
    fetchMarket();
    fetchNews();
    fetchMacro();
    const interval = setInterval(() => { fetchMarket(); fetchNews(); }, REFRESH_MS);
    const macroInterval = setInterval(fetchMacro, 300_000); // 5 min
    return () => { clearInterval(interval); clearInterval(macroInterval); };
  }, []);

  // Live "updated X ago" counter
  useEffect(() => {
    const tick = () => {
      if (!lastRefresh) return;
      const sec = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
      if (sec < 60) setRefreshAgo(`${sec}s`);
      else setRefreshAgo(`${Math.floor(sec / 60)}m`);
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [lastRefresh]);

  const filteredNews = news?.items.filter(item => {
    if (sourceFilter && item.source !== sourceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(q) || (item.summary || '').toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  // Display helpers: show dash (—) when certain market values are 0 or missing
  const totalMcapDisplay = market && market.total_market_cap_b ? `$${market.total_market_cap_b.toFixed(0)}B` : '—';
  const btcDomDisplay = market && market.btc_dominance ? `${market.btc_dominance}%` : '—';
  const volume24hDisplay = market && market.total_volume_24h_b ? `$${market.total_volume_24h_b.toFixed(0)}B` : '—';

  // Fear & Greed subtle background tint and fill color
  let fearGreedBg: string | undefined = undefined;
  let fearGreedFill: string | undefined = undefined;
  if (market && market.fear_greed_index != null) {
    const fgi = market.fear_greed_index;
    if (fgi >= 0 && fgi <= 25) { fearGreedBg = 'rgba(255,0,0,0.08)'; fearGreedFill = 'rgb(255,0,0)'; }
    else if (fgi <= 50) { fearGreedBg = 'rgba(255,140,0,0.08)'; fearGreedFill = 'rgb(255,140,0)'; }
    else if (fgi <= 75) { fearGreedBg = 'rgba(144,238,144,0.08)'; fearGreedFill = 'rgb(144,238,144)'; }
    else { fearGreedBg = 'rgba(0,128,0,0.08)'; fearGreedFill = 'rgb(0,128,0)'; }
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Loading skeleton */}
      {!market && !marketErr && (
        <div>
          <SkeletonPriceBar />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <SkeletonTable />
            <SkeletonTable />
          </div>
        </div>
      )}

      {marketErr && (
        <div className="text-center py-10">
          <p className="font-mono text-sm text-[--color-red] mb-3">{l.error}</p>
          <button
            onClick={() => { setMarketErr(false); fetchMarket(); }}
            className="px-4 py-2 rounded-lg border border-[--color-border] bg-[--color-bg-card] text-[--color-text] font-mono text-sm cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
          >
            {lang === 'ko' ? '다시 시도' : 'Retry'}
          </button>
        </div>
      )}

      {market && (
        <div className="fade-in">
          {/* BTC + ETH Price Bar */}
          <div className="flex gap-4 flex-wrap mb-4">
            <div className={`flex items-center gap-3 border border-[--color-border] rounded-lg py-3 px-5 bg-[--color-bg-card] flex-1 min-w-[200px] ${btcFlash}`}>
              <span className="text-sm font-semibold text-[--color-btc]">BTC</span>
              <span className="text-xl font-bold font-mono text-[--color-text]">
                ${market.btc_price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm font-semibold font-mono" style={{ color: changeColor(market.btc_change_24h) }}>
                {market.btc_change_24h > 0 ? '+' : ''}{market.btc_change_24h.toFixed(2)}%
              </span>
            </div>
            <div className={`flex items-center gap-3 border border-[--color-border] rounded-lg py-3 px-5 bg-[--color-bg-card] flex-1 min-w-[200px] ${ethFlash}`}>
              <span className="text-sm font-semibold text-[--color-eth]">ETH</span>
              <span className="text-xl font-bold font-mono text-[--color-text]">
                ${market.eth_price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm font-semibold font-mono" style={{ color: changeColor(market.eth_change_24h) }}>
                {market.eth_change_24h > 0 ? '+' : ''}{market.eth_change_24h.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {/* Fear & Greed with gauge */}
            <div className="border border-[--color-border] rounded-lg p-4 bg-[--color-bg-card] card-hover" style={fearGreedBg ? { backgroundColor: fearGreedBg } : undefined}>
              <div className="text-[11px] text-[--color-text-muted] uppercase tracking-wider mb-1.5">{l.fearGreed}</div>
              <div className="text-2xl font-bold font-mono" style={{ color: fgColor(market.fear_greed_index) }}>{`${market.fear_greed_index} / 100`}</div>

              {/* Gauge bar */}
              <div className="w-full mt-3">
                <div className="w-full bg-[--color-bg-hover] rounded-full h-1.5 overflow-hidden" role="img" aria-label={`Fear and Greed gauge ${market.fear_greed_index} out of 100`}>
                  <div style={{ width: `${Math.max(0, Math.min(100, market.fear_greed_index))}%`, backgroundColor: fearGreedFill, height: '6px' }} className="rounded-full transition-all" />
                </div>
              </div>

              <div className="text-xs text-[--color-text-muted] mt-2">{market.fear_greed_label}</div>
            </div>

            <StatCard label={l.totalMcap} value={totalMcapDisplay} />
            <StatCard label={l.btcDom} value={btcDomDisplay} />
            <StatCard label={l.volume24h} value={volume24hDisplay} />
          </div>

          {/* Top Gainers / Losers (collapsible) */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <MoverTable title={l.topGainers} movers={market.top_gainers.slice(0, gainersExpanded ? 20 : 3)} l={l} />
              {market.top_gainers.length > 3 && (
                <div className="text-center">
                  <button
                    onClick={() => setGainersExpanded(e => !e)}
                    className="text-xs text-[--color-accent] py-2 cursor-pointer"
                  >
                    {gainersExpanded ? l.showLess : l.showMore}
                  </button>
                </div>
              )}
            </div>

            <div>
              <MoverTable title={l.topLosers} movers={market.top_losers.slice(0, losersExpanded ? 20 : 3)} l={l} />
              {market.top_losers.length > 3 && (
                <div className="text-center">
                  <button
                    onClick={() => setLosersExpanded(e => !e)}
                    className="text-xs text-[--color-accent] py-2 cursor-pointer"
                  >
                    {losersExpanded ? l.showLess : l.showMore}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Funding Rates */}
          {market.extreme_funding.length > 0 && (
            <div className="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-[--color-border] text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">
                {l.fundingRates}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] overflow-x-auto">
                {(fundingExpanded ? market.extreme_funding.slice(0, 20) : market.extreme_funding.slice(0, 5)).map(f => (
                  <div key={f.symbol} className="flex justify-between items-center px-4 py-2.5 border-b border-[--color-border] last:border-0">
                    <a href={`${lang === 'ko' ? '/ko' : ''}/coins/${f.symbol.toLowerCase().replace('usdt', '')}usdt`} className="font-mono text-[13px] font-medium text-[--color-text-muted] no-underline hover:text-[--color-accent] transition-colors">
                      {f.symbol.replace('USDT', '')}
                    </a>
                    <div className="text-right">
                      <span className="font-mono text-[13px] font-semibold" style={{ color: changeColor(f.rate) }}>
                        {f.rate > 0 ? '+' : ''}{f.rate.toFixed(4)}%
                      </span>
                      <div className="text-[0.6875rem] text-[--color-text-muted]">
                        {l.annual}: {f.annual_pct > 0 ? '+' : ''}{f.annual_pct.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {market.extreme_funding.length > 5 && (
                <div className="text-center">
                  <button
                    onClick={() => setFundingExpanded(e => !e)}
                    className="text-xs text-[--color-accent] py-2 cursor-pointer"
                  >
                    {fundingExpanded ? l.showLess : l.showMore}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Top Gainers / Losers already rendered above */}

          {/* News Feed */}
          <div className="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-[--color-border] flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mr-auto">
                {l.latestNews}
              </span>
              <input
                type="text"
                placeholder={l.searchNews}
                value={searchQuery}
                onInput={(e: Event) => setSearchQuery((e.target as HTMLInputElement).value)}
                className="bg-[--color-bg-hover] border border-[--color-border] rounded-md px-2.5 py-1 text-xs text-[--color-text] outline-none w-44 font-sans focus:border-[--color-accent] transition-colors"
              />
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSourceFilter('')}
                  aria-pressed={sourceFilter === ''}
                  className={`px-2 py-1 text-[0.6875rem] rounded font-semibold cursor-pointer border-none transition-colors min-h-[44px] ${
                    !sourceFilter ? 'bg-[--color-accent] text-[--color-bg]' : 'bg-[--color-bg-hover] text-[--color-text-muted] hover:text-[--color-text]'
                  }`}
                >{l.allSources}</button>
                {NEWS_SOURCES.map(s => (
                  <button
                    key={s}
                    onClick={() => setSourceFilter(sourceFilter === s ? '' : s)}
                    aria-pressed={sourceFilter === s}
                    className={`px-2 py-1 text-[0.6875rem] rounded font-semibold cursor-pointer border-none whitespace-nowrap transition-colors min-h-[44px] ${
                      sourceFilter === s ? 'bg-[--color-accent] text-[--color-bg]' : 'bg-[--color-bg-hover] text-[--color-text-muted] hover:text-[--color-text]'
                    }`}
                  >{s.replace('Bitcoin Magazine', 'BTC Mag')}</button>
                ))}
              </div>
            </div>

            {!news && !newsErr && <SkeletonNews />}
            {newsErr && (
              <div className="text-center py-8">
                <p className="font-mono text-sm text-[--color-red] mb-3">{l.newsError}</p>
                <button
                  onClick={() => { setNewsErr(false); fetchNews(); }}
                  className="px-4 py-2 rounded-lg border border-[--color-border] bg-[--color-bg-card] text-[--color-text] font-mono text-sm cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
                >
                  {lang === 'ko' ? '다시 시도' : 'Retry'}
                </button>
              </div>
            )}
            {news && filteredNews.length > 0 && (
              <div className="fade-in">
                {(newsExpanded ? filteredNews : filteredNews.slice(0, 5)).map((item, i) => (
                  <a
                    key={`${item.source}-${i}`}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3 border-b border-[--color-border] last:border-0 no-underline text-inherit row-hover"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[--color-text] leading-snug mb-1 truncate">
                          {item.title}
                        </div>
                        {item.summary && (
                          <div className="text-xs text-[--color-text-muted] leading-snug truncate">
                            {item.summary}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[0.6875rem] text-[--color-accent] font-semibold tracking-wide">{item.source}</div>
                        <div className="text-[0.6875rem] text-[--color-text-muted] mt-0.5">{timeAgo(item.published)}</div>
                      </div>
                    </div>
                  </a>
                ))}

                {filteredNews.length > 5 && (
                  <div className="text-center">
                    <button onClick={() => setNewsExpanded(e => !e)} className="text-xs text-[--color-accent] py-2 cursor-pointer">
                      {newsExpanded ? l.showLessNews : l.showMoreNews}
                    </button>
                  </div>
                )}
              </div>
            )}
            {news && filteredNews.length === 0 && (
              <div className="text-center py-8 text-[--color-text-muted] text-[13px]">
                {lang === 'ko' ? '검색 결과가 없습니다.' : 'No results found.'}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="mt-8 p-6 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm mb-1">{l.ctaTitle}</h3>
                <p className="text-[--color-text-muted] text-xs">{l.ctaDesc}</p>
              </div>
              <a href={lang === 'ko' ? '/ko/simulate' : '/simulate'} className="shrink-0 bg-[--color-accent] text-[--color-bg] px-5 py-2.5 rounded-lg font-semibold text-sm no-underline hover:opacity-90 transition-opacity whitespace-nowrap">
                {l.ctaButton} &rarr;
              </a>
            </div>
          </div>

          {/* Last Updated + Disclaimer */}
          {lastRefresh && (
            <p className="text-[11px] text-[--color-text-muted] text-center mt-4 font-mono">
              {l.lastUpdated}: {refreshAgo} {l.ago}
            </p>
          )}
          <p className="text-[11px] text-[--color-text-muted] text-center mt-1 opacity-60">{l.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
