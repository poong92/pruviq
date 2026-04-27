/**
 * ShareResultButton — share simulator result via Web Share API + clipboard.
 *
 * Strategy:
 *   1. If `navigator.share` is available (mobile, modern desktop browsers),
 *      use the native share sheet — user picks the destination.
 *   2. Otherwise, copy a one-line summary + URL to the clipboard. Inline
 *      "Copied!" feedback for 2s (no Toast dep — Toaster #1422 not merged).
 *
 * Image: relies on the static OG image at /og/strategies/[slug].png (W3-1)
 * for the social-card preview. No client-side PNG generation — keeps the
 * bundle slim (zero new deps) and avoids CSS-to-canvas font/image issues.
 */
import { useState } from "preact/hooks";

interface Props {
  /** Preset/strategy slug for /simulate?preset=... */
  presetId?: string | null;
  /** Display name shown in the share text */
  strategyName: string;
  /** Profit factor (e.g. 2.34) */
  profitFactor: number;
  /** Win rate as percent (e.g. 58.2) */
  winRate: number;
  /** Total trades */
  totalTrades: number;
  /** Total return as percent (e.g. 234.5) */
  totalReturnPct: number;
  /** "en" or "ko" */
  lang?: "en" | "ko";
  /** Optional class merged onto the button */
  class?: string;
}

const LABELS = {
  en: {
    idle: "Share result",
    copied: "Copied!",
    shareTitle: "PRUVIQ — Strategy result",
    bodyTpl: (n: string, pf: string, wr: string, t: number, ret: string) =>
      `I tested ${n} on PRUVIQ.\nPF ${pf} · WR ${wr}% · ${t} trades · ${ret} return.\nVerify before you trade.`,
  },
  ko: {
    idle: "결과 공유",
    copied: "복사 완료!",
    shareTitle: "PRUVIQ — 전략 결과",
    bodyTpl: (n: string, pf: string, wr: string, t: number, ret: string) =>
      `PRUVIQ에서 ${n} 전략을 테스트했어요.\nPF ${pf} · 승률 ${wr}% · ${t}건 · 수익률 ${ret}.\n검증 후 거래하세요.`,
  },
};

function buildShareUrl(presetId?: string | null): string {
  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}/simulate`
      : "https://pruviq.com/simulate";
  if (!presetId) return base;
  const url = new URL(base);
  url.searchParams.set("preset", presetId);
  url.searchParams.set("utm_source", "share");
  url.searchParams.set("utm_medium", "result-card");
  return url.toString();
}

export default function ShareResultButton({
  presetId,
  strategyName,
  profitFactor,
  winRate,
  totalTrades,
  totalReturnPct,
  lang = "en",
  class: className = "",
}: Props) {
  const [copied, setCopied] = useState(false);
  const t = LABELS[lang];
  const shareUrl = buildShareUrl(presetId);
  const text = t.bodyTpl(
    strategyName,
    profitFactor.toFixed(2),
    winRate.toFixed(1),
    totalTrades,
    `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}%`,
  );

  const handleClick = async () => {
    const data = { title: t.shareTitle, text, url: shareUrl };

    // Native share when supported (mobile + modern desktop)
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        // User cancelled or error — fall through to clipboard fallback
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers without clipboard API: open in new tab as last resort
      const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
      window.open(tweet, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      class={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[--color-border] bg-[--color-bg-card] px-4 py-2.5 text-sm font-semibold text-[--color-text] transition-colors hover:border-[--color-accent] hover:text-[--color-accent] ${className}`.trim()}
      aria-live="polite"
      data-testid="share-result-btn"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      {copied ? t.copied : t.idle}
    </button>
  );
}
