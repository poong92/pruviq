import { h } from "preact";
import { useState } from "preact/hooks";
import { generateCSV, downloadCSV } from "../utils/csv";
import { formatPF } from "../utils/format";

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

const labels = {
  en: {
    runningDemo: "Running demo...",
    tryLiveDemo: "Try Live Demo",
    downloadJson: "Download JSON",
    downloadCsv: "Download CSV",
    error: "Error",
    totalReturn: "Total Return",
    winRate: "Win Rate",
    profitFactor: "Profit Factor",
    maxDrawdown: "Max Drawdown",
    trades: "Trades",
    tpSl: "TP / SL",
    timeout: "Timeout",
    coins: "coins",
    metric: "Metric",
    value: "Value",
    strategy: "Strategy",
    dataRange: "Data Range",
    coinsLabel: "Coins",
    totalReturnPct: "Total Return %",
    winRatePct: "Win Rate %",
    maxDrawdownPct: "Max Drawdown %",
    totalTrades: "Total Trades",
    tpCount: "TP Count",
    slCount: "SL Count",
    timeoutCount: "Timeout Count",
  },
  ko: {
    runningDemo: "데모 실행 중...",
    tryLiveDemo: "라이브 데모",
    downloadJson: "JSON 다운로드",
    downloadCsv: "CSV 다운로드",
    error: "에러",
    totalReturn: "총 수익률",
    winRate: "승률",
    profitFactor: "수익 팩터",
    maxDrawdown: "최대 낙폭",
    trades: "거래 수",
    tpSl: "TP / SL",
    timeout: "타임아웃",
    coins: "코인",
    metric: "지표",
    value: "값",
    strategy: "전략",
    dataRange: "데이터 기간",
    coinsLabel: "코인",
    totalReturnPct: "총 수익률 %",
    winRatePct: "승률 %",
    maxDrawdownPct: "최대 낙폭 %",
    totalTrades: "총 거래 수",
    tpCount: "TP 횟수",
    slCount: "SL 횟수",
    timeoutCount: "타임아웃 횟수",
  },
};

interface Props {
  lang?: "en" | "ko";
}

export default function DemoRunner({ lang = "en" }: Props) {
  const t = labels[lang] || labels.en;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DemoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDemo() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/data/demo-results.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Extract default params result (SL10/TP8)
      const r = json.results?.sl10_tp8;
      if (!r) throw new Error("Default result not found");
      setData({
        total_return: r.total_return_pct ?? 0,
        win_rate: r.win_rate ?? 0,
        profit_factor: r.profit_factor ?? 0,
        max_drawdown: r.max_drawdown_pct ?? 0,
        total_trades: r.total_trades ?? 0,
        tp_count: r.tp_count ?? 0,
        sl_count: r.sl_count ?? 0,
        timeout_count: r.timeout_count ?? 0,
        strategy: json.strategy ?? "BB Squeeze SHORT",
        data_range: json.data_range ?? "",
        coins: json.coins ?? 0,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function downloadJSON() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pruviq-demo-result.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleDownloadCSV() {
    if (!data) return;
    const summaryHeaders = [t.metric, t.value];
    const summaryRows: (string | number | null)[][] = [
      [t.strategy, data.strategy],
      [t.dataRange, data.data_range],
      [t.coinsLabel, data.coins],
      [t.totalReturnPct, data.total_return],
      [t.winRatePct, data.win_rate],
      [t.profitFactor, data.profit_factor],
      [t.maxDrawdownPct, data.max_drawdown],
      [t.totalTrades, data.total_trades],
      [t.tpCount, data.tp_count],
      [t.slCount, data.sl_count],
      [t.timeoutCount, data.timeout_count],
    ];

    const csv = generateCSV(summaryHeaders, summaryRows);
    downloadCSV(csv, "pruviq-demo-result.csv");
  }

  return (
    <div class="demo-runner">
      <div class="flex gap-3 items-center">
        <button
          class="btn-primary px-4 py-2 rounded font-semibold"
          onClick={runDemo}
          disabled={loading}
        >
          {loading ? t.runningDemo : t.tryLiveDemo}
        </button>
        {data && (
          <button
            class="btn-secondary border px-3 py-2 rounded"
            onClick={downloadJSON}
          >
            {t.downloadJson}
          </button>
        )}
        {data && (
          <button
            class="btn-secondary border px-3 py-2 rounded"
            onClick={handleDownloadCSV}
          >
            {t.downloadCsv}
          </button>
        )}
      </div>

      {error && (
        <div class="mt-3 text-[var(--color-red)]">
          {t.error}: {error}
        </div>
      )}

      {data && (
        <div class="mt-4">
          <div class="text-sm text-[--color-text-muted] mb-2">
            {data.strategy} | {data.coins} {t.coins} | {data.data_range}
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="border rounded p-3 bg-[--color-bg-card]">
              <div class="text-sm text-[--color-text-muted]">
                {t.totalReturn}
              </div>
              <div class="text-xl font-bold">{data.total_return}%</div>
            </div>
            <div class="border rounded p-3 bg-[--color-bg-card]">
              <div class="text-sm text-[--color-text-muted]">{t.winRate}</div>
              <div class="text-xl font-bold">{data.win_rate}%</div>
            </div>
            <div class="border rounded p-3 bg-[--color-bg-card]">
              <div class="text-sm text-[--color-text-muted]">
                {t.profitFactor}
              </div>
              <div class="text-xl font-bold">
                {formatPF(data.profit_factor)}
              </div>
            </div>
            <div class="border rounded p-3 bg-[--color-bg-card]">
              <div class="text-sm text-[--color-text-muted]">
                {t.maxDrawdown}
              </div>
              <div
                class="text-xl font-bold cursor-help"
                title="Max Drawdown reflects leveraged position sizing (default 5x). Unleveraged MDD would be ~5x lower."
              >
                {data.max_drawdown}%
              </div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4 mt-3">
            <div class="border rounded p-3 bg-[--color-bg-card] text-center">
              <div class="text-sm text-[--color-text-muted]">{t.trades}</div>
              <div class="font-bold">{data.total_trades}</div>
            </div>
            <div class="border rounded p-3 bg-[--color-bg-card] text-center">
              <div class="text-sm text-[--color-text-muted]">{t.tpSl}</div>
              <div class="font-bold">
                {data.tp_count} / {data.sl_count}
              </div>
            </div>
            <div class="border rounded p-3 bg-[--color-bg-card] text-center">
              <div class="text-sm text-[--color-text-muted]">{t.timeout}</div>
              <div class="font-bold">{data.timeout_count}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
