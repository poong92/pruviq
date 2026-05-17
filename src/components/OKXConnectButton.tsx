/**
 * OKX Connect/Disconnect button.
 * Two connect paths:
 *  - OAuth: /auth/okx/start → OKX consent (pending OKX Broker OAuth approval)
 *  - Manual: user pastes API key + secret + passphrase → /auth/okx/manual-connect
 */
import { useState, useEffect } from "preact/hooks";
import { API_BASE_URL as API_BASE } from "../config/api";
import { OKX_DISCOUNT_PCT } from "../config/exchanges";

interface Props {
  lang?: "en" | "ko";
  size?: "sm" | "md" | "lg";
  showCard?: boolean;
}

const labels = {
  en: {
    connect: "Connect OKX",
    connected: "OKX Connected",
    disconnect: "Disconnect",
    connecting: "Connecting...",
    comingSoonBadge: "Coming Soon",
    comingSoonTitle: "Auto-trading — Coming Soon",
    comingSoonDesc: `Auto-execute your simulations on OKX with ${OKX_DISCOUNT_PCT}% fee discount. Launching soon — simulations remain fully free now.`,
    comingSoonBenefits: [
      "One-click trade execution (soon)",
      `${OKX_DISCOUNT_PCT}% fee discount`,
      "Secure OAuth — no API keys shared",
    ],
    desc: `Auto-execute your simulations on OKX with ${OKX_DISCOUNT_PCT}% fee discount.`,
    benefits: [
      `${OKX_DISCOUNT_PCT}% fee discount via OKX Broker`,
      "No API key sharing required (OAuth)",
      "Auto-execute or approval mode",
    ],
    orApiKey: "or connect with API key",
    manualTitle: "Connect with API Key",
    manualHelp: "Create a Read + Trade V5 API key: OKX → Profile → API",
    manualApiKey: "API Key",
    manualSecretKey: "Secret Key",
    manualPassphrase: "Passphrase",
    manualSubmit: "Verify & Connect",
    manualSubmitting: "Verifying...",
    manualCancel: "Cancel",
    manualError: "Connection failed",
  },
  ko: {
    connect: "OKX 연결",
    connected: "OKX 연결됨",
    disconnect: "연결 해제",
    connecting: "연결 중...",
    comingSoonBadge: "곧 출시",
    comingSoonTitle: "자동매매 — 곧 출시",
    comingSoonDesc: `OKX에서 시뮬레이션 자동 실행 + ${OKX_DISCOUNT_PCT}% 수수료 할인. 출시 예정 — 시뮬레이션은 현재도 무료입니다.`,
    comingSoonBenefits: [
      "원클릭 거래 실행 (예정)",
      `${OKX_DISCOUNT_PCT}% 수수료 할인`,
      "안전한 OAuth — API 키 공유 불필요",
    ],
    desc: `OKX에서 시뮬레이션 자동 실행 + ${OKX_DISCOUNT_PCT}% 수수료 할인.`,
    benefits: [
      `OKX Broker 통해 ${OKX_DISCOUNT_PCT}% 수수료 할인`,
      "OAuth — API 키 공유 불필요",
      "완전 자동 또는 승인 모드",
    ],
    orApiKey: "또는 API 키로 연결",
    manualTitle: "API 키로 연결",
    manualHelp: "Read + Trade V5 API 키 생성: OKX → 프로필 → API",
    manualApiKey: "API 키",
    manualSecretKey: "시크릿 키",
    manualPassphrase: "패스프레이즈",
    manualSubmit: "확인 후 연결",
    manualSubmitting: "확인 중...",
    manualCancel: "취소",
    manualError: "연결 실패",
  },
};

// Phase 3b: AUTOTRADE_COMING_SOON is now SSoT-derived from
// src/config/feature-flags.ts (env-driven via PUBLIC_AUTOTRADE_LIVE).
// Flip to live by setting PUBLIC_AUTOTRADE_LIVE='true' in data-deploy.yml.
import { AUTOTRADE_COMING_SOON } from "../config/feature-flags";

const sizeClasses = {
  sm: "btn-sm text-sm",
  md: "btn-md",
  lg: "btn-lg text-lg",
};

