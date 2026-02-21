import { useState, useEffect } from 'preact/hooks';
import { formatPrice, formatVolume } from '../utils/format';
import { STATIC_DATA, fetchWithFallback } from '../config/api';
import MiniSparkline from './MiniSparkline';

interface CoinRow {
  symbol: string;
  name: string;
  image: string;
  price: number;
  change_1h: number;
  change_24h: number;
  change_7d: number;
  market_cap: number;
  market_cap_rank: number | null;
  volume_24h: number;
  sparkline_7d: number[];
}

interface StatsData {
  generated: string;
  total_coins: number;
  coins: CoinRow[];
}

const PER_PAGE = 50;

const labels = {
  en: {
    search: 'Search coins...',
    coin: 'Coin',
    price: 'Price',
    h1: '1h',
    h24: '24h',
    d7: '7d',
    mcap: 'Market Cap',
    volume: 'Volume (24h)',
    chart: 'Last 7 Days',
    loading: 'Loading coin data...',
    error: 'Failed to load coin data.',
    noResults: 'No coins match your search.',
    showing: (from: number, to: number, total: number) => `${from}-${to} of ${total}`,
  },
  ko: {
    search: '코인 검색...',
    coin: '코인',
    price: '가격',
    h1: '1h',
    h24: '24h',
    d7: '7d',
    mcap: '시가총액',
    volume: '거래량 (24h)',
    chart: '7일 차트',
    loading: '코인 데이터 로딩 중...',
    error: '코인 데이터 로딩 실패.',
    noResults: '검색 결과가 없습니다.',
    showing: (from: number, to: number, total: number) => `${from}-${to} / ${total}`,
  },
};

type SortKey = 'symbol' | 'price' | 'change_1h' | 'change_24h' | 'change_7d' | 'market_cap' | 'volume_24h';

