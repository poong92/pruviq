// Live performance panel.
// Phase 2: pulls real numbers from /data/performance.json instead of
// hard-coded 54/38/3. Honesty first — we show live P&L with period,
// no fake backtest comparison numbers. Proper backtest-vs-live gap
// calculation lands in Phase 2.5 (requires same-period re-simulation).

import { useEffect, useState } from "preact/hooks";
import { useTranslations, type Lang } from "../../../i18n/index";

interface Props {
  lang: Lang;
}

interface LiveSummary {
  strategy: string;
  period: { from: string; to: string };
  summary: {
    total_trades: number;
    win_rate: number;
    profit_factor: number;
    total_pnl: number;
    starting_balance: number;
    current_balance: number;
    max_drawdown_pct: number;
  };
  generated: string;
}

export default function TrustGapPanel({ lang }: Props) {
  const t = useTranslations(lang);
  const [data, setData] = useState<LiveSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/data/performance.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const isKo = lang === "ko";

  if (error || !data) {
    return (
      <section
        class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
        data-testid="sim-v1-trust-gap"
      >
        <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">
          {t("simV2.trust.gap_heading")}
        </h3>
        <p class="text-xs text-zinc-500">
          {error
            ? isKo
              ? "실 성과 데이터 일시적으로 불가"
              : "Live performance unavailable — retry soon"
            : isKo
              ? "로딩 중…"
              : "loading…"}
        </p>
      </section>
    );
  }

  const s = data.summary;
  const returnPct = (s.total_pnl / s.starting_balance) * 100;
  const returnPositive = returnPct >= 0;
  const signed = `${returnPositive ? "+" : ""}${returnPct.toFixed(1)}%`;
  const period = `${data.period.from} → ${data.period.to}`;
  const generated = data.generated.slice(0, 10);

  return (
    <section
      aria-label={t("simV2.trust.gap_heading")}
      class="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-zinc-900/60 p-5"
      data-testid="sim-v1-trust-gap"
    >
      <div class="mb-3 flex items-baseline justify-between gap-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-emerald-300">
          {isKo ? "실 OKX 성과 (라이브)" : "Live OKX performance"}
        </h3>
        <span class="font-mono text-[11px] text-zinc-500">
          {isKo ? "업데이트" : "updated"} {generated}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure
          label={isKo ? "실 수익률" : "Live return"}
          value={signed}
          tone={returnPositive ? "good" : "bad"}
          highlight
          testId="sim-v1-live-return"
        />
        <Figure
          label={isKo ? "승률" : "Win rate"}
          value={`${s.win_rate.toFixed(1)}%`}
          tone="neutral"
        />
        <Figure
          label={isKo ? "PF" : "Profit factor"}
          value={s.profit_factor.toFixed(2)}
          tone={s.profit_factor >= 1 ? "good" : "bad"}
        />
        <Figure
          label={isKo ? "최대 낙폭" : "Max DD"}
          value={`${s.max_drawdown_pct.toFixed(1)}%`}
          tone="bad"
        />
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-500/10 pt-3 text-[11px] text-zinc-400">
        <span class="font-mono">
          {isKo ? "전략" : "Strategy"}: {data.strategy}
        </span>
        <span class="font-mono">
          {isKo ? "기간" : "Period"}: {period}
        </span>
        <span class="font-mono">
          {isKo ? "거래" : "Trades"}: {s.total_trades.toLocaleString()}
        </span>
      </div>

      <p class="mt-3 text-xs leading-relaxed text-zinc-400">
        {t("simV2.trust.gap_note")}
      </p>
    </section>
  );
}

function Figure({
  label,
  value,
  tone,
  highlight,
  testId,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral";
  highlight?: boolean;
  testId?: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-rose-400"
        : "text-zinc-100";
  return (
    <div
      data-testid={testId}
      class={`rounded-lg p-3 ${highlight ? "bg-emerald-500/10 ring-1 ring-emerald-400/30" : ""}`}
    >
      <div class="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div class={`font-mono text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
