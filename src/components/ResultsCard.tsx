import { winRateColor, profitFactorColor, signColor } from '../utils/format';

interface ResultsData {
  win_rate: number;
  profit_factor: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  total_trades: number;
  tp_count: number;
  sl_count: number;
  timeout_count: number;
}

interface ResultsCardProps {
  data: ResultsData;
  isDefault: boolean;
  lang?: 'en' | 'ko';
}

const labels = {
  en: {
    live: 'CURRENT LIVE SETTINGS',
    winRate: 'Win Rate',
    pf: 'Profit Factor',
    totalReturn: 'Total Return',
    maxDD: 'Max Drawdown',
    trades: 'trades simulated',
  },
  ko: {
    live: '현재 라이브 설정',
    winRate: '승률',
    pf: '수익 팩터',
    totalReturn: '총 수익률',
    maxDD: '최대 드로다운',
    trades: '건 시뮬레이션됨',
  },
};

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div class="p-3 rounded-lg bg-[rgba(17,17,17,0.8)] border border-[--color-border]">
      <div class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-1">{label}</div>
      <div class="font-mono text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

export default function ResultsCard({ data, isDefault, lang = 'en' }: ResultsCardProps) {
  const t = labels[lang] || labels.en;
  const total = data.tp_count + data.sl_count + data.timeout_count;
  const tpPct = total > 0 ? (data.tp_count / total) * 100 : 0;
  const slPct = total > 0 ? (data.sl_count / total) * 100 : 0;
  const toPct = total > 0 ? (data.timeout_count / total) * 100 : 0;

  const wrColor = winRateColor(data.win_rate);
  const pfColor = profitFactorColor(data.profit_factor);
  const retColor = signColor(data.total_return_pct);

  return (
    <div>
      {isDefault && (
        <div class="font-mono text-[0.625rem] text-[--color-accent] tracking-widest mb-3 uppercase">{t.live}</div>
      )}

      <div class="grid grid-cols-2 gap-2 mb-4">
        <MetricBox label={t.winRate} value={`${data.win_rate}%`} color={wrColor} />
        <MetricBox label={t.pf} value={`${data.profit_factor}`} color={pfColor} />
        <MetricBox label={t.totalReturn} value={`${data.total_return_pct > 0 ? '+' : ''}${data.total_return_pct}%`} color={retColor} />
        <MetricBox label={t.maxDD} value={`${data.max_drawdown_pct}%`} color="var(--color-red)" />
      </div>

      <div class="font-mono text-xs text-[--color-text-muted] mb-3">
        {data.total_trades.toLocaleString()} {t.trades}
      </div>

      {/* Exit reason bar */}
      <div class="mb-1">
        <div class="flex h-1.5 rounded-full overflow-hidden bg-[--color-border]">
          <div class="bg-[--color-accent] transition-[width] duration-300" style={{ width: `${tpPct}%` }} />
          <div class="bg-[--color-red] transition-[width] duration-300" style={{ width: `${slPct}%` }} />
          <div class="bg-[--color-text-muted] transition-[width] duration-300" style={{ width: `${toPct}%` }} />
        </div>
      </div>

      <div class="flex gap-4 font-mono text-[0.625rem]">
        <span class="text-[--color-accent]">TP {tpPct.toFixed(0)}%</span>
        <span class="text-[--color-red]">SL {slPct.toFixed(0)}%</span>
        <span class="text-[--color-text-muted]">TO {toPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}
