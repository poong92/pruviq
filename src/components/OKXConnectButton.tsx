/**
 * OKX Connect/Disconnect button.
 * OAuth flow: fetch /auth/okx/init → build URL → window.location.assign()
 * Mirrors OKX JS SDK behavior (domain + /account/oauth + queryString) without loading SDK.
 */
import { useState, useEffect } from "preact/hooks";
import { API_BASE_URL as API_BASE } from "../config/api";

interface Props {
  lang?: "en" | "ko";
  size?: "sm" | "md" | "lg";
  showCard?: boolean;
}

const OKX_OAUTH_BASE = "https://www.okx.com/api/v5/oauth/authorize";

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
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

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

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Get CSRF state + OAuth params from backend
      const resp = await fetch(`${API_BASE}/auth/okx/init?lang=${lang}`);
      if (!resp.ok) throw new Error(`init failed: ${resp.status}`);
      const p = await resp.json();

      // Build OKX authorize URL (same as OKEXOAuthSDK.authorize() internally)
      const qs = new URLSearchParams({
        client_id: p.client_id,
        response_type: p.response_type,
        access_type: p.access_type,
        scope: p.scope,
        redirect_uri: p.redirect_uri,
        state: p.state,
      }).toString();

      window.location.assign(`${OKX_OAUTH_BASE}?${qs}`);
    } catch (e) {
      console.error("OKX OAuth init failed:", e);
      setConnecting(false);
    }
  };

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
        <button
          class={`btn btn-primary ${sizeClasses[size]} w-full`}
          onClick={handleConnect}
          disabled={connecting}
          aria-label={connecting ? t.connecting : t.connect}
        >
          {connecting ? t.connecting : `${t.connect} →`}
        </button>
      </div>
    );
  }

  // Simple button
  return (
    <div class="flex flex-col gap-1">
      {error && (
        <p class="text-xs text-[--color-down]" role="alert">
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
    </div>
  );
}