function formatMarketCap(v: number | null): string {
  if (v == null || v === 0) return '-';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function ChangeCell({ value, className = '' }: { value: number | null; className?: string }) {
  if (value == null) return <td class={`px-2 py-2.5 text-right text-[--color-text-muted] ${className}`}>-</td>;
  const color = value >= 0 ? 'text-[--color-up]' : 'text-[--color-down]';
  const arrow = value >= 0 ? '\u25B2' : '\u25BC';
  return (
    <td class={`px-2 py-2.5 text-right ${color} ${className}`}>
      <span class="text-[0.625rem]">{arrow}</span> {Math.abs(value).toFixed(1)}%
    </td>
  );
}

function CoinLogo({ image, symbol }: { image: string; symbol: string }) {
  const letter = symbol.charAt(0);
  if (!image) {
    return (
      <div class="w-6 h-6 rounded-full bg-[--color-border] flex items-center justify-center text-[0.625rem] font-bold text-[--color-text-muted] flex-shrink-0">
        {letter}
      </div>
    );
  }
  return (
    <img
      src={image}
      alt=""
      width="24"
      height="24"
      loading="lazy"
      class="rounded-full flex-shrink-0"
      style="background: var(--color-border)"
    />
  );
}

function SkeletonRow() {
  return (
    <tr class="border-b border-[--color-border]">
      <td class="px-2 py-3 text-center"><div class="skeleton h-3 w-5 mx-auto" /></td>
      <td class="px-2 py-3"><div class="flex items-center gap-2"><div class="skeleton w-6 h-6 rounded-full" /><div class="skeleton h-4 w-20" /></div></td>
      <td class="px-2 py-3 text-right"><div class="skeleton h-3 w-16 ml-auto" /></td>
      <td class="px-2 py-3 text-right hidden lg:table-cell"><div class="skeleton h-3 w-12 ml-auto" /></td>
      <td class="px-2 py-3 text-right"><div class="skeleton h-3 w-12 ml-auto" /></td>
      <td class="px-2 py-3 text-right hidden lg:table-cell"><div class="skeleton h-3 w-12 ml-auto" /></td>
      <td class="px-2 py-3 text-right hidden md:table-cell"><div class="skeleton h-3 w-16 ml-auto" /></td>
      <td class="px-2 py-3 text-right hidden md:table-cell"><div class="skeleton h-3 w-14 ml-auto" /></td>
      <td class="px-2 py-3 hidden lg:table-cell"><div class="skeleton h-6 w-[120px] ml-auto" /></td>
    </tr>
  );
}

export default function CoinListTable({ lang = 'en' }: { lang?: 'en' | 'ko' }) {
  const t = labels[lang] || labels.en;
  const [data, setData] = useState<CoinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('market_cap');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchWithFallback('/coins/stats', STATIC_DATA.coinsStats)
      .then((json: StatsData) => {
        setData(json.coins || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div>
        <div class="mb-4"><div class="skeleton h-10 w-80 max-w-full rounded-lg" /></div>
        <div class="overflow-x-auto border border-[--color-border] rounded-xl bg-[--color-bg-card]">
          <table class="w-full border-collapse font-mono text-[0.8125rem]">
            <thead>
              <tr>
                <th class="px-2 py-2 w-10 border-b border-[--color-border]" />
                {[t.coin, t.price, t.h1, t.h24, t.d7, t.mcap, t.volume, t.chart].map((h, i) => (
                  <th key={i} class="px-2 py-2 text-left font-mono text-[0.6875rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="py-8 text-center">
        <p class="font-mono text-sm text-[--color-red] mb-3">{t.error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchWithFallback('/coins/stats', STATIC_DATA.coinsStats)
              .then((json: StatsData) => { setData(json.coins || []); setLoading(false); })
              .catch(err => { setError(err.message); setLoading(false); });
          }}
          class="px-4 py-2 rounded-lg border border-[--color-border] bg-[--color-bg-card] text-[--color-text] font-mono text-sm cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
        >
          {lang === 'ko' ? '다시 시도' : 'Retry'}
        </button>
      </div>
    );
  }

  const filtered = data.filter(c => {
    const q = search.toLowerCase();
    return c.symbol.toLowerCase().includes(q) || (c.name && c.name.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'string') return sortDesc ? (bVal as string).localeCompare(aVal) : aVal.localeCompare(bVal as string);
    return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
  });

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const pageItems = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDesc(!sortDesc);
    else { setSortBy(key); setSortDesc(true); }
    setPage(0);
  };

  const basePath = lang === 'ko' ? '/ko/coins' : '/coins';

  const thCls = (key: SortKey, extra = '') =>
    `px-2 py-2 cursor-pointer select-none font-mono text-[0.6875rem] tracking-wider uppercase whitespace-nowrap border-b border-[--color-border] ${extra} ${sortBy === key ? 'text-[--color-accent]' : 'text-[--color-text-muted]'}`;

  const arrow = (key: SortKey) => sortBy === key ? (sortDesc ? ' \u25BC' : ' \u25B2') : '';

  return (
    <div class="fade-in">
      {/* Search */}
      <div class="mb-4">
        <input
          type="text"
          placeholder={t.search}
          value={search}
          onInput={(e: Event) => { setSearch((e.target as HTMLInputElement).value); setPage(0); }}
          class="w-full max-w-xs px-4 py-2.5 bg-[--color-bg-card] border border-[--color-border] rounded-lg text-[--color-text] font-mono text-sm outline-none focus:border-[--color-accent] transition-colors"
        />
      </div>

      {/* Table */}
      <div class="overflow-x-auto border border-[--color-border] rounded-xl bg-[--color-bg-card]">
        <table class="w-full border-collapse font-mono text-[0.8125rem]">
          <thead>
            <tr>
              <th class="px-2 py-2 text-center font-mono text-[0.6875rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted] w-10 cursor-default select-none">#</th>
              <th class={thCls('symbol', 'text-left min-w-[160px]')} onClick={() => handleSort('symbol')}>{t.coin}{arrow('symbol')}</th>
              <th class={thCls('price', 'text-right')} onClick={() => handleSort('price')}>{t.price}{arrow('price')}</th>
              <th class={thCls('change_1h', 'text-right hidden lg:table-cell')} onClick={() => handleSort('change_1h')}>{t.h1}{arrow('change_1h')}</th>
              <th class={thCls('change_24h', 'text-right')} onClick={() => handleSort('change_24h')}>{t.h24}{arrow('change_24h')}</th>
              <th class={thCls('change_7d', 'text-right hidden lg:table-cell')} onClick={() => handleSort('change_7d')}>{t.d7}{arrow('change_7d')}</th>
              <th class={thCls('market_cap', 'text-right hidden md:table-cell')} onClick={() => handleSort('market_cap')}>{t.mcap}{arrow('market_cap')}</th>
              <th class={thCls('volume_24h', 'text-right hidden md:table-cell')} onClick={() => handleSort('volume_24h')}>{t.volume}{arrow('volume_24h')}</th>
              <th class="px-2 py-2 text-center font-mono text-[0.6875rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted] hidden lg:table-cell cursor-default select-none w-[140px]">{t.chart}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr><td colSpan={9} class="py-8 text-center text-[--color-text-muted]">{t.noResults}</td></tr>
            )}
            {pageItems.map((coin, i) => {
              const rank = page * PER_PAGE + i + 1;
              const coinUrl = `${basePath}/${coin.symbol.toLowerCase()}`;
              const sparkPositive = (coin.change_7d ?? coin.change_24h ?? 0) >= 0;

              return (
                <tr
                  key={coin.symbol}
                  onClick={(e: MouseEvent) => { if (!(e.target as HTMLElement).closest('a')) window.location.href = coinUrl; }}
                  class="cursor-pointer border-b border-[--color-border] row-hover"
                >
                  {/* # */}
                  <td class="px-2 py-2.5 text-center text-[--color-text-muted] text-[0.6875rem]">{rank}</td>

                  {/* Coin: logo + symbol + name */}
                  <td class="px-2 py-2.5 whitespace-nowrap">
                    <a href={coinUrl} class="flex items-center gap-2.5 hover:text-[--color-accent] transition-colors">
                      <CoinLogo image={coin.image} symbol={coin.symbol} />
                      <div class="flex items-center gap-1.5">
                        <span class="font-semibold">{coin.symbol}</span>
                        {coin.name && <span class="text-[--color-text-muted] text-[0.6875rem] hidden sm:inline">{coin.name}</span>}
                      </div>
                    </a>
                  </td>

                  {/* Price */}
                  <td class="px-2 py-2.5 text-right tabular-nums">${formatPrice(coin.price)}</td>

                  {/* 1h */}
                  <ChangeCell value={coin.change_1h} className="hidden lg:table-cell" />

                  {/* 24h */}
                  <ChangeCell value={coin.change_24h} />

                  {/* 7d */}
                  <ChangeCell value={coin.change_7d} className="hidden lg:table-cell" />

                  {/* Market Cap */}
                  <td class="px-2 py-2.5 text-right text-[--color-text-muted] hidden md:table-cell tabular-nums">{formatMarketCap(coin.market_cap)}</td>

                  {/* Volume */}
                  <td class="px-2 py-2.5 text-right text-[--color-text-muted] hidden md:table-cell tabular-nums">{formatVolume(coin.volume_24h)}</td>

                  {/* 7d Chart */}
                  <td class="px-2 py-2.5 hidden lg:table-cell">
                    {coin.sparkline_7d && coin.sparkline_7d.length > 1
                      ? <MiniSparkline data={coin.sparkline_7d} width={120} height={32} positive={sparkPositive} />
                      : <span class="text-[--color-text-muted]">-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div class="flex justify-between items-center mt-4 font-mono text-xs">
          <span class="text-[--color-text-muted]">
            {t.showing(page * PER_PAGE + 1, Math.min((page + 1) * PER_PAGE, sorted.length), sorted.length)}
          </span>
          <div class="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              class={`px-3 py-1.5 border border-[--color-border] rounded-md bg-transparent font-mono text-xs transition-colors min-h-[44px] min-w-[44px] ${page === 0 ? 'text-[--color-text-muted] cursor-default' : 'text-[--color-text] hover:border-[--color-accent] cursor-pointer'}`}
            >
              &lt;
            </button>
            <span class="px-2 py-1.5 text-[--color-text-muted]">
              {page + 1}/{totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              class={`px-3 py-1.5 border border-[--color-border] rounded-md bg-transparent font-mono text-xs transition-colors min-h-[44px] min-w-[44px] ${page >= totalPages - 1 ? 'text-[--color-text-muted] cursor-default' : 'text-[--color-text] hover:border-[--color-accent] cursor-pointer'}`}
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
