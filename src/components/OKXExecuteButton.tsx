/**
 * OKX Execute Button — connects to OAuth, shows confirm modal, executes trade.
 * Requires OKX Broker connection via OKXConnectButton first.
 */
import { useState, useEffect, useCallback } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface Props {
  strategy?: string;
  direction?: string;
  symbol?: string;
  slPct?: number;
  tpPct?: number;
  leverage?: number;
  sizeUsdt?: number;
  lang?: "en" | "ko";
}

interface OKXStatus {
  connected: boolean;
}

interface ExecuteResult {
  success: boolean;
  orderId?: string;
  error?: string;
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
    notConnected: "Connect OKX account first",
    connectCta: "Connect OKX",
    execute: "Execute on OKX",
    confirm: "Confirm & Execute",
    cancel: "Cancel",
    modalTitle: "Execute on OKX",
    size: "Size",
    sl: "SL",
    tp: "TP",
    leverageLabel: "Leverage",
    disclaimer:
      "Simulation results do not guarantee future returns. Real money will be used.",
    warningIcon: "Warning",
    successTitle: "Order Placed",
    orderId: "Order ID",
    errorTitle: "Execution Failed",
    tryAgain: "Try Again",
    close: "Close",
    executing: "Executing\u2026",
  },
  ko: {
    title: "OKX\uC5D0\uC11C \uC2E4\uD589",
    coming: "\uC900\uBE44 \uC911",
    desc: "OKX \uBE0C\uB85C\uCEE4 \uC5F0\uB3D9\uC73C\uB85C \uC6D0\uD074\uB9AD \uC2E4\uD589",
    features: [
      "\uC2DC\uBBAC\uB808\uC774\uC158 \uACB0\uACFC \uAE30\uBC18 \uC790\uB3D9 SL/TP",
      "API \uD0A4 \uACF5\uC720 \uBD88\uD544\uC694 (OAuth \uC778\uC99D)",
      "\uCD5C\uB300 20% \uC218\uC218\uB8CC \uD560\uC778",
    ],
    notify: "\uCD9C\uC2DC \uC54C\uB9BC \uBC1B\uAE30",
    notConnected:
      "\uBA3C\uC800 OKX \uACC4\uC815\uC744 \uC5F0\uACB0\uD558\uC138\uC694",
    connectCta: "OKX \uC5F0\uACB0",
    execute: "OKX\uC5D0\uC11C \uC2E4\uD589",
    confirm: "\uD655\uC778 \uBC0F \uC2E4\uD589",
    cancel: "\uCDE8\uC18C",
    modalTitle: "OKX\uC5D0\uC11C \uC2E4\uD589",
    size: "\uC0AC\uC774\uC988",
    sl: "SL",
    tp: "TP",
    leverageLabel: "\uB808\uBC84\uB9AC\uC9C0",
    disclaimer:
      "\uC2DC\uBBAC\uB808\uC774\uC158 \uACB0\uACFC\uB294 \uC2E4\uC81C \uC218\uC775\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC2E4\uC81C \uC790\uAE08\uC774 \uC0AC\uC6A9\uB429\uB2C8\uB2E4.",
    warningIcon: "\uACBD\uACE0",
    successTitle: "\uC8FC\uBB38 \uC644\uB8CC",
    orderId: "\uC8FC\uBB38 ID",
    errorTitle: "\uC2E4\uD589 \uC2E4\uD328",
    tryAgain: "\uB2E4\uC2DC \uC2DC\uB3C4",
    close: "\uB2EB\uAE30",
    executing: "\uC2E4\uD589 \uC911\u2026",
  },
};

