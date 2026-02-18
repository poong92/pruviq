import { useState, useEffect } from 'preact/hooks';
import { formatPrice, formatVolume } from '../utils/format';
import { API_BASE_URL } from '../config/api';

interface CoinRow {
  symbol: string;
  price: number;
  change_24h: number;
  volume_24h: number;
  trades: number;
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
}

interface StatsData {
  generated: string;
  strategy: string;
  params: { sl_pct: number; tp_pct: number };
  coins: CoinRow[];
}

const PER_PAGE = 50;

const labels = {
  en: {
    search: 'Search coins...',
    coin: 'Coin',
    price: 'Price',
    change: '24h',
    volume: 'Vol (24h)',
    trades: 'Trades',
    winRate: 'WR',
    pf: 'PF',
    returnPct: 'Return',
    loading: 'Loading coin data...',
    error: 'Failed to load coin data.',
    noResults: 'No coins match your search.',
    showing: (from: number, to: number, total: number) => `${from}-${to} of ${total}`,
    cta: 'BB Squeeze SHORT · SL 10% / TP 8% · 2yr+ backtest',
  },
  ko: {
    search: '코인 검색...',
    coin: '코인',
    price: '가격',
    change: '24h',
    volume: '거래량',
    trades: '거래수',
    winRate: '승률',
    pf: 'PF',
    returnPct: '수익률',
    loading: '코인 데이터 로딩 중...',
    error: '코인 데이터 로딩 실패.',
    noResults: '검색 결과가 없습니다.',
    showing: (from: number, to: number, total: number) => `${from}-${to} / ${total}`,
    cta: 'BB Squeeze SHORT · SL 10% / TP 8% · 2년+ 백테스트',
  },
};

type SortKey = 'symbol' | 'price' | 'change_24h' | 'volume_24h' | 'trades' | 'win_rate' | 'profit_factor' | 'total_return_pct';

function SkeletonRow({ i }: { i: number }) {
  return (
    <tr class="border-b border-[--color-border]">
      <td class="px-2.5 py-3 text-center"><div class="skeleton h-3 w-5 mx-auto" /></td>
      <td class="px-2.5 py-3"><div class="skeleton h-4 w-20" /></td>
      <td class="px-2.5 py-3 text-right"><div class="skeleton h-3 w-16 ml-auto" /></td>
      <td class="px-2.5 py-3 text-right"><div class="skeleton h-3 w-12 ml-auto" /></td>
      <td class="px-2.5 py-3 text-right hidden md:table-cell"><div class="skeleton h-3 w-14 ml-auto" /></td>
      <td class="px-2.5 py-3 text-right hidden md:table-cell"><div class="skeleton h-3 w-8 ml-auto" /></td>
      <td class="px-2.5 py-3 text-right"><div class="skeleton h-3 w-10 ml-auto" /></td>
      <td class="px-2.5 py-3 text-right hidden md:table-cell"><div class="skeleton h-3 w-8 ml-auto" /></td>
      <td class="px-2.5 py-3 text-right"><div class="skeleton h-3 w-12 ml-auto" /></td>
    </tr>
  );
}

