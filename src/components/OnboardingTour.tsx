/**
 * OnboardingTour.tsx - Casey first-visit onboarding overlay
 *
 * Shows a 3-step guided tour on first visit (localStorage key: pruviq_tour_done).
 * Semi-transparent backdrop + floating card. No external animation libraries.
 */
import { useState, useEffect } from "preact/hooks";

const TOUR_DONE_KEY = "pruviq_tour_done";

interface Step {
  title: string;
  desc: string;
  target: string; // CSS selector hint shown to user
  icon: string;
}

const STEPS: Record<"en" | "ko", Step[]> = {
  en: [
    {
      title: "Choose a market scenario",
      desc: "Pick a preset strategy or build your own — select indicators and entry conditions in the Strategy Builder panel.",
      target: "Strategy Builder",
      icon: "1",
    },
    {
      title: "Run a backtest",
      desc: 'Set your parameters (SL, TP, leverage, date range) then click "Run Backtest" to simulate performance across 500+ coins.',
      target: "Run Backtest button",
      icon: "2",
    },
    {
      title: "See your results",
      desc: "Review PnL, win rate, max drawdown, Sharpe ratio and the full equity curve. Export to CSV or Excel.",
      target: "Results section",
      icon: "3",
    },
    {
      title: "What do the numbers mean?",
      desc: "Win Rate: % of profitable trades (>55% is good). Profit Factor: money won ÷ lost (>1.5 is strong). MDD: largest peak-to-trough drop (lower is safer). A strategy needs ALL three to be viable.",
      target: "Key metrics",
      icon: "?",
    },
  ],
  ko: [
    {
      title: "시장 시나리오 선택",
      desc: "프리셋 전략을 선택하거나 직접 조건을 구성하세요. Strategy Builder에서 지표와 진입 조건을 설정할 수 있습니다.",
      target: "Strategy Builder",
      icon: "1",
    },
    {
      title: "백테스트 실행",
      desc: 'SL, TP, 레버리지, 기간을 설정한 후 "Run Backtest"를 클릭하면 500개 이상 코인에 대한 시뮬레이션이 시작됩니다.',
      target: "Run Backtest 버튼",
      icon: "2",
    },
    {
      title: "결과 확인",
      desc: "PnL, 승률, 최대 낙폭(MDD), 샤프 비율, 자본 곡선을 확인하세요. CSV 또는 Excel로 내보낼 수 있습니다.",
      target: "결과 섹션",
      icon: "3",
    },
    {
      title: "숫자가 뭘 의미하나요?",
      desc: "승률: 수익 거래 비율 (55%+ 양호). 수익 팩터(PF): 수익 ÷ 손실 (1.5+ 우수). MDD: 최대 낙폭 (낮을수록 안전). 세 지표 모두 좋아야 실전에서 생존합니다.",
      target: "핵심 지표",
      icon: "?",
    },
  ],
};

const L = {
  en: {
    next: "Next",
    done: "Done",
    skip: "Skip tour",
    step: "Step",
    ariaLabel: "Onboarding guide",
  },
  ko: {
    next: "다음",
    done: "완료",
    skip: "건너뛰기",
    step: "단계",
    ariaLabel: "온보딩 가이드",
  },
};

interface Props {
  lang?: "en" | "ko";
}

export default function OnboardingTour({ lang = "en" }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Skip tour in automated test environments (Playwright sets navigator.webdriver)
    if (typeof navigator !== "undefined" && navigator.webdriver) return;
    try {
      const done = localStorage.getItem(TOUR_DONE_KEY);
      if (!done) {
        // Small delay so the simulator finishes rendering first
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage may be unavailable (SSR / private mode)
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  const advance = () => {
    const steps = STEPS[lang];
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const steps = STEPS[lang];
  const t = L[lang];
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.ariaLabel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        transition: "opacity 0.2s ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        style={{
          background: "var(--color-bg-card, #1a1a22)",
          border: "1px solid var(--color-border, #2a2a35)",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "360px",
          width: "90%",
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          position: "relative",
        }}
      >
        {/* Step indicator dots */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
          {steps.map((_, i) => (
            <span
              key={i}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background:
                  i === step ? "#3182f6" : "var(--color-border, #2a2a35)",
                transition: "background 0.2s",
              }}
            />
          ))}
          <span
            style={{
              marginLeft: "auto",
              fontSize: "11px",
              fontFamily: "monospace",
              color: "var(--color-text-muted, #888)",
            }}
          >
            {t.step} {step + 1}/{steps.length}
          </span>
        </div>

        {/* Step number badge */}
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "rgba(49,130,246,0.15)",
            border: "1.5px solid #3182f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: "bold",
            fontFamily: "monospace",
            color: "#3182f6",
            marginBottom: "12px",
          }}
        >
          {current.icon}
        </div>

        {/* Title */}
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: "16px",
            fontWeight: "700",
            color: "var(--color-text, #fff)",
            lineHeight: 1.3,
          }}
        >
          {current.title}
        </h3>

        {/* Description */}
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "13px",
            color: "var(--color-text-muted, #aaa)",
            lineHeight: 1.6,
          }}
        >
          {current.desc}
        </p>

        {/* Target hint */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(49,130,246,0.08)",
            border: "1px solid rgba(49,130,246,0.2)",
            borderRadius: "6px",
            padding: "4px 10px",
            marginBottom: "20px",
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#3182f6",
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            style={{ flexShrink: 0 }}
          >
            <circle cx="5" cy="5" r="4" stroke="#3182f6" strokeWidth="1.5" />
            <circle cx="5" cy="5" r="1.5" fill="#3182f6" />
          </svg>
          {current.target}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={dismiss}
            data-testid="tour-skip"
            style={{
              flex: "0 0 auto",
              padding: "6px 12px",
              background: "transparent",
              border: "1px solid var(--color-border, #2a2a35)",
              borderRadius: "6px",
              fontSize: "12px",
              fontFamily: "monospace",
              color: "var(--color-text-muted, #888)",
              cursor: "pointer",
            }}
          >
            {t.skip}
          </button>
          <button
            onClick={advance}
            style={{
              flex: 1,
              padding: "8px 16px",
              background: "#3182f6",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              fontFamily: "monospace",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 0 16px rgba(49,130,246,0.3)",
            }}
          >
            {isLast ? t.done : t.next + " →"}
          </button>
        </div>
      </div>
    </div>
  );
}
