import { h } from 'preact';
import { useState } from 'preact/hooks';

type Trade = { entry: string; exit: string; pnl: number };
type DemoData = { total_return: number; win_rate: number; profit_factor: number; max_drawdown: number; trades: Trade[] };

export default function DemoRunner() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DemoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDemo() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch('/data/demo.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
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

  return (
    <div class="demo-runner">
      <div class="flex gap-3 items-center">
        <button class="btn-primary bg-[--color-accent] text-[--color-bg] px-4 py-2 rounded font-semibold" onClick={runDemo} disabled={loading}>
          {loading ? 'Running demo...' : 'Try Live Demo'}
        </button>
        {data && (
          <button class="btn-secondary border px-3 py-2 rounded" onClick={downloadJSON}>Download JSON</button>
        )}
      </div>

      {error && (
        <div class="mt-3 text-red-500">Error: {error}</div>
      )}

      {data && (
        <div class="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div class="text-xl font-bold">{data.profit_factor}</div>
          </div>
          <div class="border rounded p-3 bg-[--color-bg-card]">
            <div class="text-sm text-[--color-text-muted]">Max Drawdown</div>
            <div class="text-xl font-bold">{data.max_drawdown}%</div>
          </div>
        </div>
      )}

      {data && (
        <div class="mt-4">
          <h4 class="font-semibold">Trades (sample)</h4>
          <div class="overflow-auto max-h-48 mt-2">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[--color-text-muted]"><th>Entry</th><th>Exit</th><th>PnL</th></tr>
              </thead>
              <tbody>
                {data.trades.slice(0,20).map((t, i) => (
                  <tr key={i}><td class="pr-4">{t.entry}</td><td class="pr-4">{t.exit}</td><td>{t.pnl}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
