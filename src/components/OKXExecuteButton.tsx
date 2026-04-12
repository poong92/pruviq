/**
 * OKX Execute Button — connects to OAuth, shows confirm modal, executes trade.
 * Broker tag ensures commission tracking on every order.
 */
import { useState, useEffect } from "preact/hooks";

interface Props {
  strategy?: string;
  direction?: string;
  symbol?: string;
  slPct?: number;
  tpPct?: number;
  lang?: "en" | "ko";
}

const API_BASE = "https://api.pruviq.com";

const labels = {
  en: {
    execute: "Execute on OKX",
    connect: "Connect OKX to Execute",
    confirming: "Confirm Trade",
    executing: "Executing...",
    success: "Order Placed!",
    failed: "Execution Failed",
    confirmTitle: "Confirm OKX Trade",
    confirmDesc: "This will place a real trade on your OKX account.",
    disclaimer:
      "Simulation results do not guarantee future returns. You are responsible for all trading decisions.",
    cancel: "Cancel",
    confirm: "Confirm & Execute",
    strategy: "Strategy",
    direction: "Direction",
    symbol: "Symbol",
    slTp: "SL / TP",
    features: [
      "Automated SL/TP from simulation",
      "No API key sharing (OAuth)",
      "20% fee discount",
    ],
    featureTitle: "One-Click Execution",
    featureDesc: "Execute simulation results directly on OKX",
  },
  ko: {
    execute: "OKX에서 실행",
    connect: "OKX 연결 후 실행",
    confirming: "거래 확인",
    executing: "실행 중...",
    success: "주문 완료!",
    failed: "실행 실패",
    confirmTitle: "OKX 거래 확인",
    confirmDesc: "실제 OKX 계정에서 거래가 실행됩니다.",
    disclaimer:
      "시뮬레이션 결과는 미래 수익을 보장하지 않습니다. 모든 거래 결정은 본인의 책임입니다.",
    cancel: "취소",
    confirm: "확인 후 실행",
    strategy: "전략",
    direction: "방향",
    symbol: "심볼",
    slTp: "SL / TP",
    features: [
      "시뮬레이션 기반 자동 SL/TP",
      "API 키 공유 불필요 (OAuth)",
      "20% 수수료 할인",
    ],
    featureTitle: "원클릭 실행",
    featureDesc: "시뮬레이션 결과를 OKX에서 바로 실행",
  },
};

export default function OKXExecuteButton({
  strategy = "",
  direction = "",
  symbol = "",
  slPct = 0,
  tpPct = 0,
  lang = "en",
}: Props) {
  const t = labels[lang];
  const [connected, setConnected] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "executing" | "success" | "failed"
  >("idle");
  const [userSettings, setUserSettings] = useState<{
    position_size_usdt: number;
    leverage: number;
    td_mode: string;
  }>({ position_size_usdt: 100, leverage: 1, td_mode: "isolated" });

  useEffect(() => {
    fetch(`${API_BASE}/auth/okx/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setConnected(d.connected);
        if (d.connected) {
          // Fetch user settings to use their configured position size and leverage
          return fetch(`${API_BASE}/settings/trading`, {
            credentials: "include",
          });
        }
        return null;
      })
      .then((r) => r?.json())
      .then((d) => {
        if (d?.settings) {
          setUserSettings({
            position_size_usdt: d.settings.position_size_usdt ?? 100,
            leverage: d.settings.leverage ?? 1,
            td_mode: d.settings.td_mode ?? "isolated",
          });
        }
      })
      .catch(() => setConnected(false));
  }, []);

  const handleExecute = async () => {
    setStatus("executing");
    try {
      // current_price omitted — backend auto-fetches mark price from OKX
      const resp = await fetch(`${API_BASE}/execute/order`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          direction,
          symbol,
          sl_pct: slPct,
          tp_pct: tpPct,
          position_size_usdt: userSettings.position_size_usdt,
          leverage: userSettings.leverage,
          td_mode: userSettings.td_mode,
        }),
      });
      if (resp.ok) {
        setStatus("success");
      } else {
        setStatus("failed");
      }
    } catch {
      setStatus("failed");
    }
    setTimeout(() => {
      setStatus("idle");
      setShowModal(false);
    }, 3000);
  };

  // Not connected — show feature preview + connect CTA
  if (!connected) {
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
            <h4 class="font-bold text-sm">{t.featureTitle}</h4>
            <p class="text-xs text-[--color-text-muted]">{t.featureDesc}</p>
          </div>
        </div>
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
          href={`${API_BASE}/auth/okx/start?lang=${lang}`}
          class="btn btn-primary btn-sm w-full text-center font-mono"
        >
          {t.connect} →
        </a>
      </div>
    );
  }

  // Connected — show execute button
  return (
    <>
      <button
        class="btn btn-primary btn-lg w-full"
        onClick={() => setShowModal(true)}
      >
        {t.execute} →
      </button>

      {showModal && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div class="bg-[--color-bg-card] border border-[--color-border] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 class="text-lg font-bold mb-2">{t.confirmTitle}</h3>
            <p class="text-sm text-[--color-text-muted] mb-4">
              {t.confirmDesc}
            </p>

            <div class="space-y-2 mb-4 text-sm">
              <div class="flex justify-between">
                <span class="text-[--color-text-muted]">{t.strategy}</span>
                <span class="font-mono">{strategy}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[--color-text-muted]">{t.direction}</span>
                <span
                  class={`font-mono font-bold ${direction === "long" ? "text-[--color-up]" : "text-[--color-down]"}`}
                >
                  {direction.toUpperCase()}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-[--color-text-muted]">{t.symbol}</span>
                <span class="font-mono">{symbol}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[--color-text-muted]">{t.slTp}</span>
                <span class="font-mono">
                  {slPct}% / {tpPct}%
                </span>
              </div>
            </div>

            <p class="text-xs text-[--color-text-muted] border-t border-[--color-border] pt-3 mb-4">
              {t.disclaimer}
            </p>

            <div class="flex gap-3">
              <button
                class="btn btn-ghost btn-md flex-1"
                onClick={() => setShowModal(false)}
                disabled={status === "executing"}
              >
                {t.cancel}
              </button>
              <button
                class={`btn btn-md flex-1 ${status === "success" ? "bg-[--color-up] text-white" : status === "failed" ? "bg-[--color-down] text-white" : "btn-primary"}`}
                onClick={handleExecute}
                disabled={status === "executing" || status === "success"}
              >
                {status === "idle"
                  ? t.confirm
                  : status === "executing"
                    ? t.executing
                    : status === "success"
                      ? t.success
                      : t.failed}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
