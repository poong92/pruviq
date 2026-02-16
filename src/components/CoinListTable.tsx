import { useState, useEffect } from 'preact/hooks';

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

function formatPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function CoinListTable({ lang = 'en', apiUrl = '' }: { lang?: 'en' | 'ko'; apiUrl?: string }) {
  const t = labels[lang] || labels.en;
  const [data, setData] = useState<CoinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('win_rate');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const url = apiUrl ? `${apiUrl}/coins/stats` : '/coins/stats';
    fetch(url)
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
  }, [apiUrl]);

  if (loading) {
    return <div style={{ padding: '3rem 0', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t.loading}</div>;
  }
  if (error) {
    return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--color-red)', fontSize: '0.875rem' }}>{t.error}</div>;
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

  const thStyle = (key: SortKey): any => ({
    padding: '0.5rem 0.75rem',
    textAlign: key === 'symbol' ? 'left' : 'right' as const,
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.625rem',
    color: sortBy === key ? 'var(--color-accent)' : 'var(--color-text-muted)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
    borderBottom: '1px solid var(--color-border)',
    userSelect: 'none' as const,
  });

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder={t.search}
          value={search}
          onInput={(e) => { setSearch((e.target as HTMLInputElement).value); setPage(0); }}
          style={{
            width: '100%', maxWidth: '320px',
            padding: '0.625rem 1rem',
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.5rem',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Strategy badge */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
        <span style={{ color: 'var(--color-accent)', fontSize: '0.625rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontWeight: 600 }}>{t.cta}</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '0.75rem', backgroundColor: 'var(--color-bg-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle('symbol'), width: '2.5rem', textAlign: 'center', cursor: 'default' }}>#</th>
              <th style={thStyle('symbol')} onClick={() => handleSort('symbol')}>{t.coin} {sortBy === 'symbol' ? (sortDesc ? '▼' : '▲') : ''}</th>
              <th style={thStyle('price')} onClick={() => handleSort('price')}>{t.price} {sortBy === 'price' ? (sortDesc ? '▼' : '▲') : ''}</th>
              <th style={thStyle('change_24h')} onClick={() => handleSort('change_24h')}>{t.change} {sortBy === 'change_24h' ? (sortDesc ? '▼' : '▲') : ''}</th>
              <th style={thStyle('volume_24h')} onClick={() => handleSort('volume_24h')}>{t.volume} {sortBy === 'volume_24h' ? (sortDesc ? '▼' : '▲') : ''}</th>
              <th style={thStyle('trades')} onClick={() => handleSort('trades')}>{t.trades} {sortBy === 'trades' ? (sortDesc ? '▼' : '▲') : ''}</th>
              <th style={thStyle('win_rate')} onClick={() => handleSort('win_rate')}>{t.winRate} {sortBy === 'win_rate' ? (sortDesc ? '▼' : '▲') : ''}</th>
              <th style={thStyle('profit_factor')} onClick={() => handleSort('profit_factor')}>{t.pf} {sortBy === 'profit_factor' ? (sortDesc ? '▼' : '▲') : ''}</th>
              <th style={thStyle('total_return_pct')} onClick={() => handleSort('total_return_pct')}>{t.returnPct} {sortBy === 'total_return_pct' ? (sortDesc ? '▼' : '▲') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t.noResults}</td></tr>
            )}
            {pageItems.map((coin, i) => {
              const rank = page * PER_PAGE + i + 1;
              const chgColor = coin.change_24h >= 0 ? 'var(--color-accent)' : 'var(--color-red)';
              const wrColor = coin.win_rate >= 60 ? 'var(--color-accent)' : coin.win_rate >= 50 ? 'var(--color-yellow, #eab308)' : 'var(--color-red)';
              const pfColor = coin.profit_factor >= 2 ? 'var(--color-accent)' : coin.profit_factor >= 1 ? 'var(--color-text)' : 'var(--color-red)';
              const retColor = coin.total_return_pct >= 0 ? 'var(--color-accent)' : 'var(--color-red)';
              return (
                <tr
                  key={coin.symbol}
                  onClick={() => { window.location.href = `${basePath}/${coin.symbol.toLowerCase()}`; }}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,255,136,0.03)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '0.5rem 0.625rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.6875rem' }}>{rank}</td>
                  <td style={{ padding: '0.5rem 0.625rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{coin.symbol.replace('USDT', '')}<span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>/USDT</span></td>
                  <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right' }}>{formatPrice(coin.price)}</td>
                  <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', color: chgColor }}>{coin.change_24h > 0 ? '+' : ''}{coin.change_24h}%</td>
                  <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>{formatVolume(coin.volume_24h)}</td>
                  <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>{coin.trades}</td>
                  <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', color: wrColor, fontWeight: 600 }}>{coin.win_rate}%</td>
                  <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', color: pfColor }}>{coin.profit_factor.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', color: retColor, fontWeight: 600 }}>{coin.total_return_pct > 0 ? '+' : ''}{coin.total_return_pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>
            {t.showing(page * PER_PAGE + 1, Math.min((page + 1) * PER_PAGE, sorted.length), sorted.length)}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              style={{
                padding: '0.375rem 0.75rem',
                border: '1px solid var(--color-border)',
                borderRadius: '0.375rem',
                backgroundColor: 'transparent',
                color: page === 0 ? 'var(--color-text-muted)' : 'var(--color-text)',
                cursor: page === 0 ? 'default' : 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
              }}
            >
              &lt;
            </button>
            <span style={{ padding: '0.375rem 0.5rem', color: 'var(--color-text-muted)' }}>
              {page + 1}/{totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '0.375rem 0.75rem',
                border: '1px solid var(--color-border)',
                borderRadius: '0.375rem',
                backgroundColor: 'transparent',
                color: page >= totalPages - 1 ? 'var(--color-text-muted)' : 'var(--color-text)',
                cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
              }}
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
