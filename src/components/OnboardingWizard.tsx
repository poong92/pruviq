/**
 * OnboardingWizard — 4-step "first auto-trade" guided flow.
 *
 *   1. Connect OKX (manual paste or OAuth)
 *   2. Pick a base strategy from the verified list
 *   3. Verify with backtest (link to /simulate?strategy=<id>)
 *   4. Confirm 3 risk boxes → redirect to /dashboard
 *
 * No new backend endpoints. Step 1 polls /auth/okx/status; Step 2 lists
 * the 18 verified base strategies (id list mirrors StrategyBuilder).
 *
 * After Step 4, the wizard creates a starter user-strategy via existing
 * POST /user-strategies + /activate so the dashboard lands on a ready
 * (but disabled) bot — Step 4 only sets `is_active`, never `enabled`.
 * The user still has to toggle Enable Bot on the dashboard (which has
 * its own confirmation modal from PR #1989).
 */
import { useCallback, useEffect, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";
import { BASE_STRATEGIES } from "../config/base-strategies";

interface Props {
  lang?: "en" | "ko";
}

const i18n = {
  en: {
    title: "Set up your first PRUVIQ bot",
    subtitle: "Four steps — about three minutes.",
    skip: "Skip — I'll do it later",
    stepOf: "Step {n} of 4",
    next: "Continue →",
    back: "← Back",
    saving: "Setting up…",
    finishCta: "Open dashboard →",
    // Step 1
    s1Title: "Connect your OKX account",
    s1Body:
      "PRUVIQ runs trades on your OKX account using a Read+Trade API key. We never touch withdrawal permission. AES-256 encrypted at rest.",
    s1Cta: "Open /dashboard to connect",
    s1Done: "✓ Connected — let's pick a strategy.",
    s1Polling: "Waiting for OKX connection…",
    s1OpenDashboard: "Open dashboard in new tab",
    // Step 2
    s2Title: "Pick a base strategy",
    s2Body:
      "All 18 base strategies were backtested across 200+ coins. You can fine-tune SL/TP/leverage later in My Strategies.",
    s2Required: "Pick one to continue.",
    // Step 3
    s3Title: "Verify with backtest",
    s3Body:
      "Open the simulator with this strategy preloaded. See historical wins, losses, drawdown — then come back to activate.",
    s3Open: "Open simulator in new tab",
    s3Ack: "I reviewed the backtest results",
    // Step 4
    s4Title: "Final confirmation",
    s4Body:
      "Activating writes the strategy to your account. The bot won't auto-execute until you flip Enable Bot on the dashboard.",
    s4Check1: "Real funds will be traded — losses are possible.",
    s4Check2:
      "The bot runs 24/7 on PRUVIQ servers — closing this browser does NOT stop it.",
    s4Check3:
      "I can stop the bot anytime from the dashboard (Enable Bot toggle, Stop Bot widget, or OKX disconnect).",
    s4Activate: "Save strategy & open dashboard",
    s4Saving: "Saving strategy…",
    s4Error: "Could not save — go to dashboard and try My Strategies manually.",
    s4Retry: "Try again",
    s4GoDashboard: "Go to dashboard",
  },
  ko: {
    title: "PRUVIQ 봇 처음 설정",
    subtitle: "4단계 · 약 3분 소요",
    skip: "건너뛰기 — 나중에 설정",
    stepOf: "{n} / 4단계",
    next: "계속 →",
    back: "← 이전",
    saving: "저장 중…",
    finishCta: "대시보드 열기 →",
    s1Title: "OKX 계정 연결",
    s1Body:
      "PRUVIQ는 Read+Trade API 키로 OKX 거래를 실행합니다. 출금 권한은 절대 사용하지 않습니다. 저장 시 AES-256 암호화.",
    s1Cta: "대시보드에서 연결",
    s1Done: "✓ 연결됨 — 전략을 골라봅시다.",
    s1Polling: "OKX 연결 대기 중…",
    s1OpenDashboard: "새 탭에서 대시보드 열기",
    s2Title: "베이스 전략 선택",
    s2Body:
      "18개 베이스 전략은 200+ 코인 백테스트 검증을 거쳤습니다. SL/TP/레버리지는 '내 전략'에서 추후 조정 가능합니다.",
    s2Required: "전략 하나를 선택해 주세요.",
    s3Title: "백테스트로 검증",
    s3Body:
      "선택한 전략을 시뮬레이터에서 미리 봅니다. 과거 승률·손실·MDD를 확인한 뒤 활성화하세요.",
    s3Open: "새 탭에서 시뮬레이터 열기",
    s3Ack: "백테스트 결과를 확인했습니다",
    s4Title: "최종 확인",
    s4Body:
      "활성화하면 전략이 계정에 저장됩니다. '봇 활성화' 토글을 대시보드에서 켜기 전까지 자동 실행은 시작되지 않습니다.",
    s4Check1: "실거래 자금이 사용되며 손실이 발생할 수 있습니다.",
    s4Check2:
      "봇은 PRUVIQ 서버에서 24시간 실행됩니다 — 브라우저를 닫아도 멈추지 않습니다.",
    s4Check3:
      "대시보드의 '봇 활성화' 토글 / '봇 중지' 위젯 / OKX 연결 해제 중 하나로 언제든 중지할 수 있습니다.",
    s4Activate: "전략 저장 후 대시보드로",
    s4Saving: "전략 저장 중…",
    s4Error: "저장 실패 — 대시보드에서 '내 전략'으로 직접 만들어 주세요.",
    s4Retry: "다시 시도",
    s4GoDashboard: "대시보드로 이동",
  },
} as const;

const POLL_MS = 5_000;

export default function OnboardingWizard({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const dashboardPath = lang === "ko" ? "/ko/dashboard" : "/dashboard";
  const simulatePath = lang === "ko" ? "/ko/simulate/" : "/simulate/";

  const [step, setStep] = useState(1);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<string>("");
  const [reviewedBacktest, setReviewedBacktest] = useState(false);
  const [checks, setChecks] = useState({
    funds: false,
    runs247: false,
    stop: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Poll connection only while on step 1
  const fetchConn = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/okx/status`, {
        credentials: "include",
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { connected: boolean };
        setConnected(Boolean(data.connected));
      }
    } catch {
      /* keep last known state */
    }
  }, []);

  useEffect(() => {
    if (step !== 1) return;
    void fetchConn();
    const id = setInterval(() => {
      void fetchConn();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [step, fetchConn]);

  function canAdvance(): boolean {
    if (step === 1) return connected === true;
    if (step === 2) return picked !== "";
    if (step === 3) return reviewedBacktest;
    if (step === 4) return checks.funds && checks.runs247 && checks.stop;
    return false;
  }

  async function handleActivate() {
    setSaving(true);
    setErr("");
    try {
      const createRes = await fetch(`${API_BASE_URL}/user-strategies`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${picked} (onboarding)`,
          base_strategy: picked,
          exec_mode: "manual",
        }),
      });
      if (!createRes.ok) throw new Error(`create ${createRes.status}`);
      const { strategy } = (await createRes.json()) as {
        strategy: { id: string };
      };
      const actRes = await fetch(
        `${API_BASE_URL}/user-strategies/${strategy.id}/activate?exclusive=true`,
        { method: "POST", credentials: "include" },
      );
      if (!actRes.ok) throw new Error(`activate ${actRes.status}`);
      window.location.assign(`${dashboardPath}?onboarded=1`);
    } catch (e) {
      setErr(t.s4Error);
      setSaving(false);
    }
  }

  return (
    <div class="max-w-2xl mx-auto">
      {/* Header */}
      <div class="text-center mb-6">
        <h1 class="text-2xl md:text-3xl font-bold mb-1">{t.title}</h1>
        <p class="text-sm text-(--color-text-muted)">{t.subtitle}</p>
      </div>

      {/* Progress */}
      <div
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={4}
        aria-label={t.stepOf.replace("{n}", String(step))}
        class="flex items-center gap-1 mb-6"
      >
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            class={`flex-1 h-1.5 rounded-full motion-safe:transition-colors ${
              n <= step ? "bg-(--color-accent)" : "bg-(--color-border)"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
      <p class="text-center text-xs font-mono text-(--color-text-muted) mb-4">
        {t.stepOf.replace("{n}", String(step))}
      </p>

      {/* Step body */}
      <div class="card-enterprise rounded-2xl p-6 md:p-8 space-y-5">
        {step === 1 && (
          <>
            <h2 class="text-xl font-bold">{t.s1Title}</h2>
            <p class="text-sm text-(--color-text-secondary) leading-relaxed">
              {t.s1Body}
            </p>
            {connected === true ? (
              <p class="text-sm font-bold text-(--color-up)">{t.s1Done}</p>
            ) : (
              <div class="space-y-3">
                <p class="text-sm text-(--color-text-muted)">
                  {connected === false ? t.s1Cta : t.s1Polling}
                </p>
                <a
                  href={dashboardPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-2 btn btn-primary btn-md min-h-[44px]"
                >
                  💼 {t.s1OpenDashboard}
                </a>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h2 class="text-xl font-bold">{t.s2Title}</h2>
            <p class="text-sm text-(--color-text-secondary) leading-relaxed">
              {t.s2Body}
            </p>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
              {BASE_STRATEGIES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPicked(id)}
                  class={`text-left p-3 rounded-lg border min-h-[60px] transition-colors ${
                    picked === id
                      ? "border-(--color-accent) bg-(--color-accent)/10"
                      : "border-(--color-border) hover:border-(--color-accent)/40"
                  }`}
                  aria-pressed={picked === id}
                >
                  <span class="block text-xs font-mono font-bold">{id}</span>
                </button>
              ))}
            </div>
            {!picked && (
              <p class="text-xs text-(--color-text-muted) italic">
                {t.s2Required}
              </p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h2 class="text-xl font-bold">{t.s3Title}</h2>
            <p class="text-sm text-(--color-text-secondary) leading-relaxed">
              {t.s3Body}
            </p>
            <a
              href={`${simulatePath}?strategy=${encodeURIComponent(picked)}`}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 btn btn-ghost btn-md min-h-[44px]"
            >
              📊 {t.s3Open}
            </a>
            <label class="flex items-center gap-3 cursor-pointer text-sm pt-2">
              <input
                type="checkbox"
                checked={reviewedBacktest}
                onChange={(e) =>
                  setReviewedBacktest((e.target as HTMLInputElement).checked)
                }
                class="accent-(--color-accent) w-4 h-4"
              />
              <span>{t.s3Ack}</span>
            </label>
          </>
        )}

        {step === 4 && (
          <>
            <h2 class="text-xl font-bold">{t.s4Title}</h2>
            <p class="text-sm text-(--color-text-secondary) leading-relaxed">
              {t.s4Body}
            </p>
            <div class="space-y-3">
              {(
                [
                  ["funds", t.s4Check1],
                  ["runs247", t.s4Check2],
                  ["stop", t.s4Check3],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  class="flex items-start gap-3 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    class="mt-1 accent-(--color-accent) w-4 h-4 shrink-0"
                    checked={checks[key]}
                    onChange={(e) =>
                      setChecks((c) => ({
                        ...c,
                        [key]: (e.target as HTMLInputElement).checked,
                      }))
                    }
                  />
                  <span class="leading-relaxed">{label}</span>
                </label>
              ))}
            </div>
            {err && (
              <div class="space-y-2" role="alert" aria-live="assertive">
                <p class="text-sm text-(--color-down)">{err}</p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm min-h-[36px]"
                    onClick={() => {
                      setErr("");
                      void handleActivate();
                    }}
                  >
                    ↻ {t.s4Retry}
                  </button>
                  <a
                    href={dashboardPath}
                    class="btn btn-ghost btn-sm min-h-[36px] inline-flex items-center"
                  >
                    {t.s4GoDashboard} →
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer nav */}
      <div class="flex items-center justify-between mt-5 gap-3">
        <button
          type="button"
          class="btn btn-ghost btn-md min-h-[44px] disabled:opacity-40"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          {t.back}
        </button>
        <a
          href={dashboardPath}
          class="text-xs text-(--color-text-muted) hover:text-(--color-accent) underline"
        >
          {t.skip}
        </a>
        {step < 4 ? (
          <button
            type="button"
            class="btn btn-primary btn-md min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            disabled={!canAdvance()}
          >
            {t.next}
          </button>
        ) : (
          <button
            type="button"
            class="btn btn-primary btn-md min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleActivate}
            disabled={!canAdvance() || saving}
          >
            {saving ? t.s4Saving : t.s4Activate}
          </button>
        )}
      </div>
    </div>
  );
}
