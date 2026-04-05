/**
 * OKX Execute Button — "Coming Soon" until Broker approval.
 * After approval: connects to OAuth → executes trade.
 */

interface Props {
  strategy?: string;
  direction?: string;
  symbol?: string;
  slPct?: number;
  tpPct?: number;
  lang?: "en" | "ko";
}

const labels = {
  en: {
    title: "Execute on OKX",
    coming: "Coming Soon",
    desc: "One-click execution with OKX Broker integration",
    features: [
      "Automated SL/TP from simulation results",
      "No API key sharing required (OAuth)",
      "Up to 20% fee discount",
    ],
    notify: "Notify me when available",
  },
  ko: {
    title: "OKX에서 실행",
    coming: "준비 중",
    desc: "OKX 브로커 연동으로 원클릭 실행",
    features: [
      "시뮬레이션 결과 기반 자동 SL/TP",
      "API 키 공유 불필요 (OAuth 인증)",
      "최대 20% 수수료 할인",
    ],
    notify: "출시 알림 받기",
  },
};

export default function OKXExecuteButton({
  strategy,
  direction,
  symbol,
  slPct,
  tpPct,
  lang = "en",
}: Props) {
  const t = labels[lang];
  const isReady = false; // Broker 승인 후 true로 전환

  if (isReady) {
    // Phase 2: 실제 연동 후 활성화
    return (
      <a
        href={`/auth/okx/start?strategy=${strategy}&direction=${direction}&symbol=${symbol}`}
        class="btn btn-primary btn-lg w-full text-center"
      >
        {t.title} →
      </a>
    );
  }

  return (
    <div class="border border-[--color-accent]/20 rounded-xl p-6 bg-[--color-accent]/5">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-lg bg-[--color-accent]/10 flex items-center justify-center shrink-0">
          <svg
            class="w-5 h-5 text-[--color-accent]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div>
          <h4 class="font-bold text-sm">{t.title}</h4>
          <span class="text-xs font-mono text-[--color-accent] bg-[--color-accent]/10 px-2 py-0.5 rounded">
            {t.coming}
          </span>
        </div>
      </div>
      <p class="text-sm text-[--color-text-muted] mb-3">{t.desc}</p>
      <ul class="space-y-1.5 mb-4">
        {t.features.map((f) => (
          <li class="flex items-center gap-2 text-xs text-[--color-text-secondary]">
            <svg
              class="w-3.5 h-3.5 text-[--color-up] shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <a
        href="https://t.me/PRUVIQ"
        target="_blank"
        rel="noopener"
        class="btn btn-ghost btn-sm w-full text-center font-mono"
      >
        {t.notify} →
      </a>
    </div>
  );
}