export default function OKXConnectButton({
  lang = "en",
  size = "md",
  showCard = false,
}: Props) {
  const t = labels[lang];
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  // Manual paste form state
  const [showApiForm, setShowApiForm] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Handle OAuth callback result (?okx=success|error)
    const params = new URLSearchParams(window.location.search);
    const okxParam = params.get("okx");
    if (okxParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete("okx");
      window.history.replaceState({}, "", url.toString());
      if (okxParam === "success") {
        setConnected(true);
        setLoading(false);
        return;
      }
      if (okxParam === "error") {
        setError(
          lang === "ko"
            ? "OKX 연결 실패. 다시 시도해주세요."
            : "OKX connection failed. Please try again.",
        );
        setLoading(false);
        return;
      }
    }

    fetch(`${API_BASE}/auth/okx/status`, {
      credentials: "include",
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => r.json())
      .then((d) => {
        setConnected(d.connected);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleConnect = () => {
    setConnecting(true);
    // Server-side redirect: backend generates full authorize URL with PKCE +
    // CSRF state + correct scope. Avoids frontend URL-building drift.
    window.location.assign(`${API_BASE}/auth/okx/start?lang=${lang}`);
  };

  const handleDisconnect = async () => {
    await fetch(`${API_BASE}/auth/okx/disconnect`, {
      method: "POST",
      credentials: "include",
    });
    setConnected(false);
  };

  const handleManualConnect = async (e: Event) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/okx/manual-connect`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey.trim(),
          secret_key: secretKey.trim(),
          passphrase: passphrase.trim(),
        }),
      });
      if (res.ok) {
        setConnected(true);
        setShowApiForm(false);
        setApiKey("");
        setSecretKey("");
        setPassphrase("");
      } else {
        const d = await res.json().catch(() => ({}));
        setError(`${t.manualError}: ${d.detail ?? res.status}`);
      }
    } catch {
      setError(lang === "ko" ? "네트워크 오류" : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  // 2026-04-23: while autotrading is on hold, short-circuit all connect
  // flows. Render a disabled "Coming Soon" pill immediately — skip the
  // loading/status fetches to /auth/okx/* entirely.
  if (AUTOTRADE_COMING_SOON) {
    if (showCard) {
      return (
        <div
          class="border border-(--color-border) rounded-xl p-5 bg-(--color-bg-card)"
          data-testid="okx-connect-coming-soon-card"
        >
          <div class="flex items-start justify-between gap-3 mb-2">
            <h4 class="font-bold text-sm">{t.comingSoonTitle}</h4>
            <span
              class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-(--color-accent)/10 text-(--color-accent-bright) border border-(--color-accent)/30"
              aria-label={t.comingSoonBadge}
            >
              ● {t.comingSoonBadge}
            </span>
          </div>
          <p class="text-xs text-(--color-text-muted) mb-3">
            {t.comingSoonDesc}
          </p>
          <ul class="space-y-1.5 mb-4">
            {t.comingSoonBenefits.map((b) => (
              <li class="flex items-center gap-2 text-xs text-(--color-text-secondary)">
                <svg
                  class="w-3.5 h-3.5 text-(--color-text-muted) shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {b}
              </li>
            ))}
          </ul>
          <button
            class={`btn btn-ghost ${sizeClasses[size]} w-full cursor-not-allowed`}
            disabled
            aria-disabled="true"
            aria-label={t.comingSoonTitle}
          >
            {t.comingSoonTitle}
          </button>
        </div>
      );
    }
    return (
      <button
        class={`btn btn-ghost ${sizeClasses[size]} cursor-not-allowed`}
        disabled
        aria-disabled="true"
        aria-label={t.comingSoonTitle}
        data-testid="okx-connect-coming-soon"
      >
        {t.comingSoonTitle}
      </button>
    );
  }

  if (loading) {
    return (
      <button class={`btn btn-ghost ${sizeClasses[size]} opacity-50`} disabled>
        {t.connecting}
      </button>
    );
  }

  // Connected state
  if (connected) {
    return (
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-2 text-sm text-(--color-up) font-medium">
          <span class="w-2 h-2 rounded-full bg-(--color-up) animate-pulse" />
          {t.connected}
        </span>
        <button
          class="text-xs text-(--color-text-muted) hover:text-(--color-down) underline min-h-[44px] px-3 -mx-3"
          onClick={handleDisconnect}
        >
          {t.disconnect}
        </button>
      </div>
    );
  }

  // Manual API key form
  const manualForm = (
    <form onSubmit={handleManualConnect} class="mt-3 space-y-2">
      <p class="text-xs text-(--color-text-muted)">{t.manualHelp}</p>
      <input
        type="text"
        placeholder={t.manualApiKey}
        value={apiKey}
        onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
        class="w-full text-xs rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 focus:outline-none focus:border-(--color-accent)"
        autocomplete="off"
        required
        aria-label={t.manualApiKey}
      />
      <input
        type="password"
        placeholder={t.manualSecretKey}
        value={secretKey}
        onInput={(e) => setSecretKey((e.target as HTMLInputElement).value)}
        class="w-full text-xs rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 focus:outline-none focus:border-(--color-accent)"
        autocomplete="off"
        required
        aria-label={t.manualSecretKey}
      />
      <input
        type="password"
        placeholder={t.manualPassphrase}
        value={passphrase}
        onInput={(e) => setPassphrase((e.target as HTMLInputElement).value)}
        class="w-full text-xs rounded-lg border border-(--color-border) bg-(--color-bg) px-3 py-2 focus:outline-none focus:border-(--color-accent)"
        autocomplete="off"
        required
        aria-label={t.manualPassphrase}
      />
      {error && (
        <p class="text-xs text-(--color-down)" role="alert">
          {error}
        </p>
      )}
      <div class="flex gap-2">
        <button
          type="submit"
          class="btn btn-primary btn-sm flex-1"
          disabled={submitting}
        >
          {submitting ? t.manualSubmitting : t.manualSubmit}
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          onClick={() => {
            setShowApiForm(false);
            setError("");
          }}
        >
          {t.manualCancel}
        </button>
      </div>
    </form>
  );

  // Card variant with benefits
  if (showCard) {
    return (
      <div class="border border-(--color-accent)/20 rounded-xl p-5 bg-(--color-accent)/5">
        <h4 class="font-bold text-sm mb-2">{t.connect}</h4>
        <p class="text-xs text-(--color-text-muted) mb-3">{t.desc}</p>
        <ul class="space-y-1.5 mb-4">
          {t.benefits.map((b) => (
            <li class="flex items-center gap-2 text-xs text-(--color-text-secondary)">
              <svg
                class="w-3.5 h-3.5 text-(--color-up) shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {b}
            </li>
          ))}
        </ul>
        <button
          class={`btn btn-primary ${sizeClasses[size]} w-full`}
          onClick={handleConnect}
          disabled={connecting}
          aria-label={connecting ? t.connecting : t.connect}
        >
          {connecting ? t.connecting : `${t.connect} →`}
        </button>
        {!showApiForm && (
          <button
            type="button"
            class="mt-2 text-xs text-(--color-text-muted) hover:text-(--color-accent) underline w-full text-center"
            onClick={() => setShowApiForm(true)}
          >
            {t.orApiKey}
          </button>
        )}
        {showApiForm && manualForm}
      </div>
    );
  }

  // Simple button + optional manual form
  return (
    <div class="flex flex-col gap-1">
      {error && !showApiForm && (
        <p class="text-xs text-(--color-down)" role="alert">
          {error}
        </p>
      )}
      <button
        class={`btn btn-primary ${sizeClasses[size]}`}
        onClick={handleConnect}
        disabled={connecting}
        aria-label={connecting ? t.connecting : t.connect}
      >
        {connecting ? t.connecting : `${t.connect} →`}
      </button>
      {!showApiForm && (
        <button
          type="button"
          class="text-xs text-(--color-text-muted) hover:text-(--color-accent) underline text-center"
          onClick={() => setShowApiForm(true)}
        >
          {t.orApiKey}
        </button>
      )}
      {showApiForm && manualForm}
    </div>
  );
}
