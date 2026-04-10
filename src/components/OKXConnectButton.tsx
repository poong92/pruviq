/**
 * OKX Connect/Disconnect button.
 * Checks OAuth status via cookie-based session, shows connect or connected state.
 */
import { useState, useEffect } from "preact/hooks";

interface Props {
  lang?: "en" | "ko";
  size?: "sm" | "md" | "lg";
  showCard?: boolean;
}

const API_BASE = "https://api.pruviq.com";

const labels = {
  en: {
    connect: "Connect OKX Account",
    connected: "OKX Connected",
    disconnect: "Disconnect",
    connecting: "Connecting...",
    desc: "Link your OKX account to execute trades directly from simulations. 20% fee discount included.",
    benefits: [
      "One-click trade execution",
      "20% fee discount",
      "Secure OAuth — no API keys shared",
    ],
  },
  ko: {
    connect: "OKX 계정 연결",
    connected: "OKX 연결됨",
    disconnect: "연결 해제",
    connecting: "연결 중...",
    desc: "OKX 계정을 연결하면 시뮬레이션 결과를 바로 실행할 수 있습니다. 20% 수수료 할인 포함.",
    benefits: [
      "원클릭 거래 실행",
      "20% 수수료 할인",
      "안전한 OAuth — API 키 공유 불필요",
    ],
  },
};

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

  useEffect(() => {
    fetch(`${API_BASE}/auth/okx/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setConnected(d.connected);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    if (params.get("okx") === "success") {
      setConnected(true);
      setLoading(false);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("okx");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleDisconnect = async () => {
    await fetch(`${API_BASE}/auth/okx/disconnect`, {
      method: "POST",
      credentials: "include",
    });
    setConnected(false);
  };

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
        <span class="flex items-center gap-2 text-sm text-[--color-up] font-medium">
          <span class="w-2 h-2 rounded-full bg-[--color-up] animate-pulse" />
          {t.connected}
        </span>
        <button
          class="text-xs text-[--color-text-muted] hover:text-[--color-down] underline"
          onClick={handleDisconnect}
        >
          {t.disconnect}
        </button>
      </div>
    );
  }

  // Card variant with benefits
  if (showCard) {
    return (
      <div class="border border-[--color-accent]/20 rounded-xl p-5 bg-[--color-accent]/5">
        <h4 class="font-bold text-sm mb-2">{t.connect}</h4>
        <p class="text-xs text-[--color-text-muted] mb-3">{t.desc}</p>
        <ul class="space-y-1.5 mb-4">
          {t.benefits.map((b) => (
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
              {b}
            </li>
          ))}
        </ul>
        <a
          href={`${API_BASE}/auth/okx/start?lang=${lang}`}
          class={`btn btn-primary ${sizeClasses[size]} w-full text-center`}
        >
          {t.connect} →
        </a>
      </div>
    );
  }

  // Simple button
  return (
    <a
      href={`${API_BASE}/auth/okx/start?lang=${lang}`}
      class={`btn btn-primary ${sizeClasses[size]}`}
    >
      {t.connect} →
    </a>
  );
}
