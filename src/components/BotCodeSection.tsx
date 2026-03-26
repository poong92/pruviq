import { useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface Props {
  result: {
    profit_factor: number;
    win_rate: number;
    direction?: string;
    sl_pct?: number;
    tp_pct?: number;
  };
  strategyId: string;
  direction: string;
  slPct: number;
  tpPct: number;
  lang: "en" | "ko";
}

export default function BotCodeSection({
  result,
  strategyId,
  direction,
  slPct,
  tpPct,
  lang,
}: Props) {
  const [agreed, setAgreed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!result || result.profit_factor < 1.0) return null;

  const t =
    lang === "ko"
      ? {
          title: "실거래 봇 코드 생성",
          desc: "검증된 전략을 Python 봇으로 다운로드하세요.",
          disclaimer: "투자 조언이 아닙니다. 손실 책임은 본인에게 있습니다.",
          agree: "위 내용에 동의합니다",
          download: "봇 코드 다운로드 (.zip)",
          downloading: "생성 중...",
        }
      : {
          title: "Generate Trading Bot",
          desc: "Download a ready-to-run Python bot for this strategy.",
          disclaimer:
            "Not financial advice. You trade at your own risk. PRUVIQ does not execute trades.",
          agree: "I understand and agree",
          download: "Download Bot Code (.zip)",
          downloading: "Generating...",
        };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/generate-bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy_id: strategyId,
          direction,
          sl_pct: slPct,
          tp_pct: tpPct,
          backtest_win_rate: result.win_rate,
          backtest_profit_factor: result.profit_factor,
        }),
      });
      if (!resp.ok) {
        throw new Error(`Server error: ${resp.status}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pruviq_bot_${strategyId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Bot download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div class="mt-4 border border-[--color-accent]/30 rounded-lg p-4 bg-[--color-accent]/5">
      <p class="font-semibold text-sm mb-1">{t.title}</p>
      <p class="text-xs text-[--color-text-muted] mb-3">{t.desc}</p>
      <p class="text-xs text-[--color-red] mb-3">{t.disclaimer}</p>
      <label class="flex items-center gap-2 text-xs mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={() => setAgreed(!agreed)}
          aria-label={t.agree}
        />
        {t.agree}
      </label>
      <button
        onClick={handleDownload}
        disabled={!agreed || downloading}
        class="px-4 py-2 bg-[--color-accent] text-[--color-bg] rounded text-sm font-medium disabled:opacity-40"
        aria-label={t.download}
      >
        {downloading ? t.downloading : t.download}
      </button>
    </div>
  );
}
