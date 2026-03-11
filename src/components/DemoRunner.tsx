import { h } from 'preact';
import { useState } from 'preact/hooks';
import { generateCSV, downloadCSV } from '../utils/csv';
import { formatPF } from '../utils/format';

type DemoData = {
  total_return: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown: number;
  total_trades: number;
  tp_count: number;
  sl_count: number;
  timeout_count: number;
  strategy: string;
  data_range: string;
  coins: number;
};

export default function DemoRunner() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DemoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDemo() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch('/data/demo-results.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Extract default params result (SL10/TP8)
      const r = json.results?.sl10_tp8;
      if (!r) throw new Error('Default result not found');
      setData({
        total_return: r.total_return_pct ?? 0,
        win_rate: r.win_rate ?? 0,
        profit_factor: r.profit_factor ?? 0,
        max_drawdown: r.max_drawdown_pct ?? 0,
        total_trades: r.total_trades ?? 0,
        tp_count: r.tp_count ?? 0,
        sl_count: r.sl_count ?? 0,
        timeout_count: r.timeout_count ?? 0,
        strategy: json.strategy ?? 'BB Squeeze SHORT',
        data_range: json.data_range ?? '',
        coins: json.coins ?? 0,
      });
    } catch (e:any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function downloadJSON() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pruviq-demo-result.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleDownloadCSV() {
    if (!data) return;
    const summaryHeaders = ['Metric', 'Value'];
    const summaryRows: (string | number | null)[][] = [
      ['Strategy', data.strategy],
      ['Data Range', data.data_range],
      ['Coins', data.coins],
      ['Total Return %', data.total_return],
      ['Win Rate %', data.win_rate],
      ['Profit Factor', data.profit_factor],
      ['Max Drawdown %', data.max_drawdown],
      ['Total Trades', data.total_trades],
      ['TP Count', data.tp_count],
      ['SL Count', data.sl_count],
      ['Timeout Count', data.timeout_count],
    ];

    const csv = generateCSV(summaryHeaders, summaryRows);
    downloadCSV(csv, 'pruviq-demo-result.csv');
  }

  return (
    <div class="demo-runner">
      <div class="flex gap-3 items-center">
        <button class="btn-primary px-4 py-2 rounded font-semibold" onClick={runDemo} disabled={loading}>
          {loading ? 'Running demo...' : 'Try Live Demo'}
        </button>
        {data && (
          <button class="btn-secondary border px-3 py-2 rounded" onClick={downloadJSON}>Download JSON</button>
        )}
        {data && (
          <button class="btn-secondary border px-3 py-2 rounded" onClick={handleDownloadCSV}>Download CSV</button>
        )}
      </div>

      {error && (
        <div class="mt-3 text-[var(--color-red)]">Error: {error}</div>
      )}

      {data && (
        <div class="mt-4">
          <div class="text-sm text-[--color-text-muted] mb-2">
            {data.strategy} | {data.coins} coins | {data.data_range}
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="border rounded p-3 bg-[--color-bg-card]">
              <div class="text-sm text-[--color-text-muted]">Total Return</div>
              <div class="text-xl font-bold">{data.total_return}%</div>
            </div>
            <div class="border rounded p-3 bg-[--color-bg-card]">
              <div class="text-sm text-[--color-text-muted]">Win Rate</div>
              <div class="text-xl font-bold">{data.win_rate}%</div>
            </div>
            <div class="border rounded p-3 bg-[--color-bg-card]">
              <div class="text-sm text-[--color-text-muted]">Profit Factor</div>
              <div class="text-xl font-bold">{formatPF(data.profit_factor)}</div>
            </div>
            <div class="border rounded p-3 bg-[--color-bg-card]">
              <div class="text-sm text-[--color-text-muted]">Max Drawdown</div>
              <div class="text-xl font-bold">{data.max_drawdown}%</div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4 mt-3">
            <div class="border rounded p-3 bg-[--color-bg-card] text-center">
              <div class="text-sm text-[--color-text-muted]">Trades</div>
              <div class="font-bold">{data.total_trades}</div>
            </div>
            <div class="border rounded p-3 bg-[--color-bg-card] text-center">
              <div class="text-sm text-[--color-text-muted]">TP / SL</div>
              <div class="font-bold">{data.tp_count} / {data.sl_count}</div>
            </div>
            <div class="border rounded p-3 bg-[--color-bg-card] text-center">
              <div class="text-sm text-[--color-text-muted]">Timeout</div>
              <div class="font-bold">{data.timeout_count}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
