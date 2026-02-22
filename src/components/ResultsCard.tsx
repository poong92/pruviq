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
  avg_win_pct?: number;
  avg_loss_pct?: number;
  max_consecutive_losses?: number;
  sharpe_ratio?: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
}

interface ResultsCardProps {
  data: ResultsData;
  isDefault: boolean;
  lang?: 'en' | 'ko';
  isDemo?: boolean;
}

const labels = {
  en: {
    live: 'CURRENT LIVE SETTINGS',
    winRate: 'Win Rate',
    pf: 'Profit Factor',
    totalReturn: 'Total Return',
    maxDD: 'Max Drawdown',
    trades: 'trades simulated',
    avgWin: 'Avg Win',
    avgLoss: 'Avg Loss',
    maxConsec: 'Max Consec. Losses',
    rr: 'R:R Ratio',
    sharpe: 'Sharpe',
    sortino: 'Sortino',
    calmar: 'Calmar',
    riskMetrics: 'Risk-Adjusted',
    demoNote: 'DEMO · Pre-computed results for BB Squeeze SHORT',
  },
  ko: {
    live: '현재 라이브 설정',
    winRate: '승률',
    pf: '수익 팩터',
    totalReturn: '총 수익률',
    maxDD: '최대 드로다운',
    trades: '건 시뮬레이션됨',
    avgWin: '평균 수익',
    avgLoss: '평균 손실',
    maxConsec: '최대 연속 손실',
    rr: 'R:R 비율',
    sharpe: '샤프',
    sortino: '소르티노',
    calmar: '칼마',
    riskMetrics: '리스크 조정',
    demoNote: 'DEMO · BB Squeeze SHORT 사전 계산 결과',
  },
};

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div class="p-3 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border]">
      <div class="font-mono text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-1">{label}</div>
      <div class="font-mono text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

export default function ResultsCard({ data, isDefault, lang = 'en', isDemo = false }: ResultsCardProps) {
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

      {isDemo && (
        <div class="mb-3 px-3 py-2 rounded-lg bg-[--color-yellow]/10 border border-[--color-yellow]/20">
          <span class="font-mono text-xs text-[--color-yellow]">{t.demoNote}</span>
        </div>
      )}

      <div class="grid grid-cols-2 gap-2 mb-3">
        <MetricBox label={t.winRate} value={`${data.win_rate}%`} color={wrColor} />
        <MetricBox label={t.pf} value={`${data.profit_factor}`} color={pfColor} />
        <MetricBox label={t.totalReturn} value={`${data.total_return_pct > 0 ? '+' : ''}${data.total_return_pct}%`} color={retColor} />
        <MetricBox label={t.maxDD} value={`${data.max_drawdown_pct}%`} color="var(--color-red)" />
      </div>

      {(data.avg_win_pct !== undefined || data.avg_loss_pct !== undefined) && (
        <div class="grid grid-cols-3 gap-2 mb-3">
          <MetricBox
            label={t.avgWin}
            value={`+${(data.avg_win_pct ?? 0).toFixed(2)}%`}
            color="var(--color-accent)"
          />
          <MetricBox
            label={t.avgLoss}
            value={`${(data.avg_loss_pct ?? 0).toFixed(2)}%`}
            color="var(--color-red)"
          />
          <MetricBox
            label={t.maxConsec}
            value={`${data.max_consecutive_losses ?? 0}`}
            color="var(--color-text-muted)"
          />
        </div>
      )}

      {(data.sharpe_ratio !== undefined && data.sharpe_ratio !== 0) && (
        <div class="grid grid-cols-3 gap-2 mb-3">
          <MetricBox
            label={t.sharpe}
            value={`${(data.sharpe_ratio ?? 0).toFixed(2)}`}
            color={(data.sharpe_ratio ?? 0) > 1 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
          />
          <MetricBox
            label={t.sortino}
            value={`${(data.sortino_ratio ?? 0).toFixed(2)}`}
            color={(data.sortino_ratio ?? 0) > 1.5 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
          />
          <MetricBox
            label={t.calmar}
            value={`${(data.calmar_ratio ?? 0).toFixed(2)}`}
            color={(data.calmar_ratio ?? 0) > 1 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
          />
        </div>
      )}

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
