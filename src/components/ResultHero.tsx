/**
 * ResultHero.tsx — "Single Number Hero" (토스 패턴)
 *
 * Summary 탭 최상단에 하나의 큰 수익률 숫자를 보여주고,
 * 초보자 번역("$1,000 → $1,372")과 3개 미니 통계 알약을 표시.
 */
import { winRateColor, profitFactorColor, formatPF } from "../utils/format";
import { COLORS } from "./simulator-types";
import type { BacktestResult } from "./simulator-types";

interface Props {
  result: BacktestResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: Record<string, any>;
}

export default function ResultHero({ result, t }: Props) {
  const returnPct = result.total_return_pct;
  const isPositive = returnPct > 0;
  const color = isPositive ? COLORS.green : COLORS.red;

  // Dollar translation: use initial_capital_usd or default $1,000
  const initial = result.initial_capital_usd ?? 1000;
  const finalUsd =
    result.total_return_usd != null
      ? initial + result.total_return_usd
      : initial * (1 + returnPct / 100);

  return (
    <div class="text-center py-4 px-3">
      {/* Big number */}
      <div
        class="text-4xl md:text-5xl font-mono font-bold tracking-tight"
        style={{ color }}
      >
        {isPositive ? "+" : ""}
        {returnPct.toFixed(1)}%
      </div>

      {/* Dollar translation */}
      <div class="mt-1.5 text-sm font-mono text-[--color-text-muted]">
        ${initial.toLocaleString()} → ${Math.round(finalUsd).toLocaleString()}
      </div>

      {/* 3 mini stat pills */}
      <div class="flex justify-center gap-2 mt-3">
        <Pill
          label={t.heroWinRate || "Win Rate"}
          value={`${result.win_rate.toFixed(1)}%`}
          valueColor={winRateColor(result.win_rate)}
        />
        <Pill
          label={t.heroPF || "Profit Factor"}
          value={formatPF(result.profit_factor)}
          valueColor={profitFactorColor(result.profit_factor)}
        />
        <Pill
          label={t.heroMDD || "Max DD"}
          value={`${result.max_drawdown_pct.toFixed(1)}%`}
          valueColor={COLORS.red}
        />
      </div>
    </div>
  );
}

function Pill({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div class="px-2.5 py-1.5 rounded-lg bg-[--color-bg-tooltip] border border-[--color-border] text-center min-w-[80px]">
      <div class="text-[9px] font-mono text-[--color-text-muted] uppercase tracking-wider">
        {label}
      </div>
      <div
        class="text-sm font-mono font-bold mt-0.5"
        style={{ color: valueColor }}
      >
        {value}
      </div>
    </div>
  );
}