export default function CoinListTable({ lang = 'en' }: { lang?: 'en' | 'ko' }) {
  const t = labels[lang] || labels.en;
  const [data, setData] = useState<CoinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('win_rate');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE_URL}/coins/stats`)
      .then(res => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((json: StatsData) => {
        setData(json.coins);
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
        <div class="mb-4">
          <div class="skeleton h-10 w-80 max-w-full rounded-lg" />
        </div>
        <div class="mb-3">
          <div class="skeleton h-3 w-64" />
        </div>
        <div class="overflow-x-auto border border-[--color-border] rounded-xl bg-[--color-bg-card]">
          <table class="w-full border-collapse font-mono text-[0.8125rem]">
            <thead>
              <tr>
                <th class="px-2.5 py-2 text-center font-mono text-[0.625rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted] w-10">#</th>
                <th class="px-2.5 py-2 text-left font-mono text-[0.625rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted]">{t.coin}</th>
                <th class="px-2.5 py-2 text-right font-mono text-[0.625rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted]">{t.price}</th>
                <th class="px-2.5 py-2 text-right font-mono text-[0.625rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted]">{t.change}</th>
                <th class="px-2.5 py-2 text-right font-mono text-[0.625rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted] hidden md:table-cell">{t.volume}</th>
                <th class="px-2.5 py-2 text-right font-mono text-[0.625rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted] hidden md:table-cell">{t.trades}</th>
                <th class="px-2.5 py-2 text-right font-mono text-[0.625rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted]">{t.winRate}</th>
                <th class="px-2.5 py-2 text-right font-mono text-[0.625rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted] hidden md:table-cell">{t.pf}</th>
                <th class="px-2.5 py-2 text-right font-mono text-[0.625rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted]">{t.returnPct}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => <SkeletonRow key={i} i={i} />)}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (error) {
    return <div class="py-8 text-center font-mono text-sm text-[--color-red]">{t.error}</div>;
  }

  const filtered = data.filter(c => c.symbol.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
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

  const thCls = (key: SortKey, align: 'left' | 'right' | 'center' = 'right', hide = false) =>
    `px-2.5 py-2 cursor-pointer select-none font-mono text-[0.625rem] tracking-wider uppercase whitespace-nowrap border-b border-[--color-border] text-${align} ${hide ? 'hidden md:table-cell' : ''} ${sortBy === key ? 'text-[--color-accent]' : 'text-[--color-text-muted]'}`;

  return (
    <div class="fade-in">
      {/* Search */}
      <div class="mb-4">
        <input
          type="text"
          placeholder={t.search}
          value={search}
          onInput={(e) => { setSearch((e.target as HTMLInputElement).value); setPage(0); }}
          class="w-full max-w-xs px-4 py-2.5 bg-[--color-bg-card] border border-[--color-border] rounded-lg text-[--color-text] font-mono text-sm outline-none focus:border-[--color-accent] transition-colors"
        />
      </div>

      {/* Strategy badge */}
      <div class="mb-3 flex items-center gap-2 font-mono text-[0.6875rem] text-[--color-text-muted]">
        <span class="text-[--color-accent] text-[0.625rem] tracking-widest uppercase font-semibold">{t.cta}</span>
      </div>

      {/* Table */}
      <div class="overflow-x-auto border border-[--color-border] rounded-xl bg-[--color-bg-card]">
        <table class="w-full border-collapse font-mono text-[0.8125rem]">
          <thead>
            <tr>
              <th class="px-2.5 py-2 text-center font-mono text-[0.625rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted] w-10 cursor-default select-none">#</th>
              <th class={thCls('symbol', 'left')} onClick={() => handleSort('symbol')} aria-sort={sortBy === 'symbol' ? (sortDesc ? 'descending' : 'ascending') : 'none'}>{t.coin} {sortBy === 'symbol' ? (sortDesc ? '\u25BC' : '\u25B2') : ''}</th>
              <th class={thCls('price')} onClick={() => handleSort('price')} aria-sort={sortBy === 'price' ? (sortDesc ? 'descending' : 'ascending') : 'none'}>{t.price} {sortBy === 'price' ? (sortDesc ? '\u25BC' : '\u25B2') : ''}</th>
              <th class={thCls('change_24h')} onClick={() => handleSort('change_24h')} aria-sort={sortBy === 'change_24h' ? (sortDesc ? 'descending' : 'ascending') : 'none'}>{t.change} {sortBy === 'change_24h' ? (sortDesc ? '\u25BC' : '\u25B2') : ''}</th>
              <th class={thCls('volume_24h', 'right', true)} onClick={() => handleSort('volume_24h')} aria-sort={sortBy === 'volume_24h' ? (sortDesc ? 'descending' : 'ascending') : 'none'}>{t.volume} {sortBy === 'volume_24h' ? (sortDesc ? '\u25BC' : '\u25B2') : ''}</th>
              <th class={thCls('trades', 'right', true)} onClick={() => handleSort('trades')} aria-sort={sortBy === 'trades' ? (sortDesc ? 'descending' : 'ascending') : 'none'}>{t.trades} {sortBy === 'trades' ? (sortDesc ? '\u25BC' : '\u25B2') : ''}</th>
              <th class={thCls('win_rate')} onClick={() => handleSort('win_rate')} aria-sort={sortBy === 'win_rate' ? (sortDesc ? 'descending' : 'ascending') : 'none'}>{t.winRate} {sortBy === 'win_rate' ? (sortDesc ? '\u25BC' : '\u25B2') : ''}</th>
              <th class={thCls('profit_factor', 'right', true)} onClick={() => handleSort('profit_factor')} aria-sort={sortBy === 'profit_factor' ? (sortDesc ? 'descending' : 'ascending') : 'none'}>{t.pf} {sortBy === 'profit_factor' ? (sortDesc ? '\u25BC' : '\u25B2') : ''}</th>
              <th class={thCls('total_return_pct')} onClick={() => handleSort('total_return_pct')} aria-sort={sortBy === 'total_return_pct' ? (sortDesc ? 'descending' : 'ascending') : 'none'}>{t.returnPct} {sortBy === 'total_return_pct' ? (sortDesc ? '\u25BC' : '\u25B2') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr><td colSpan={9} class="py-8 text-center text-[--color-text-muted]">{t.noResults}</td></tr>
            )}
            {pageItems.map((coin, i) => {
              const rank = page * PER_PAGE + i + 1;
              const chgColor = coin.change_24h >= 0 ? 'text-[--color-up]' : 'text-[--color-down]';
              const wrColor = coin.win_rate >= 60 ? 'text-[--color-up]' : coin.win_rate >= 50 ? 'text-[--color-yellow]' : 'text-[--color-red]';
              const pfColor = coin.profit_factor >= 2 ? 'text-[--color-up]' : coin.profit_factor >= 1 ? 'text-[--color-text]' : 'text-[--color-red]';
              const retColor = coin.total_return_pct >= 0 ? 'text-[--color-up]' : 'text-[--color-down]';
              return (
                <tr
                  key={coin.symbol}
                  onClick={() => { window.location.href = `${basePath}/${coin.symbol.toLowerCase()}`; }}
                  class="cursor-pointer border-b border-[--color-border] row-hover"
                >
                  <td class="px-2.5 py-2 text-center text-[--color-text-muted] text-[0.6875rem]">{rank}</td>
                  <td class="px-2.5 py-2 font-semibold whitespace-nowrap">{coin.symbol.replace('USDT', '')}<span class="text-[--color-text-muted] font-normal">/USDT</span></td>
                  <td class="px-2.5 py-2 text-right">${formatPrice(coin.price)}</td>
                  <td class={`px-2.5 py-2 text-right ${chgColor}`}>{coin.change_24h > 0 ? '+' : ''}{coin.change_24h}%</td>
                  <td class="px-2.5 py-2 text-right text-[--color-text-muted] hidden md:table-cell">{formatVolume(coin.volume_24h)}</td>
                  <td class="px-2.5 py-2 text-right text-[--color-text-muted] hidden md:table-cell">{coin.trades}</td>
                  <td class={`px-2.5 py-2 text-right font-semibold ${wrColor}`}>{coin.win_rate}%</td>
                  <td class={`px-2.5 py-2 text-right hidden md:table-cell ${pfColor}`}>{coin.profit_factor.toFixed(1)}</td>
                  <td class={`px-2.5 py-2 text-right font-semibold ${retColor}`}>{coin.total_return_pct > 0 ? '+' : ''}{coin.total_return_pct}%</td>
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
