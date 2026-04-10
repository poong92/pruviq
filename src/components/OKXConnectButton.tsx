import { useState, useEffect } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface Props {
  lang?: "en" | "ko";
  size?: "sm" | "md" | "lg";
  showDescription?: boolean;
}

interface OKXStatus {
  connected: boolean;
}

const i18n = {
  en: {
    connect: "Connect OKX Account",
    connected: "OKX Connected",
    disconnect: "Disconnect",
    desc: "20% fee discount \u00B7 Secure OAuth \u00B7 No API keys shared",
    disconnecting: "Disconnecting\u2026",
    error: "Connection failed. Please try again.",
    successMsg: "OKX account connected successfully!",
  },
  ko: {
    connect: "OKX \uACC4\uC815 \uC5F0\uACB0",
    connected: "OKX \uC5F0\uACB0\uB428",
    disconnect: "\uC5F0\uACB0 \uD574\uC81C",
    desc: "\uC218\uC218\uB8CC 20% \uD560\uC778 \u00B7 \uC548\uC804\uD55C OAuth \u00B7 API \uD0A4 \uACF5\uC720 \uC5C6\uC74C",
    disconnecting: "\uC5F0\uACB0 \uD574\uC81C \uC911\u2026",
    error:
      "\uC5F0\uACB0 \uC2E4\uD328. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.",
    successMsg:
      "OKX \uACC4\uC815\uC774 \uC131\uACF5\uC801\uC73C\uB85C \uC5F0\uACB0\uB418\uC5C8\uC2B5\uB2C8\uB2E4!",
  },
} as const;

const sizeClasses = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
} as const;

export default function OKXConnectButton({
  lang = "en",
  size = "md",
  showDescription = false,
}: Props) {
  const t = i18n[lang];
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [flash, setFlash] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    const okxParam = params.get("okx");
    if (okxParam === "success") {
      setFlash("success");
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("okx");
      window.history.replaceState({}, "", url.toString());
    } else if (okxParam === "error") {
      setFlash("error");
      const url = new URL(window.location.href);
      url.searchParams.delete("okx");
      window.history.replaceState({}, "", url.toString());
    }

    // Fetch connection status
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/okx/status`, {
          credentials: "include",
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data: OKXStatus = await res.json();
        setConnected(data.connected);
      } catch {
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  // Auto-dismiss flash after 4s
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/okx/disconnect`, {
        method: "POST",
        credentials: "include",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Disconnect ${res.status}`);
      setConnected(false);
    } catch {
      setFlash("error");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnect = () => {
    window.location.href = `${API_BASE_URL}/api/auth/okx/start`;
  };

  // Loading skeleton
  if (loading) {
    const content = (
      <div
        class={`animate-pulse rounded-lg bg-[--color-bg-elevated] ${
          size === "lg" ? "h-[52px]" : size === "sm" ? "h-[36px]" : "h-[44px]"
        } w-full`}
        aria-busy="true"
        aria-label="Loading connection status"
      />
    );
    if (showDescription) {
      return (
        <div class="border border-[--color-border] rounded-xl p-5 bg-[--color-bg-card]">
          {content}
        </div>
      );
    }
    return content;
  }

  // Flash message
  const flashBanner = flash ? (
    <div
      role="alert"
      aria-live="assertive"
      class={`text-xs font-medium px-3 py-1.5 rounded-lg mb-3 ${
        flash === "success"
          ? "bg-[--color-up]/10 text-[--color-up] border border-[--color-border-up]"
          : "bg-[--color-down]/10 text-[--color-down] border border-[--color-border-down]"
      }`}
    >
      {flash === "success" ? t.successMsg : t.error}
    </div>
  ) : null;

  // Connected state
  if (connected) {
    const badge = (
      <div class="flex flex-col items-start gap-1">
        <span
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-[--color-up]/10 text-[--color-up] border border-[--color-border-up]"
          role="status"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
          {t.connected}
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          class="text-xs text-[--color-text-muted] hover:text-[--color-down] transition-colors ml-1 cursor-pointer disabled:opacity-50"
          aria-label={t.disconnect}
        >
          {disconnecting ? t.disconnecting : t.disconnect}
        </button>
      </div>
    );

    if (showDescription) {
      return (
        <div class="border border-[--color-border-up]/30 rounded-xl p-5 bg-[--color-up]/5">
          {flashBanner}
          {badge}
        </div>
      );
    }

    return (
      <>
        {flashBanner}
        {badge}
      </>
    );
  }

  // Disconnected state
  const connectBtn = (
    <button
      type="button"
      onClick={handleConnect}
      class={`btn-primary ${sizeClasses[size]} w-full text-center font-semibold cursor-pointer inline-flex items-center justify-center gap-2`}
      aria-label={t.connect}
    >
      <svg
        class="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
      {t.connect}
    </button>
  );

  if (showDescription) {
    return (
      <div class="border border-[--color-border] rounded-xl p-5 bg-[--color-bg-card]">
        {flashBanner}
        {connectBtn}
        <p class="text-xs text-[--color-text-muted] text-center mt-3">
          {t.desc}
        </p>
      </div>
    );
  }

  return (
    <>
      {flashBanner}
      {connectBtn}
    </>
  );
}