export default function OKXExecuteButton({
  strategy,
  direction,
  symbol,
  slPct,
  tpPct,
  leverage = 5,
  sizeUsdt = 100,
  lang = "en",
}: Props) {
  const t = labels[lang];

  const [okxConnected, setOkxConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  // Check OKX connection status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/okx/status`, {
          credentials: "include",
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data: OKXStatus = await res.json();
        setOkxConnected(data.connected);
      } catch {
        setOkxConnected(false);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  // Close modal on Escape
  useEffect(() => {
    if (!showModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModal(false);
        setResult(null);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showModal]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  const handleExecute = useCallback(async () => {
    setExecuting(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/okx/execute`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy,
          direction,
          symbol,
          sl_pct: slPct,
          tp_pct: tpPct,
          leverage,
          size_usdt: sizeUsdt,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data: ExecuteResult = await res.json();
      if (!res.ok) {
        setResult({
          success: false,
          error: data.error || `HTTP ${res.status}`,
        });
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setResult({ success: false, error: msg });
    } finally {
      setExecuting(false);
    }
  }, [strategy, direction, symbol, slPct, tpPct, leverage, sizeUsdt]);

  const displaySymbol = symbol || "BTC-USDT-SWAP";
  const displayDirection = (direction || "LONG").toUpperCase();
  const isShort = displayDirection === "SHORT";

  // Loading state
  if (loading) {
    return (
      <div class="animate-pulse rounded-xl bg-[--color-bg-elevated] h-[52px] w-full" />
    );
  }

  // Not connected — show feature preview + connect CTA
  if (!okxConnected) {
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
            <span class="text-xs text-[--color-text-muted]">
              {t.notConnected}
            </span>
          </div>
        </div>
        <p class="text-sm text-[--color-text-muted] mb-3">{t.desc}</p>
        <ul class="space-y-1.5 mb-4">
          {t.features.map((f) => (
            <li
              key={f}
              class="flex items-center gap-2 text-xs text-[--color-text-secondary]"
            >
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
          href={`${API_BASE_URL}/api/auth/okx/start`}
          class="btn btn-primary btn-md w-full text-center inline-flex items-center justify-center gap-2"
        >
          {t.connectCta} &rarr;
        </a>
      </div>
    );
  }

  // Connected — show Execute button
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setShowModal(true);
          setResult(null);
        }}
        class="btn-primary btn-lg w-full text-center font-semibold cursor-pointer inline-flex items-center justify-center gap-2"
        aria-haspopup="dialog"
      >
        <svg
          class="w-5 h-5"
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
        {t.execute} &rarr;
      </button>

      {/* Confirm Modal */}
      {showModal && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t.modalTitle}
        >
          {/* Backdrop */}
          <div
            class="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (!executing) {
                setShowModal(false);
                setResult(null);
              }
            }}
          />

          {/* Modal content */}
          <div class="relative w-full max-w-md border border-[--color-border] rounded-xl bg-[--color-bg-card] shadow-2xl overflow-hidden">
            {/* Top accent line */}
            <div class="h-px bg-gradient-to-r from-transparent via-[--color-accent]/50 to-transparent" />

            <div class="p-6">
              {/* Header */}
              <h3 class="text-lg font-bold mb-4">{t.modalTitle}</h3>

              {/* Result states */}
              {result?.success ? (
                <div class="text-center py-4">
                  <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-[--color-up]/10 flex items-center justify-center">
                    <svg
                      class="w-6 h-6 text-[--color-up]"
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
                  </div>
                  <p class="font-semibold text-[--color-up] mb-2">
                    {t.successTitle}
                  </p>
                  {result.orderId && (
                    <p class="text-xs text-[--color-text-muted] font-mono bg-[--color-bg-elevated] rounded-lg px-3 py-2 inline-block">
                      {t.orderId}: {result.orderId}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setResult(null);
                    }}
                    class="btn-primary btn-md w-full mt-4 cursor-pointer"
                  >
                    {t.close}
                  </button>
                </div>
              ) : result && !result.success ? (
                <div class="text-center py-4">
                  <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-[--color-down]/10 flex items-center justify-center">
                    <svg
                      class="w-6 h-6 text-[--color-down]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <p class="font-semibold text-[--color-down] mb-1">
                    {t.errorTitle}
                  </p>
                  <p
                    class="text-xs text-[--color-text-muted] mb-4"
                    role="alert"
                    aria-live="assertive"
                  >
                    {result.error}
                  </p>
                  <div class="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setResult(null);
                      }}
                      class="btn-ghost btn-md flex-1 cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={handleExecute}
                      class="btn-primary btn-md flex-1 cursor-pointer"
                    >
                      {t.tryAgain}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Trade details */}
                  <div class="space-y-3 mb-4">
                    {/* Symbol + Direction */}
                    <div class="flex items-center justify-between p-3 rounded-lg bg-[--color-bg-elevated]">
                      <span class="font-mono font-semibold text-sm">
                        {displaySymbol}
                      </span>
                      <span
                        class={`text-xs font-bold px-2.5 py-1 rounded-md ${
                          isShort
                            ? "bg-[--color-down]/10 text-[--color-down] border border-[--color-border-down]"
                            : "bg-[--color-up]/10 text-[--color-up] border border-[--color-border-up]"
                        }`}
                      >
                        {displayDirection}
                      </span>
                    </div>

                    {/* Parameters grid */}
                    <div class="grid grid-cols-2 gap-2">
                      <div class="p-3 rounded-lg bg-[--color-bg-elevated]">
                        <div class="text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-0.5">
                          {t.size}
                        </div>
                        <div class="font-mono font-semibold text-sm">
                          ${sizeUsdt} USDT
                        </div>
                      </div>
                      <div class="p-3 rounded-lg bg-[--color-bg-elevated]">
                        <div class="text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-0.5">
                          {t.leverageLabel}
                        </div>
                        <div class="font-mono font-semibold text-sm">
                          {leverage}x
                        </div>
                      </div>
                      <div class="p-3 rounded-lg bg-[--color-bg-elevated]">
                        <div class="text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-0.5">
                          {t.sl}
                        </div>
                        <div class="font-mono font-semibold text-sm text-[--color-down]">
                          {slPct != null ? `${slPct}%` : "\u2014"}
                        </div>
                      </div>
                      <div class="p-3 rounded-lg bg-[--color-bg-elevated]">
                        <div class="text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-0.5">
                          {t.tp}
                        </div>
                        <div class="font-mono font-semibold text-sm text-[--color-up]">
                          {tpPct != null ? `${tpPct}%` : "\u2014"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div class="flex gap-2.5 p-3 rounded-lg bg-[--color-warning]/5 border border-[--color-warning]/20 mb-5">
                    <svg
                      class="w-4 h-4 text-[--color-warning] shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-label={t.warningIcon}
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <p class="text-xs text-[--color-text-muted] leading-relaxed">
                      {t.disclaimer}
                    </p>
                  </div>

                  {/* Actions */}
                  <div class="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setResult(null);
                      }}
                      disabled={executing}
                      class="btn-ghost btn-md flex-1 cursor-pointer disabled:opacity-50"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={handleExecute}
                      disabled={executing}
                      class="btn-primary btn-md flex-1 cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {executing ? (
                        <>
                          <span class="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                          {t.executing}
                        </>
                      ) : (
                        t.confirm
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
