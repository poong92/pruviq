// Standard mode: fine-tune SL/TP/top-N/leverage + optional date range.
// Appears only when skill mode = "standard". Quick stays hidden for focus.
// Values flow through useSimConfig (SL/TP) + local state (top-N/leverage,
// shared via props callback for Phase 2 — moves into useSimConfig next).

import { useTranslations, type Lang } from "../../../i18n/index";

export interface StandardValues {
  topN: number;
  leverage: number;
  feePct: number;
  startDate: string;
  endDate: string;
}

interface Props {
  lang: Lang;
  sl: number;
  tp: number;
  values: StandardValues;
  onSL: (n: number) => void;
  onTP: (n: number) => void;
  onChange: (patch: Partial<StandardValues>) => void;
}

export default function StandardControls({
  lang,
  sl,
  tp,
  values,
  onSL,
  onTP,
  onChange,
}: Props) {
  const t = useTranslations(lang);
  const isKo = lang === "ko";
  return (
    <section
      aria-label={isKo ? "상세 설정" : "Standard controls"}
      class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
      data-testid="sim-v1-standard-controls"
    >
      <div class="mb-4 flex items-center gap-2">
        <span class="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-zinc-200">
          {isKo ? "상세 설정" : "Standard"}
        </h3>
        <span class="ml-auto text-xs text-zinc-400">
          {isKo ? "모든 변경 URL 자동 저장" : "Changes saved in URL"}
        </span>
      </div>

      <div class="grid gap-5 sm:grid-cols-2">
        <Slider
          label={`${t("simV2.defaults.sl_label")}: ${sl}%`}
          min={1}
          max={30}
          step={1}
          value={sl}
          tone="rose"
          onInput={onSL}
          testId="sim-v1-std-sl"
        />
        <Slider
          label={`${t("simV2.defaults.tp_label")}: ${tp}%`}
          min={1}
          max={50}
          step={1}
          value={tp}
          tone="emerald"
          onInput={onTP}
          testId="sim-v1-std-tp"
        />
        <Slider
          label={`${isKo ? "상위 코인" : "Top N coins"}: ${values.topN}`}
          min={1}
          max={100}
          step={1}
          value={values.topN}
          tone="zinc"
          onInput={(n) => onChange({ topN: n })}
          testId="sim-v1-std-topn"
        />
        <Slider
          label={`${isKo ? "레버리지" : "Leverage"}: ${values.leverage}×`}
          min={1}
          max={20}
          step={1}
          value={values.leverage}
          tone="amber"
          onInput={(n) => onChange({ leverage: n })}
          testId="sim-v1-std-leverage"
        />
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-3">
        <FeeInput
          label={isKo ? "수수료 (%)" : "Fee (%)"}
          value={values.feePct}
          onInput={(n) => onChange({ feePct: n })}
          testId="sim-v1-std-fee"
        />
        <DateInput
          label={isKo ? "시작일" : "Start date"}
          value={values.startDate}
          onInput={(v) => onChange({ startDate: v })}
          testId="sim-v1-std-start"
        />
        <DateInput
          label={isKo ? "종료일" : "End date"}
          value={values.endDate}
          onInput={(v) => onChange({ endDate: v })}
          testId="sim-v1-std-end"
        />
      </div>
    </section>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  tone,
  onInput,
  testId,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  tone: "rose" | "emerald" | "amber" | "zinc";
  onInput: (n: number) => void;
  testId: string;
}) {
  const thumb =
    tone === "rose"
      ? "accent-rose-400"
      : tone === "emerald"
        ? "accent-emerald-400"
        : tone === "amber"
          ? "accent-amber-400"
          : "accent-zinc-400";
  return (
    <label class="block">
      <span class="mb-2 block text-xs font-medium text-zinc-300">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))}
        class={`h-2 w-full cursor-pointer ${thumb}`}
        data-testid={testId}
        aria-label={label}
      />
    </label>
  );
}

function FeeInput({
  label,
  value,
  onInput,
  testId,
}: {
  label: string;
  value: number;
  onInput: (n: number) => void;
  testId: string;
}) {
  return (
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-zinc-300">{label}</span>
      <input
        type="number"
        step="0.01"
        min="0"
        max="1"
        value={value}
        onInput={(e) => {
          const n = Number((e.target as HTMLInputElement).value);
          if (Number.isFinite(n)) onInput(n);
        }}
        data-testid={testId}
        class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-emerald-400 focus:outline-none"
      />
    </label>
  );
}

function DateInput({
  label,
  value,
  onInput,
  testId,
}: {
  label: string;
  value: string;
  onInput: (v: string) => void;
  testId: string;
}) {
  return (
    <label class="block">
      <span class="mb-1 block text-xs font-medium text-zinc-300">{label}</span>
      <input
        type="date"
        value={value}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        data-testid={testId}
        class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-emerald-400 focus:outline-none"
      />
    </label>
  );
}
